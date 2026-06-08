from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo import MongoClient
from bson import ObjectId
import os
import logging
import threading
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
client = MongoClient(MONGO_URL)
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

class MitraProfile(BaseModel):
    services: List[str] = []
    description: Optional[str] = None
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
    mitra_id: str
    scheduled_date: str
    scheduled_time: str
    address: str
    notes: Optional[str] = None

class ReviewCreate(BaseModel):
    order_id: str
    rating: int = Field(ge=1, le=5)
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

def record_wallet_transaction(user_id: str, amount: float, tx_type: str, description: str, order_id: Optional[str] = None):
    wallet_transactions_collection.insert_one({
        "user_id": user_id,
        "amount": amount,
        "type": tx_type,
        "description": description,
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

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
            "services": [],
            "description": "",
            "bank_name": "",
            "bank_account": "",
            "is_verified": False,
            "is_online": False,
            "rating": 0,
            "total_orders": 0,
            "completion_rate": 100
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
        query["mitra_profile.services"] = category
    if is_online is not None:
        query["mitra_profile.is_online"] = is_online
    
    mitras = list(users_collection.find(query, {"password": 0}))
    return [serialize_doc(m) for m in mitras]

@app.get("/api/mitra/dashboard")
def get_mitra_dashboard(user: dict = Depends(require_role(["MITRA"]))):
    total_orders = orders_collection.count_documents({"mitra_id": user["id"]})
    completed_orders = orders_collection.count_documents({"mitra_id": user["id"], "status": "COMPLETED"})
    pending_orders = orders_collection.count_documents({"mitra_id": user["id"], "status": {"$in": ["PENDING", "CONFIRMED"]}})
    
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
    merged = {**current, **data.dict()}
    # Verification status is admin-only; never take it from the client payload.
    merged["is_verified"] = current.get("is_verified", False)
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
    # Validate mitra
    mitra = users_collection.find_one({"_id": ObjectId(data.mitra_id), "role": "MITRA"})
    if not mitra:
        raise HTTPException(status_code=404, detail="Mitra not found")
    
    # Get service details
    service = services_collection.find_one({"_id": ObjectId(data.service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    category = service.get("category")
    mitra_services = (mitra.get("mitra_profile") or {}).get("services") or []
    if category and category not in mitra_services:
        raise HTTPException(
            status_code=400,
            detail="Mitra ini tidak melayani kategori layanan yang dipilih",
        )

    total_amount = float(service.get("price", 0) or 0)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Harga layanan tidak valid")

    user_id = user["id"]
    wallets_collection.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat(), "balance": 0}},
        upsert=True,
    )

    order_data = {
        "user_id": user["id"],
        "user_name": user["name"],
        "mitra_id": data.mitra_id,
        "mitra_name": mitra["name"],
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_category": service["category"],
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "address": data.address,
        "notes": data.notes,
        "total_amount": total_amount,
        "status": OrderStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    result = orders_collection.insert_one(order_data)
    order_id = str(result.inserted_id)

    escrow_collection.insert_one({
        "order_id": order_id,
        "user_id": user["id"],
        "mitra_id": data.mitra_id,
        "amount": total_amount,
        "status": EscrowStatus.HOLD,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    debit = wallets_collection.update_one(
        {"user_id": user_id, "balance": {"$gte": total_amount}},
        {"$inc": {"balance": -total_amount}},
    )
    if debit.modified_count == 0:
        escrow_collection.delete_one({"order_id": order_id})
        orders_collection.delete_one({"_id": ObjectId(order_id)})
        raise HTTPException(
            status_code=400,
            detail="Saldo wallet tidak mencukupi untuk melakukan pemesanan. Silakan top up terlebih dahulu.",
        )

    record_wallet_transaction(
        user_id=user_id,
        amount=total_amount,
        tx_type="debit",
        description=f"Pembayaran pesanan — {service['name']}",
        order_id=order_id,
    )

    return {"id": order_id, "message": "Order created", "status": "PENDING"}

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
        if current != "PENDING":
            raise HTTPException(
                status_code=400,
                detail="Pesanan hanya bisa dibatalkan saat menunggu konfirmasi mitra",
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
    notifications = list(notifications_collection.find({"user_id": user["id"]}).sort("created_at", -1).limit(20))
    return [serialize_doc(n) for n in notifications]

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

if __name__ == "__main__":
    import uvicorn

    # String import enables --reload-style auto-reload on file changes (dev).
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
