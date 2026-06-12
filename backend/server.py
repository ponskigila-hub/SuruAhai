from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Set
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo import MongoClient
from bson import ObjectId
import os
import math
import asyncio
import logging
import threading
import certifi
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SuruAhai API", version="1.0.0")
logger = logging.getLogger("suruahai.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "suruahai")
client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
db = client[DB_NAME]

# Collections
users_collection = db["users"]
services_collection = db["services"]
orders_collection = db["orders"]
wallets_collection = db["wallets"]
escrow_collection = db["escrow"]
reviews_collection = db["reviews"]
notifications_collection = db["notifications"]
wallet_transactions_collection = db["wallet_transactions"]
order_messages_collection = db["order_messages"]
offers_collection = db["offers"]
mitra_ratings_collection = db["mitra_ratings"]
user_ratings_collection = db["user_ratings"]

_seed_lock = threading.Lock()

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Enums
class UserRole:
    USER = "USER"
    MITRA = "MITRA"
    ADMIN = "ADMIN"

class OrderStatus:
    OPEN = "OPEN"
    NEGOTIATING = "NEGOTIATING"
    AWAITING_PAYMENT = "AWAITING_PAYMENT"
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_USER_CONFIRMATION = "AWAITING_USER_CONFIRMATION"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class EscrowStatus:
    HOLD = "HOLD"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"

class MessageType:
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    PRICE_OFFER = "PRICE_OFFER"
    SYSTEM = "SYSTEM"
    # Legacy types kept for backward compatibility with older messages.
    OFFER = "OFFER"
    FINAL_PRICE = "FINAL_PRICE"

class OfferStatus:
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    SUPERSEDED = "SUPERSEDED"
    CANCELLED = "CANCELLED"

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    phone: str = Field(min_length=10)
    role: str = Field(default="USER")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class GeoLocation(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class MitraServiceOffering(BaseModel):
    category: str
    base_price: Optional[float] = Field(default=None, ge=0)
    tools: List[str] = []
    description: Optional[str] = None

class MitraProfile(BaseModel):
    service_offerings: List[MitraServiceOffering] = []
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    service_area: Optional[str] = None
    location: Optional[GeoLocation] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    is_verified: bool = False
    is_online: bool = False

class ServiceCreate(BaseModel):
    name: str
    category: str
    description: str
    price: float
    duration_minutes: int = 60
    image_url: Optional[str] = None

class OrderCreate(BaseModel):
    service_id: str
    scheduled_date: str
    scheduled_time: str
    address: str
    description: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[GeoLocation] = None

class SelectMitra(BaseModel):
    mitra_id: str

class OfferCreate(BaseModel):
    amount: float = Field(gt=0)
    message: Optional[str] = None

class OrderMessageCreate(BaseModel):
    message: Optional[str] = None
    message_type: str = Field(default=MessageType.TEXT)
    offer_amount: Optional[float] = Field(default=None, gt=0)
    image_data: Optional[str] = None

class ReviewCreate(BaseModel):
    order_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class MitraRatingCreate(BaseModel):
    order_id: str
    quality: int = Field(ge=1, le=5)
    punctuality: int = Field(ge=1, le=5)
    friendliness: int = Field(ge=1, le=5)
    professionalism: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class UserRatingCreate(BaseModel):
    order_id: str
    payment: int = Field(ge=1, le=5)
    politeness: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class MitraWithdraw(BaseModel):
    amount: float = Field(gt=0)
    bank_name: str = Field(min_length=1)
    bank_account: str = Field(min_length=1)

MIN_MITRA_WITHDRAW = 50000.0
MIN_USER_TOPUP = 10000.0
MAX_USER_TOPUP = 50_000_000.0


class WalletTopUp(BaseModel):
    amount: float = Field(ge=MIN_USER_TOPUP, le=MAX_USER_TOPUP, description="Nominal top-up (IDR)")

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def _parse_iso_datetime(value: str) -> datetime:
    if not value:
        raise ValueError("empty timestamp")
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def _minutes_between(start_iso: str, end_iso: str) -> float:
    start = _parse_iso_datetime(start_iso)
    end = _parse_iso_datetime(end_iso)
    return max(0.0, (end - start).total_seconds() / 60.0)


def _normalize_service_offerings(profile: dict) -> List[dict]:
    """Return per-category offerings, migrating legacy flat profile fields if needed."""
    offerings = profile.get("service_offerings")
    if isinstance(offerings, list) and offerings:
        return offerings
    legacy_categories = profile.get("services") or []
    if not isinstance(legacy_categories, list) or not legacy_categories:
        return []
    if legacy_categories and isinstance(legacy_categories[0], dict):
        return legacy_categories
    return [
        {
            "category": cat,
            "base_price": profile.get("base_price"),
            "tools": profile.get("tools") or [],
            "description": profile.get("description") or profile.get("bio") or "",
        }
        for cat in legacy_categories
        if isinstance(cat, str)
    ]


def _get_service_offering(profile: dict, category: Optional[str]) -> Optional[dict]:
    if not category:
        return None
    for offering in _normalize_service_offerings(profile):
        if offering.get("category") == category:
            return offering
    return None


def _record_mitra_response_sample(mitra_id: str, minutes: float) -> None:
    mitra = users_collection.find_one({"_id": ObjectId(mitra_id)}, {"mitra_profile": 1})
    if not mitra:
        return
    profile = mitra.get("mitra_profile") or {}
    stats = profile.get("response_time_stats") or {"total_minutes": 0.0, "sample_count": 0}
    total = float(stats.get("total_minutes", 0)) + minutes
    count = int(stats.get("sample_count", 0)) + 1
    avg = round(total / count, 1)
    users_collection.update_one(
        {"_id": ObjectId(mitra_id)},
        {
            "$set": {
                "mitra_profile.response_time_stats": {"total_minutes": total, "sample_count": count},
                "mitra_profile.avg_response_time_minutes": avg,
            }
        },
    )


def _track_chat_response_time(order: dict, sender_role: str, sender_id: str, now_iso: str) -> None:
    order_id = order["_id"]
    if sender_role == UserRole.USER and order.get("mitra_id"):
        orders_collection.update_one(
            {"_id": order_id},
            {"$set": {"awaiting_mitra_reply_since": now_iso}},
        )
        return
    if sender_role == UserRole.MITRA and order.get("mitra_id") == sender_id:
        since = order.get("awaiting_mitra_reply_since")
        if since:
            try:
                minutes = _minutes_between(since, now_iso)
                if 0 <= minutes <= 24 * 60:
                    _record_mitra_response_sample(order["mitra_id"], minutes)
            except (ValueError, TypeError):
                pass
            orders_collection.update_one(
                {"_id": order_id},
                {"$unset": {"awaiting_mitra_reply_since": ""}},
            )

def record_wallet_transaction(user_id: str, amount: float, tx_type: str, description: str, order_id: Optional[str] = None):
    wallet_transactions_collection.insert_one({
        "user_id": user_id,
        "amount": amount,
        "type": tx_type,
        "description": description,
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometers."""
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return radius * 2 * math.asin(math.sqrt(a))


def create_notification(user_id: str, notif_type: str, title: str, body: str, order_id: Optional[str] = None):
    notif = {
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "order_id": order_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = notifications_collection.insert_one(notif)
    notif["id"] = str(result.inserted_id)
    notif.pop("_id", None)
    return notif


class OrderConnectionManager:
    """Tracks active WebSocket connections grouped by order id (one room per order)."""

    def __init__(self):
        self._rooms: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._rooms.setdefault(order_id, set()).add(websocket)

    async def disconnect(self, order_id: str, websocket: WebSocket):
        async with self._lock:
            room = self._rooms.get(order_id)
            if room:
                room.discard(websocket)
                if not room:
                    self._rooms.pop(order_id, None)

    async def broadcast(self, order_id: str, payload: dict):
        async with self._lock:
            connections = list(self._rooms.get(order_id, set()))
        for connection in connections:
            try:
                await connection.send_json(payload)
            except Exception:
                await self.disconnect(order_id, connection)


order_ws_manager = OrderConnectionManager()
_main_event_loop: Optional[asyncio.AbstractEventLoop] = None


@app.on_event("startup")
async def _capture_event_loop():
    global _main_event_loop
    _main_event_loop = asyncio.get_running_loop()


def broadcast_order_event(order_id: str, event: str, data: dict):
    """Fire-and-forget broadcast usable from synchronous (threadpool) endpoints."""
    payload = {"event": event, "data": data}
    coro = order_ws_manager.broadcast(order_id, payload)
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        running_loop = None

    if running_loop is not None:
        running_loop.create_task(coro)
    elif _main_event_loop is not None:
        asyncio.run_coroutine_threadsafe(coro, _main_event_loop)

def get_participant_order(order_id: str, user: dict):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order id")

    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if user["role"] == UserRole.USER and order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == UserRole.MITRA and order["mitra_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] not in (UserRole.USER, UserRole.MITRA):
        raise HTTPException(status_code=403, detail="Access denied")

    return order

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_doc(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# Health check
@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "SuruAhai API"}

# Auth endpoints
@app.post("/api/auth/register")
def register(data: UserRegister):
    if users_collection.find_one({"email": data.email}):
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Email sudah terdaftar"}
        )

    logger.info(
        "Register request received",
        extra={
            "email": data.email,
            "role": data.role,
            "phone": data.phone,
            "name": data.name,
        }
    )
    
    user_data = {
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "role": data.role if data.role in ["USER", "MITRA", "ADMIN"] else "USER",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if data.role == "MITRA":
        user_data["mitra_profile"] = {
            "service_offerings": [],
            "bio": "",
            "photo_url": "",
            "service_area": "",
            "location": None,
            "bank_name": "",
            "bank_account": "",
            "is_verified": False,
            "is_online": False,
            "rating": 0,
            "review_count": 0,
            "total_orders": 0,
            "completed_orders": 0,
            "completion_rate": 100,
            "response_time_stats": {"total_minutes": 0.0, "sample_count": 0},
            "avg_response_time_minutes": None,
        }
    
    result = users_collection.insert_one(user_data)
    
    # Create wallet
    wallets_collection.insert_one({
        "user_id": str(result.inserted_id),
        "balance": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    token = create_token({"sub": str(result.inserted_id), "role": user_data["role"]})
    
    response_user = {
        "id": str(result.inserted_id),
        "email": data.email,
        "name": data.name,
        "role": user_data["role"]
    }

    return {
        "success": True,
        "message": "Registrasi berhasil",
        "data": {
            "token": token,
            "user": response_user,
        },
        # Keep backward compatibility for existing frontend/test callers.
        "token": token,
        "user": response_user,
    }

@app.post("/api/auth/login")
def login(data: UserLogin):
    user = users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "Email atau password tidak valid"}
        )
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    token = create_token({"sub": str(user["_id"]), "role": user["role"]})
    
    response_user = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }

    return {
        "success": True,
        "message": "Login berhasil",
        "data": {
            "token": token,
            "user": response_user,
        },
        # Keep backward compatibility for existing frontend/test callers.
        "token": token,
        "user": response_user,
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    user.pop("password", None)
    return user

# User endpoints
@app.put("/api/user/profile")
def update_profile(data: UserUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": update_data})
    return {"message": "Profile updated"}

@app.get("/api/user/wallet")
@app.get("/api/wallet")
@app.get("/wallet")
def get_wallet(user: dict = Depends(get_current_user)):
    wallet = wallets_collection.find_one({"user_id": user["id"]}, {"_id": 0}) or {"balance": 0}
    transactions = list(
        wallet_transactions_collection
        .find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
    )
    return {
        "balance": wallet.get("balance", 0),
        "transactions": transactions,
    }


@app.post("/api/wallet/topup")
def wallet_topup(data: WalletTopUp, user: dict = Depends(require_role(["USER"]))):
    amount = float(data.amount)

    wallets_collection.update_one(
        {"user_id": user["id"]},
        {
            "$inc": {"balance": amount},
            "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    record_wallet_transaction(
        user_id=user["id"],
        amount=amount,
        tx_type="credit",
        description="Top up saldo",
    )
    wallet = wallets_collection.find_one({"user_id": user["id"]})
    new_balance = float((wallet or {}).get("balance", 0) or 0)
    return {"message": "Top up berhasil", "balance": new_balance, "amount": amount}


def _execute_mitra_withdraw(data: MitraWithdraw, user: dict):
    if data.amount < MIN_MITRA_WITHDRAW:
        raise HTTPException(status_code=400, detail="Minimal penarikan Rp 50.000")
    wallet = wallets_collection.find_one({"user_id": user["id"]})
    balance = float((wallet or {}).get("balance", 0) or 0)
    if data.amount > balance:
        raise HTTPException(status_code=400, detail="Saldo tidak mencukupi")

    bank_name = data.bank_name.strip()
    bank_account = data.bank_account.strip()
    current_profile = user.get("mitra_profile") or {}
    merged_profile = {**current_profile, "bank_name": bank_name, "bank_account": bank_account}
    merged_profile["is_verified"] = current_profile.get("is_verified", False)

    wallets_collection.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": -data.amount}},
    )
    record_wallet_transaction(
        user_id=user["id"],
        amount=data.amount,
        tx_type="debit",
        description=f"Penarikan ke {bank_name} • {bank_account}",
    )
    users_collection.update_one(
        {"_id": ObjectId(user["id"])},
        {
            "$set": {
                "mitra_profile": merged_profile,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    new_balance = balance - data.amount
    return {"message": "Penarikan berhasil", "balance": new_balance}


@app.post("/api/wallet/withdraw")
def wallet_withdraw_mitra(data: MitraWithdraw, user: dict = Depends(require_role(["MITRA"]))):
    return _execute_mitra_withdraw(data, user)


# Services endpoints
@app.get("/api/services")
def get_services(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    services = list(services_collection.find(query))
    return [serialize_doc(s) for s in services]

@app.get("/api/services/{service_id}")
def get_service(service_id: str):
    service = services_collection.find_one({"_id": ObjectId(service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return serialize_doc(service)

@app.post("/api/services")
def create_service(data: ServiceCreate, user: dict = Depends(require_role(["ADMIN"]))):
    service_data = data.dict()
    service_data["created_at"] = datetime.now(timezone.utc).isoformat()
    service_data["is_active"] = True
    result = services_collection.insert_one(service_data)
    return {"id": str(result.inserted_id), "message": "Service created"}

@app.get("/api/services/categories/list")
def get_categories():
    categories = [
        {"id": "cleaning", "name": "Kebersihan", "icon": "Sparkles", "description": "Jasa bersih rumah, laundry, dll"},
        {"id": "ac", "name": "AC & Elektronik", "icon": "Wind", "description": "Service AC, kulkas, mesin cuci"},
        {"id": "plumbing", "name": "Pipa & Sanitasi", "icon": "Droplets", "description": "Perbaikan pipa, WC, wastafel"},
        {"id": "electrical", "name": "Listrik", "icon": "Zap", "description": "Instalasi & perbaikan listrik"},
        {"id": "moving", "name": "Pindahan", "icon": "Truck", "description": "Jasa pindah rumah & angkut barang"},
        {"id": "renovation", "name": "Renovasi", "icon": "Hammer", "description": "Cat, tukang, renovasi ringan"}
    ]
    return categories

# Mitra endpoints
@app.get("/api/mitra/list")
def get_mitra_list(category: Optional[str] = None, is_online: Optional[bool] = None):
    query = {"role": "MITRA"}
    if category:
        query["mitra_profile.service_offerings.category"] = category
    if is_online is not None:
        query["mitra_profile.is_online"] = is_online
    
    mitras = list(users_collection.find(query, {"password": 0}))
    return [serialize_doc(m) for m in mitras]

@app.get("/api/mitra/dashboard")
def get_mitra_dashboard(user: dict = Depends(require_role(["MITRA"]))):
    total_orders = orders_collection.count_documents({"mitra_id": user["id"]})
    completed_orders = orders_collection.count_documents({"mitra_id": user["id"], "status": "COMPLETED"})
    pending_orders = orders_collection.count_documents({
        "mitra_id": user["id"],
        "status": {"$in": ["NEGOTIATING", "AWAITING_PAYMENT", "PENDING", "CONFIRMED"]},
    })
    
    # Calculate earnings
    completed = list(orders_collection.find({"mitra_id": user["id"], "status": "COMPLETED"}))
    total_earnings = sum(o.get("total_amount", 0) * 0.85 for o in completed)  # 15% commission
    
    wallet = wallets_collection.find_one({"user_id": user["id"]})
    
    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders,
        "total_earnings": total_earnings,
        "wallet_balance": wallet.get("balance", 0) if wallet else 0,
        "rating": user.get("mitra_profile", {}).get("rating", 0),
        "is_online": user.get("mitra_profile", {}).get("is_online", False)
    }

@app.post("/api/mitra/withdraw")
def mitra_withdraw(data: MitraWithdraw, user: dict = Depends(require_role(["MITRA"]))):
    return _execute_mitra_withdraw(data, user)

@app.get("/api/mitra/{mitra_id}")
def get_mitra(mitra_id: str):
    mitra = users_collection.find_one({"_id": ObjectId(mitra_id), "role": "MITRA"}, {"password": 0})
    if not mitra:
        raise HTTPException(status_code=404, detail="Mitra not found")
    return serialize_doc(mitra)

@app.put("/api/mitra/profile")
def update_mitra_profile(data: MitraProfile, user: dict = Depends(require_role(["MITRA"]))):
    current = user.get("mitra_profile") or {}
    payload = data.dict()
    if not payload.get("service_offerings"):
        raise HTTPException(status_code=400, detail="Minimal satu kategori layanan wajib dikonfigurasi")
    merged = {**current, **payload}
    merged["is_verified"] = current.get("is_verified", False)
    for preserved in (
        "rating",
        "review_count",
        "total_orders",
        "completed_orders",
        "completion_rate",
        "response_time_stats",
        "avg_response_time_minutes",
    ):
        if preserved in current:
            merged[preserved] = current[preserved]
    for legacy in ("services", "description", "base_price", "tools", "response_time_minutes"):
        merged.pop(legacy, None)
    users_collection.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"mitra_profile": merged, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Mitra profile updated"}

@app.put("/api/mitra/toggle-online")
def toggle_online(user: dict = Depends(require_role(["MITRA"]))):
    current = user.get("mitra_profile", {}).get("is_online", False)
    users_collection.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"mitra_profile.is_online": not current}}
    )
    return {"is_online": not current}

# Order endpoints
@app.post("/api/orders")
def create_order(data: OrderCreate, user: dict = Depends(require_role(["USER"]))):
    # Get service details
    service = services_collection.find_one({"_id": ObjectId(data.service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    reference_price = float(service.get("price", 0) or 0)

    now = datetime.now(timezone.utc).isoformat()
    order_data = {
        "user_id": user["id"],
        "user_name": user["name"],
        "mitra_id": None,
        "mitra_name": None,
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_category": service["category"],
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "address": data.address,
        "description": data.description,
        "notes": data.notes,
        "location": data.location.dict() if data.location else None,
        "base_price": None,
        "reference_price": reference_price,
        "initial_price": None,
        "final_price": None,
        "total_amount": reference_price,
        "negotiation_locked": False,
        "status": OrderStatus.OPEN,
        "created_at": now,
        "updated_at": now,
    }

    result = orders_collection.insert_one(order_data)
    order_id = str(result.inserted_id)

    return {"id": order_id, "message": "Order created", "status": OrderStatus.OPEN}


def _mitra_card(mitra: dict, order: Optional[dict] = None, category: Optional[str] = None) -> Optional[dict]:
    """Build the public marketplace card for a mitra scoped to one service category."""
    profile = mitra.get("mitra_profile") or {}
    cat = category or (order.get("service_category") if order else None)
    offering = _get_service_offering(profile, cat) if cat else None
    if cat and not offering:
        return None

    location = profile.get("location") or {}
    distance_km = None
    if order:
        order_loc = order.get("location") or {}
        if (
            order_loc.get("lat") is not None
            and order_loc.get("lng") is not None
            and location.get("lat") is not None
            and location.get("lng") is not None
        ):
            distance_km = round(
                haversine_km(order_loc["lat"], order_loc["lng"], location["lat"], location["lng"]),
                2,
            )
    travel_estimate_minutes = None
    if distance_km is not None:
        travel_estimate_minutes = int(round(distance_km / 25 * 60))

    base_price = offering.get("base_price") if offering else profile.get("base_price")
    tools = offering.get("tools") if offering else (profile.get("tools") or [])
    service_description = offering.get("description") if offering else (profile.get("description") or "")

    return {
        "id": str(mitra["_id"]),
        "name": mitra.get("name"),
        "phone": mitra.get("phone"),
        "photo_url": profile.get("photo_url") or "",
        "bio": profile.get("bio") or "",
        "service_category": cat,
        "service_description": service_description,
        "description": service_description,
        "base_price": base_price,
        "tools": tools or [],
        "service_area": profile.get("service_area") or "",
        "avg_response_time_minutes": profile.get("avg_response_time_minutes"),
        "rating": profile.get("rating") or 0,
        "review_count": profile.get("review_count") or 0,
        "completed_orders": profile.get("completed_orders") or profile.get("total_orders") or 0,
        "is_verified": profile.get("is_verified", False),
        "is_online": profile.get("is_online", False),
        "location": profile.get("location"),
        "distance_km": distance_km,
        "travel_estimate_minutes": travel_estimate_minutes,
    }


@app.get("/api/orders/{order_id}/mitras")
def get_order_mitras(order_id: str, sort: Optional[str] = None, user: dict = Depends(require_role(["USER"]))):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order id")
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    category = order.get("service_category")
    query = {
        "role": "MITRA",
        "mitra_profile.is_online": True,
        "mitra_profile.is_verified": True,
    }
    if category:
        query["mitra_profile.service_offerings.category"] = category

    mitras = list(users_collection.find(query, {"password": 0}))
    cards = [c for c in (_mitra_card(m, order, category) for m in mitras) if c is not None]

    sort_key = {
        "price_asc": lambda c: (c["base_price"] is None, c["base_price"] or 0),
        "price_desc": lambda c: -(c["base_price"] or 0),
        "rating": lambda c: -(c["rating"] or 0),
        "rating_count": lambda c: -(c["review_count"] or 0),
        "distance": lambda c: (c["distance_km"] is None, c["distance_km"] if c["distance_km"] is not None else 0),
        "response_time": lambda c: (
            c["avg_response_time_minutes"] is None,
            c["avg_response_time_minutes"] if c["avg_response_time_minutes"] is not None else 0,
        ),
        "completed_orders": lambda c: -(c["completed_orders"] or 0),
    }.get(sort)
    if sort_key:
        cards.sort(key=sort_key)

    return cards


@app.post("/api/orders/{order_id}/select-mitra")
def select_mitra(order_id: str, data: SelectMitra, user: dict = Depends(require_role(["USER"]))):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order id")
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if order["status"] != OrderStatus.OPEN:
        raise HTTPException(status_code=400, detail="Mitra hanya dapat dipilih saat pesanan masih terbuka")

    mitra = users_collection.find_one({"_id": ObjectId(data.mitra_id), "role": "MITRA"})
    if not mitra:
        raise HTTPException(status_code=404, detail="Mitra not found")

    profile = mitra.get("mitra_profile") or {}
    category = order.get("service_category")
    offering = _get_service_offering(profile, category)
    if category and not offering:
        raise HTTPException(status_code=400, detail="Mitra ini tidak melayani kategori layanan yang dipilih")

    base_price = offering.get("base_price") if offering else profile.get("base_price")
    if base_price is None:
        base_price = float(order.get("reference_price") or 0)

    now = datetime.now(timezone.utc).isoformat()
    orders_collection.update_one(
        {"_id": order["_id"]},
        {
            "$set": {
                "mitra_id": data.mitra_id,
                "mitra_name": mitra["name"],
                "base_price": base_price,
                "initial_price": base_price,
                "total_amount": base_price,
                "status": OrderStatus.NEGOTIATING,
                "updated_at": now,
            }
        },
    )

    order_messages_collection.insert_one({
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": f"{user['name']} memilih {mitra['name']}. Harga dasar mitra Rp {int(base_price):,}. Silakan diskusikan kebutuhan dan harga.".replace(",", "."),
        "message_type": MessageType.SYSTEM,
        "offer_amount": None,
        "created_at": now,
    })

    create_notification(
        user_id=data.mitra_id,
        notif_type="order_selected",
        title="Anda dipilih untuk pesanan baru",
        body=f"{user['name']} memilih Anda untuk {order.get('service_name')}. Mulai negosiasi sekarang.",
        order_id=str(order["_id"]),
    )
    broadcast_order_event(str(order["_id"]), "status", {"status": OrderStatus.NEGOTIATING, "mitra_id": data.mitra_id})

    return {"message": "Mitra dipilih", "status": OrderStatus.NEGOTIATING}

@app.get("/api/orders")
def get_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "USER":
        query = {"user_id": user["id"]}
    elif user["role"] == "MITRA":
        query = {"mitra_id": user["id"]}
    else:
        query = {}
    
    orders = list(orders_collection.find(query).sort("created_at", -1))
    return [serialize_doc(o) for o in orders]

@app.get("/api/orders/{order_id}")
def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check access
    if user["role"] == "USER" and order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "MITRA" and order["mitra_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return serialize_doc(order)

@app.get("/api/orders/{order_id}/messages")
def get_order_messages(order_id: str, user: dict = Depends(get_current_user)):
    order = get_participant_order(order_id, user)
    messages = list(
        order_messages_collection
        .find({"order_id": str(order["_id"])})
        .sort("created_at", 1)
    )
    return [serialize_doc(message) for message in messages]

MAX_IMAGE_DATA_LENGTH = 3_000_000  # ~3MB base64 payload, enough for a chat photo.


@app.post("/api/orders/{order_id}/messages")
def send_order_message(order_id: str, data: OrderMessageCreate, user: dict = Depends(get_current_user)):
    order = get_participant_order(order_id, user)
    message_type = (data.message_type or MessageType.TEXT).upper()
    if message_type not in (MessageType.TEXT, MessageType.IMAGE):
        raise HTTPException(status_code=400, detail="Invalid message type")

    if order.get("negotiation_locked") or order["status"] not in (
        OrderStatus.NEGOTIATING,
        OrderStatus.AWAITING_PAYMENT,
    ):
        raise HTTPException(status_code=400, detail="Chat sudah dikunci untuk pesanan ini")

    message = (data.message or "").strip()
    image_data = data.image_data

    if message_type == MessageType.TEXT:
        if not message:
            raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")
    elif message_type == MessageType.IMAGE:
        if not image_data:
            raise HTTPException(status_code=400, detail="Gambar tidak boleh kosong")
        if len(image_data) > MAX_IMAGE_DATA_LENGTH:
            raise HTTPException(status_code=400, detail="Ukuran gambar terlalu besar")
        message = message or "Mengirim gambar"

    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": message,
        "message_type": message_type,
        "offer_amount": None,
        "image_data": image_data if message_type == MessageType.IMAGE else None,
        "created_at": now,
    }
    result = order_messages_collection.insert_one(message_doc)
    message_doc["_id"] = result.inserted_id
    serialized = serialize_doc(message_doc)

    _track_chat_response_time(order, user["role"], user["id"], now)

    recipient_id = order["mitra_id"] if user["role"] == UserRole.USER else order["user_id"]
    if recipient_id:
        create_notification(
            user_id=recipient_id,
            notif_type="chat_message",
            title="Pesan baru",
            body=f"{user['name']}: {message[:60]}",
            order_id=str(order["_id"]),
        )
    broadcast_order_event(str(order["_id"]), "message", serialized)
    return serialized


def _serialize_offer(offer: dict) -> dict:
    offer = dict(offer)
    offer["id"] = str(offer.pop("_id"))
    return offer


@app.get("/api/orders/{order_id}/offers")
def get_order_offers(order_id: str, user: dict = Depends(get_current_user)):
    order = get_participant_order(order_id, user)
    offers = list(
        offers_collection.find({"order_id": str(order["_id"])}).sort("created_at", 1)
    )
    return [_serialize_offer(o) for o in offers]


@app.post("/api/orders/{order_id}/offers")
def create_offer(order_id: str, data: OfferCreate, user: dict = Depends(get_current_user)):
    order = get_participant_order(order_id, user)
    if user["role"] not in (UserRole.USER, UserRole.MITRA):
        raise HTTPException(status_code=403, detail="Access denied")
    if order["status"] != OrderStatus.NEGOTIATING or order.get("negotiation_locked"):
        raise HTTPException(status_code=400, detail="Penawaran hanya dapat dibuat saat negosiasi")

    now = datetime.now(timezone.utc).isoformat()
    # Any new offer supersedes the previous pending one.
    offers_collection.update_many(
        {"order_id": str(order["_id"]), "status": OfferStatus.PENDING},
        {"$set": {"status": OfferStatus.SUPERSEDED, "updated_at": now}},
    )

    amount = float(data.amount)
    offer_doc = {
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "amount": amount,
        "message": (data.message or "").strip() or None,
        "status": OfferStatus.PENDING,
        "created_at": now,
        "updated_at": now,
    }
    result = offers_collection.insert_one(offer_doc)
    offer_doc["_id"] = result.inserted_id
    offer_id = str(result.inserted_id)

    chat_doc = {
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": (data.message or "").strip() or "Mengajukan penawaran harga",
        "message_type": MessageType.PRICE_OFFER,
        "offer_amount": amount,
        "offer_id": offer_id,
        "created_at": now,
    }
    order_messages_collection.insert_one(dict(chat_doc))

    recipient_id = order["mitra_id"] if user["role"] == UserRole.USER else order["user_id"]
    if recipient_id:
        create_notification(
            user_id=recipient_id,
            notif_type="offer_created",
            title="Penawaran harga baru",
            body=f"{user['name']} menawar Rp {int(amount):,}".replace(",", "."),
            order_id=str(order["_id"]),
        )

    serialized = _serialize_offer(offer_doc)
    broadcast_order_event(str(order["_id"]), "offer", serialized)
    return serialized


@app.post("/api/offers/{offer_id}/accept")
def accept_offer(offer_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(offer_id):
        raise HTTPException(status_code=400, detail="Invalid offer id")
    offer = offers_collection.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    order = get_participant_order(offer["order_id"], user)
    if offer["status"] != OfferStatus.PENDING:
        raise HTTPException(status_code=400, detail="Penawaran ini sudah tidak aktif")
    if order["status"] != OrderStatus.NEGOTIATING or order.get("negotiation_locked"):
        raise HTTPException(status_code=400, detail="Negosiasi sudah tidak aktif")
    # Only the counterparty can accept an offer (not the one who made it).
    if offer["sender_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Anda tidak dapat menerima penawaran Anda sendiri")

    amount = float(offer["amount"])
    now = datetime.now(timezone.utc).isoformat()
    offers_collection.update_one(
        {"_id": offer["_id"]},
        {"$set": {"status": OfferStatus.ACCEPTED, "accepted_by": user["id"], "updated_at": now}},
    )
    orders_collection.update_one(
        {"_id": order["_id"]},
        {
            "$set": {
                "final_price": amount,
                "total_amount": amount,
                "status": OrderStatus.AWAITING_PAYMENT,
                "negotiation_locked": True,
                "updated_at": now,
            }
        },
    )
    order_messages_collection.insert_one({
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": f"Penawaran Rp {int(amount):,} diterima. Pesanan menunggu pembayaran.".replace(",", "."),
        "message_type": MessageType.SYSTEM,
        "offer_amount": amount,
        "created_at": now,
    })

    other_id = order["mitra_id"] if user["role"] == UserRole.USER else order["user_id"]
    if other_id:
        create_notification(
            user_id=other_id,
            notif_type="offer_accepted",
            title="Penawaran diterima",
            body=f"Harga Rp {int(amount):,} disepakati.".replace(",", "."),
            order_id=str(order["_id"]),
        )
    broadcast_order_event(
        str(order["_id"]),
        "status",
        {"status": OrderStatus.AWAITING_PAYMENT, "final_price": amount, "negotiation_locked": True},
    )
    return {"message": "Penawaran diterima", "status": OrderStatus.AWAITING_PAYMENT, "amount": amount}


@app.post("/api/offers/{offer_id}/reject")
def reject_offer(offer_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(offer_id):
        raise HTTPException(status_code=400, detail="Invalid offer id")
    offer = offers_collection.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    order = get_participant_order(offer["order_id"], user)
    if offer["status"] != OfferStatus.PENDING:
        raise HTTPException(status_code=400, detail="Penawaran ini sudah tidak aktif")
    if offer["sender_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Anda tidak dapat menolak penawaran Anda sendiri")

    now = datetime.now(timezone.utc).isoformat()
    offers_collection.update_one(
        {"_id": offer["_id"]},
        {"$set": {"status": OfferStatus.REJECTED, "updated_at": now}},
    )
    order_messages_collection.insert_one({
        "order_id": str(order["_id"]),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": f"Penawaran Rp {int(offer['amount']):,} ditolak. Silakan ajukan penawaran lain.".replace(",", "."),
        "message_type": MessageType.SYSTEM,
        "offer_amount": float(offer["amount"]),
        "created_at": now,
    })
    broadcast_order_event(str(order["_id"]), "offer_rejected", {"offer_id": offer_id})
    return {"message": "Penawaran ditolak"}

@app.post("/api/orders/{order_id}/pay")
def pay_order(order_id: str, user: dict = Depends(require_role([UserRole.USER]))):
    order = get_participant_order(order_id, user)
    if order["status"] != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=400, detail="Pesanan belum siap dibayar")

    amount = float(order.get("final_price") or order.get("total_amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Total pembayaran tidak valid")

    wallets_collection.update_one(
        {"user_id": user["id"]},
        {"$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat(), "balance": 0}},
        upsert=True,
    )
    debit = wallets_collection.update_one(
        {"user_id": user["id"], "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}},
    )
    if debit.modified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Saldo wallet tidak mencukupi untuk melakukan pembayaran. Silakan top up terlebih dahulu.",
        )

    now = datetime.now(timezone.utc).isoformat()
    escrow_collection.insert_one({
        "order_id": str(order["_id"]),
        "user_id": user["id"],
        "mitra_id": order["mitra_id"],
        "amount": amount,
        "status": EscrowStatus.HOLD,
        "created_at": now,
    })
    record_wallet_transaction(
        user_id=user["id"],
        amount=amount,
        tx_type="debit",
        description=f"Pembayaran pesanan - {order['service_name']}",
        order_id=str(order["_id"]),
    )
    orders_collection.update_one(
        {"_id": order["_id"]},
        {
            "$set": {
                "final_price": amount,
                "total_amount": amount,
                "status": OrderStatus.PENDING,
                "paid_at": now,
                "updated_at": now,
            }
        },
    )
    if order.get("mitra_id"):
        create_notification(
            user_id=order["mitra_id"],
            notif_type="order_paid",
            title="Pesanan dibayar",
            body=f"{user['name']} telah membayar. Mohon konfirmasi pesanan.",
            order_id=str(order["_id"]),
        )
    broadcast_order_event(str(order["_id"]), "status", {"status": OrderStatus.PENDING})
    return {"message": "Pembayaran berhasil", "status": OrderStatus.PENDING, "amount": amount}

@app.put("/api/orders/{order_id}/status")
def update_order_status(order_id: str, status: str, user: dict = Depends(get_current_user)):
    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    role = user["role"]
    if role not in ("USER", "MITRA"):
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "USER" and order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "MITRA" and order["mitra_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    valid_statuses = [
        "CONFIRMED",
        "IN_PROGRESS",
        "AWAITING_USER_CONFIRMATION",
        "COMPLETED",
        "CANCELLED",
    ]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    current = order["status"]
    if current == status:
        return {"message": f"Order status is already {status}"}

    if status == "CANCELLED":
        cancellable_statuses = [
            OrderStatus.OPEN,
            OrderStatus.NEGOTIATING,
            OrderStatus.AWAITING_PAYMENT,
            OrderStatus.PENDING,
        ]
        if current not in cancellable_statuses:
            raise HTTPException(
                status_code=400,
                detail="Pesanan tidak dapat dibatalkan pada status ini",
            )
    elif status == "CONFIRMED":
        if role != "MITRA" or current != "PENDING":
            raise HTTPException(
                status_code=400,
                detail="Hanya mitra yang dapat menerima pesanan saat menunggu",
            )
    elif status == "IN_PROGRESS":
        if role != "MITRA" or current != "CONFIRMED":
            raise HTTPException(
                status_code=400,
                detail="Hanya mitra yang dapat memulai pengerjaan setelah dikonfirmasi",
            )
    elif status == "AWAITING_USER_CONFIRMATION":
        if role != "MITRA" or current != "IN_PROGRESS":
            raise HTTPException(
                status_code=400,
                detail="Hanya mitra yang dapat menandai selesai saat pekerjaan berlangsung",
            )
    elif status == "COMPLETED":
        if role != "USER" or current != "AWAITING_USER_CONFIRMATION":
            raise HTTPException(
                status_code=400,
                detail="Hanya pengguna yang dapat mengonfirmasi setelah mitra menandai pekerjaan selesai",
            )

    orders_collection.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    if status == "COMPLETED":
        escrow = escrow_collection.find_one({"order_id": order_id})
        if escrow and escrow.get("status") == EscrowStatus.HOLD:
            escrow_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": EscrowStatus.RELEASED}},
            )
            credit = escrow["amount"] * 0.85
            wallets_collection.update_one(
                {"user_id": order["mitra_id"]},
                {"$inc": {"balance": credit}},
            )
            record_wallet_transaction(
                user_id=order["mitra_id"],
                amount=credit,
                tx_type="credit",
                description="Pencairan escrow pesanan selesai",
                order_id=order_id,
            )
        if order.get("mitra_id"):
            users_collection.update_one(
                {"_id": ObjectId(order["mitra_id"])},
                {"$inc": {"mitra_profile.completed_orders": 1}},
            )
    elif status == "CANCELLED":
        escrow = escrow_collection.find_one({"order_id": order_id})
        if escrow and escrow.get("status") == EscrowStatus.HOLD:
            escrow_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": EscrowStatus.REFUNDED}},
            )
            wallets_collection.update_one(
                {"user_id": order["user_id"]},
                {"$inc": {"balance": escrow["amount"]}},
            )
            record_wallet_transaction(
                user_id=order["user_id"],
                amount=escrow["amount"],
                tx_type="credit",
                description="Refund pesanan dibatalkan",
                order_id=order_id,
            )

    broadcast_order_event(order_id, "status", {"status": status})
    return {"message": f"Order status updated to {status}"}

# Review endpoints
@app.post("/api/reviews")
def create_review(data: ReviewCreate, user: dict = Depends(require_role(["USER"]))):
    order = orders_collection.find_one({"_id": ObjectId(data.order_id), "user_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Can only review completed orders")
    
    existing = reviews_collection.find_one({"order_id": data.order_id})
    if existing:
        raise HTTPException(status_code=400, detail="Review already exists")
    
    review_data = {
        "order_id": data.order_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "mitra_id": order["mitra_id"],
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    reviews_collection.insert_one(review_data)
    
    # Update mitra rating
    mitra_reviews = list(reviews_collection.find({"mitra_id": order["mitra_id"]}))
    avg_rating = sum(r["rating"] for r in mitra_reviews) / len(mitra_reviews)
    users_collection.update_one(
        {"_id": ObjectId(order["mitra_id"])},
        {"$set": {"mitra_profile.rating": round(avg_rating, 1)}}
    )
    
    return {"message": "Review submitted"}

@app.get("/api/reviews/mitra/{mitra_id}")
def get_mitra_reviews(mitra_id: str):
    reviews = list(reviews_collection.find({"mitra_id": mitra_id}))
    return [serialize_doc(r) for r in reviews]


# Two-way ratings (post-completion)
def _avg(values: List[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


@app.post("/api/ratings/mitra")
def rate_mitra(data: MitraRatingCreate, user: dict = Depends(require_role(["USER"]))):
    if not ObjectId.is_valid(data.order_id):
        raise HTTPException(status_code=400, detail="Invalid order id")
    order = orders_collection.find_one({"_id": ObjectId(data.order_id), "user_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != OrderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Hanya pesanan selesai yang dapat dinilai")
    if mitra_ratings_collection.find_one({"order_id": data.order_id}):
        raise HTTPException(status_code=400, detail="Pesanan ini sudah dinilai")

    overall = _avg([data.quality, data.punctuality, data.friendliness, data.professionalism])
    now = datetime.now(timezone.utc).isoformat()
    mitra_ratings_collection.insert_one({
        "order_id": data.order_id,
        "mitra_id": order["mitra_id"],
        "user_id": user["id"],
        "user_name": user["name"],
        "quality": data.quality,
        "punctuality": data.punctuality,
        "friendliness": data.friendliness,
        "professionalism": data.professionalism,
        "overall": overall,
        "comment": data.comment,
        "created_at": now,
    })

    all_ratings = list(mitra_ratings_collection.find({"mitra_id": order["mitra_id"]}))
    avg_rating = _avg([r["overall"] for r in all_ratings])
    users_collection.update_one(
        {"_id": ObjectId(order["mitra_id"])},
        {"$set": {
            "mitra_profile.rating": avg_rating,
            "mitra_profile.review_count": len(all_ratings),
        }},
    )
    return {"message": "Penilaian mitra terkirim", "overall": overall}


@app.get("/api/ratings/mitra/{mitra_id}")
def get_mitra_ratings(mitra_id: str):
    ratings = list(mitra_ratings_collection.find({"mitra_id": mitra_id}).sort("created_at", -1))
    return [serialize_doc(r) for r in ratings]


@app.post("/api/ratings/user")
def rate_user(data: UserRatingCreate, user: dict = Depends(require_role(["MITRA"]))):
    if not ObjectId.is_valid(data.order_id):
        raise HTTPException(status_code=400, detail="Invalid order id")
    order = orders_collection.find_one({"_id": ObjectId(data.order_id), "mitra_id": user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != OrderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Hanya pesanan selesai yang dapat dinilai")
    if user_ratings_collection.find_one({"order_id": data.order_id}):
        raise HTTPException(status_code=400, detail="Pelanggan ini sudah dinilai")

    overall = _avg([data.payment, data.politeness, data.clarity, data.communication])
    now = datetime.now(timezone.utc).isoformat()
    user_ratings_collection.insert_one({
        "order_id": data.order_id,
        "user_id": order["user_id"],
        "mitra_id": user["id"],
        "mitra_name": user["name"],
        "payment": data.payment,
        "politeness": data.politeness,
        "clarity": data.clarity,
        "communication": data.communication,
        "overall": overall,
        "comment": data.comment,
        "created_at": now,
    })

    all_ratings = list(user_ratings_collection.find({"user_id": order["user_id"]}))
    avg_rating = _avg([r["overall"] for r in all_ratings])
    users_collection.update_one(
        {"_id": ObjectId(order["user_id"])},
        {"$set": {"user_rating": avg_rating, "user_rating_count": len(all_ratings)}},
    )
    return {"message": "Penilaian pelanggan terkirim", "overall": overall}


@app.get("/api/users/{user_id}/rating")
def get_user_rating(user_id: str, mitra: dict = Depends(require_role(["MITRA"]))):
    """User-side ratings are visible only to mitras, never to other users."""
    target = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    ratings = list(user_ratings_collection.find({"user_id": user_id}).sort("created_at", -1))
    completed_orders = orders_collection.count_documents(
        {"user_id": user_id, "status": OrderStatus.COMPLETED}
    )
    return {
        "user_id": user_id,
        "name": target.get("name"),
        "rating": target.get("user_rating", 0),
        "rating_count": target.get("user_rating_count", 0),
        "completed_orders": completed_orders,
        "ratings": [serialize_doc(r) for r in ratings],
    }

# Admin endpoints
@app.get("/api/admin/dashboard")
def get_admin_dashboard(user: dict = Depends(require_role(["ADMIN"]))):
    total_users = users_collection.count_documents({"role": "USER"})
    total_mitras = users_collection.count_documents({"role": "MITRA"})
    active_mitras = users_collection.count_documents({"role": "MITRA", "mitra_profile.is_online": True})
    total_orders = orders_collection.count_documents({})
    completed_orders = orders_collection.count_documents({"status": "COMPLETED"})
    pending_orders = orders_collection.count_documents(
        {
            "status": {
                "$in": [
                    "PENDING",
                    "CONFIRMED",
                    "IN_PROGRESS",
                    "AWAITING_USER_CONFIRMATION",
                ]
            }
        }
    )
    
    # Calculate GMV
    all_orders = list(orders_collection.find({"status": "COMPLETED"}))
    total_gmv = sum(o.get("total_amount", 0) for o in all_orders)
    
    # Escrow balance
    escrow_held = list(escrow_collection.find({"status": "HOLD"}))
    escrow_balance = sum(e.get("amount", 0) for e in escrow_held)
    
    return {
        "total_users": total_users,
        "total_mitras": total_mitras,
        "active_mitras": active_mitras,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders,
        "total_gmv": total_gmv,
        "escrow_balance": escrow_balance,
        "commission_revenue": total_gmv * 0.15
    }

@app.get("/api/admin/users")
def get_all_users(user: dict = Depends(require_role(["ADMIN"]))):
    users = list(users_collection.find({}, {"password": 0}))
    return [serialize_doc(u) for u in users]

@app.put("/api/admin/users/{user_id}/status")
def update_user_status(user_id: str, is_active: bool, admin: dict = Depends(require_role(["ADMIN"]))):
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": is_active}})
    return {"message": f"User {'activated' if is_active else 'suspended'}"}

@app.put("/api/admin/mitra/{mitra_id}/verify")
def verify_mitra(mitra_id: str, admin: dict = Depends(require_role(["ADMIN"]))):
    users_collection.update_one(
        {"_id": ObjectId(mitra_id), "role": "MITRA"},
        {"$set": {"mitra_profile.is_verified": True}}
    )
    return {"message": "Mitra verified"}

@app.get("/api/admin/escrow")
def get_escrow_list(admin: dict = Depends(require_role(["ADMIN"]))):
    escrows = list(escrow_collection.find())
    return [serialize_doc(e) for e in escrows]

# Notifications
@app.get("/api/notifications")
def get_notifications(user: dict = Depends(get_current_user)):
    notifications = list(notifications_collection.find({"user_id": user["id"]}).sort("created_at", -1).limit(30))
    return [serialize_doc(n) for n in notifications]


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification id")
    notifications_collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    return {"message": "Notification marked as read"}


@app.post("/api/notifications/read-all")
def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    notifications_collection.update_many(
        {"user_id": user["id"], "read": {"$ne": True}},
        {"$set": {"read": True}},
    )
    return {"message": "All notifications marked as read"}


# Realtime order channel (chat, offers, status). Polling remains the fallback.
def _ws_authenticate(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        return serialize_doc(user) if user else None
    except (JWTError, Exception):
        return None


@app.websocket("/api/ws/orders/{order_id}")
async def order_websocket(websocket: WebSocket, order_id: str, token: Optional[str] = None):
    user = _ws_authenticate(token)
    if not user or not ObjectId.is_valid(order_id):
        await websocket.close(code=1008)
        return

    order = orders_collection.find_one({"_id": ObjectId(order_id)})
    if not order:
        await websocket.close(code=1008)
        return
    role = user["role"]
    is_participant = (
        (role == UserRole.USER and order.get("user_id") == user["id"])
        or (role == UserRole.MITRA and order.get("mitra_id") == user["id"])
        or role == UserRole.ADMIN
    )
    if not is_participant:
        await websocket.close(code=1008)
        return

    await order_ws_manager.connect(order_id, websocket)
    try:
        await websocket.send_json({"event": "connected", "data": {"order_id": order_id}})
        while True:
            # Keep the connection alive; client pushes are not required (REST handles writes).
            await websocket.receive_text()
    except WebSocketDisconnect:
        await order_ws_manager.disconnect(order_id, websocket)
    except Exception:
        await order_ws_manager.disconnect(order_id, websocket)

# Seed data endpoint (for development — idempotent upserts; safe to call multiple times)
@app.post("/api/seed")
def seed_data():
    services = [
        {
            "catalog_key": "demo:cleaning:bersih_rumah",
            "name": "Bersih Rumah",
            "category": "cleaning",
            "description": "Jasa pembersihan rumah lengkap",
            "price": 150000,
            "duration_minutes": 120,
            "image_url": "https://images.pexels.com/photos/9462233/pexels-photo-9462233.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "is_active": True,
        },
        {
            "catalog_key": "demo:ac:service_ac",
            "name": "Service AC",
            "category": "ac",
            "description": "Service & cuci AC split/cassette",
            "price": 100000,
            "duration_minutes": 60,
            "image_url": "https://images.pexels.com/photos/5463581/pexels-photo-5463581.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "is_active": True,
        },
        {
            "catalog_key": "demo:plumbing:pipa",
            "name": "Perbaikan Pipa",
            "category": "plumbing",
            "description": "Perbaikan pipa bocor, WC mampet",
            "price": 200000,
            "duration_minutes": 90,
            "image_url": "https://images.pexels.com/photos/8486978/pexels-photo-8486978.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "is_active": True,
        },
        {
            "catalog_key": "demo:electrical:listrik",
            "name": "Instalasi Listrik",
            "category": "electrical",
            "description": "Pemasangan & perbaikan instalasi listrik",
            "price": 250000,
            "duration_minutes": 120,
            "image_url": "",
            "is_active": True,
        },
        {
            "catalog_key": "demo:moving:pindahan",
            "name": "Jasa Pindahan",
            "category": "moving",
            "description": "Pindahan rumah & angkut barang",
            "price": 500000,
            "duration_minutes": 240,
            "image_url": "",
            "is_active": True,
        },
        {
            "catalog_key": "demo:renovation:cat",
            "name": "Pengecatan",
            "category": "renovation",
            "description": "Jasa cat dinding interior/eksterior",
            "price": 350000,
            "duration_minutes": 180,
            "image_url": "",
            "is_active": True,
        },
    ]

    now = datetime.now(timezone.utc).isoformat()
    with _seed_lock:
        for svc in services:
            catalog_key = svc["catalog_key"]
            set_payload = {
                **svc,
                "is_active": True,
                "updated_at": now,
            }
            services_collection.update_one(
                {"catalog_key": catalog_key},
                {"$set": set_payload, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )

        if not users_collection.find_one({"email": "admin@suruahai.com"}):
            admin_data = {
                "email": "admin@suruahai.com",
                "password": hash_password("admin123"),
                "name": "Admin SuruAhai",
                "phone": "08123456789",
                "role": "ADMIN",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            users_collection.insert_one(admin_data)

    return {"message": "Seed data created successfully"}


