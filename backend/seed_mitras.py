"""Seed dummy mitra accounts for local/testing. Safe to re-run (upsert by email)."""

import os
from datetime import datetime, timezone

import certifi
from dotenv import load_dotenv
from passlib.context import CryptContext
from pymongo import MongoClient

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DUMMY_MITRAS = [
    {
        "email": "mitra@suruahai.com",
        "password": "mitra123",
        "name": "Mitra Demo SuruAhai",
        "phone": "08111111111",
        "bio": "Serbabisa untuk kebersihan dan servis AC.",
        "service_area": "Jakarta Pusat, Jakarta Selatan",
        "location": {"lat": -6.2000, "lng": 106.8166, "address": "Jakarta Pusat"},
        "rating": 4.8,
        "review_count": 24,
        "total_orders": 24,
        "completed_orders": 24,
        "wallet_balance": 500000,
        "service_offerings": [
            {
                "category": "cleaning",
                "base_price": 115000,
                "tools": ["Vacuum Cleaner", "Disinfektan"],
                "description": "Pembersihan rumah, kamar, dapur dan kamar mandi secara menyeluruh.",
            },
            {
                "category": "ac",
                "base_price": 285000,
                "tools": ["Vacuum Pump", "Freon Gauge", "Jet Cleaner"],
                "description": "Service AC, cuci AC, dan isi freon.",
            },
        ],
    },
    {
        "email": "budi.cleaning@suruahai.com",
        "password": "mitra123",
        "name": "Budi Santoso",
        "phone": "08122222222",
        "bio": "Deep cleaning bergaransi, alat premium.",
        "service_area": "Jakarta Barat, Tangerang",
        "location": {"lat": -6.1675, "lng": 106.7510, "address": "Jakarta Barat"},
        "rating": 4.9,
        "review_count": 56,
        "total_orders": 56,
        "completed_orders": 56,
        "wallet_balance": 750000,
        "service_offerings": [
            {
                "category": "cleaning",
                "base_price": 145000,
                "tools": ["Vacuum Cleaner", "Steam Cleaner", "Disinfektan Premium"],
                "description": "Spesialis bersih rumah dan deep cleaning area Jakarta.",
            },
        ],
    },
    {
        "email": "eko.cleaning@suruahai.com",
        "password": "mitra123",
        "name": "Eko Saputra",
        "phone": "08128888001",
        "bio": "Harga hemat, hasil tetap rapi.",
        "service_area": "Jakarta Pusat, Jakarta Timur",
        "location": {"lat": -6.1865, "lng": 106.8450, "address": "Jakarta Pusat"},
        "rating": 4.3,
        "review_count": 18,
        "total_orders": 18,
        "completed_orders": 18,
        "wallet_balance": 180000,
        "service_offerings": [
            {
                "category": "cleaning",
                "base_price": 75000,
                "tools": ["Sapu", "Pel", "Disinfektan"],
                "description": "General cleaning rumah kecil & kost, cocok untuk budget terbatas.",
            },
        ],
    },
    {
        "email": "maya.cleaning@suruahai.com",
        "password": "mitra123",
        "name": "Maya Lestari",
        "phone": "08128888002",
        "bio": "Bersih cepat, tepat waktu.",
        "service_area": "Jakarta Selatan, Depok",
        "location": {"lat": -6.2780, "lng": 106.7980, "address": "Jakarta Selatan"},
        "rating": 4.6,
        "review_count": 31,
        "total_orders": 31,
        "completed_orders": 31,
        "wallet_balance": 240000,
        "service_offerings": [
            {
                "category": "cleaning",
                "base_price": 98000,
                "tools": ["Vacuum Cleaner", "Lap Microfiber"],
                "description": "Bersih rutin apartemen & rumah 2–3 kamar.",
            },
        ],
    },
    {
        "email": "citra.cleaning@suruahai.com",
        "password": "mitra123",
        "name": "Citra Dewi",
        "phone": "08128888003",
        "bio": "Premium home spa cleaning.",
        "service_area": "Jakarta Barat, Tangerang Selatan",
        "location": {"lat": -6.1880, "lng": 106.7350, "address": "Jakarta Barat"},
        "rating": 4.95,
        "review_count": 72,
        "total_orders": 72,
        "completed_orders": 72,
        "wallet_balance": 890000,
        "service_offerings": [
            {
                "category": "cleaning",
                "base_price": 185000,
                "tools": ["Steam Cleaner", "Vacuum HEPA", "Aromaterapi"],
                "description": "Deep cleaning premium + sanitasi area dapur & kamar mandi.",
            },
        ],
    },
    {
        "email": "andi.ac@suruahai.com",
        "password": "mitra123",
        "name": "Andi Wijaya",
        "phone": "08133333333",
        "bio": "Teknisi AC bersertifikat, garansi servis 7 hari.",
        "service_area": "Jakarta Selatan, Depok",
        "location": {"lat": -6.2615, "lng": 106.8106, "address": "Jakarta Selatan"},
        "rating": 4.7,
        "review_count": 41,
        "total_orders": 41,
        "completed_orders": 41,
        "wallet_balance": 320000,
        "service_offerings": [
            {
                "category": "ac",
                "base_price": 90000,
                "tools": ["Jet Cleaner", "Manifold Gauge", "Vacuum Pump"],
                "description": "Teknisi AC berpengalaman 8 tahun, service split & cassette.",
            },
        ],
    },
    {
        "email": "rio.ac@suruahai.com",
        "password": "mitra123",
        "name": "Rio Hidayat",
        "phone": "08138888001",
        "bio": "Cuci AC express, datang hari yang sama.",
        "service_area": "Jakarta Pusat, Jakarta Utara",
        "location": {"lat": -6.1550, "lng": 106.8200, "address": "Jakarta Pusat"},
        "rating": 4.5,
        "review_count": 27,
        "total_orders": 27,
        "completed_orders": 27,
        "wallet_balance": 210000,
        "service_offerings": [
            {
                "category": "ac",
                "base_price": 125000,
                "tools": ["Jet Cleaner", "Cover AC", "Vacuum"],
                "description": "Cuci AC standar ½–1 PK, termasuk cek freon dasar.",
            },
        ],
    },
    {
        "email": "bayu.ac@suruahai.com",
        "password": "mitra123",
        "name": "Bayu Nugroho",
        "phone": "08138888002",
        "bio": "Spesialis AC inverter & cassette.",
        "service_area": "Jakarta Selatan, BSD",
        "location": {"lat": -6.3010, "lng": 106.6650, "address": "Tangerang Selatan"},
        "rating": 4.85,
        "review_count": 63,
        "total_orders": 63,
        "completed_orders": 63,
        "wallet_balance": 540000,
        "service_offerings": [
            {
                "category": "ac",
                "base_price": 320000,
                "tools": ["Vacuum Pump", "Manifold Digital", "Leak Detector"],
                "description": "Service AC premium, isi freon R32/R410A, unit besar & cassette.",
            },
        ],
    },
    {
        "email": "rina.plumbing@suruahai.com",
        "password": "mitra123",
        "name": "Rina Kusuma",
        "phone": "08144444444",
        "bio": "Tukang pipa wanita profesional, rapi dan bersih.",
        "service_area": "Jakarta Timur",
        "location": {"lat": -6.2250, "lng": 106.9004, "address": "Jakarta Timur"},
        "rating": 4.6,
        "review_count": 33,
        "total_orders": 33,
        "completed_orders": 33,
        "wallet_balance": 280000,
        "service_offerings": [
            {
                "category": "plumbing",
                "base_price": 135000,
                "tools": ["Pipe Wrench", "Plunger", "Drain Snake"],
                "description": "Ahli perbaikan pipa bocor, WC mampet, dan instalasi keran.",
            },
        ],
    },
    {
        "email": "tono.plumbing@suruahai.com",
        "password": "mitra123",
        "name": "Tono Wibowo",
        "phone": "08148888001",
        "bio": "Pipa & sanitasi 24 jam.",
        "service_area": "Jakarta Barat, Tangerang",
        "location": {"lat": -6.1780, "lng": 106.7280, "address": "Jakarta Barat"},
        "rating": 4.4,
        "review_count": 19,
        "total_orders": 19,
        "completed_orders": 19,
        "wallet_balance": 195000,
        "service_offerings": [
            {
                "category": "plumbing",
                "base_price": 210000,
                "tools": ["Pipe Threader", "Pressure Tester", "Drain Camera"],
                "description": "Instalasi pipa baru, perbaikan bocor kompleks, dan saluran air.",
            },
        ],
    },
    {
        "email": "dedi.electrical@suruahai.com",
        "password": "mitra123",
        "name": "Dedi Pratama",
        "phone": "08155555555",
        "bio": "Listrik aman sesuai standar PUIL.",
        "service_area": "Jakarta Utara",
        "location": {"lat": -6.1214, "lng": 106.7741, "address": "Jakarta Utara"},
        "rating": 4.5,
        "review_count": 29,
        "total_orders": 29,
        "completed_orders": 29,
        "wallet_balance": 410000,
        "service_offerings": [
            {
                "category": "electrical",
                "base_price": 155000,
                "tools": ["Multimeter", "Tang Ampere", "Obeng Set"],
                "description": "Instalasi listrik rumah, perbaikan stop kontak & MCB.",
            },
        ],
    },
    {
        "email": "wawan.electrical@suruahai.com",
        "password": "mitra123",
        "name": "Wawan Kurnia",
        "phone": "08158888001",
        "bio": "Murah untuk perbaikan ringan.",
        "service_area": "Jakarta Timur, Bekasi",
        "location": {"lat": -6.2380, "lng": 106.9520, "address": "Bekasi"},
        "rating": 4.2,
        "review_count": 14,
        "total_orders": 14,
        "completed_orders": 14,
        "wallet_balance": 120000,
        "service_offerings": [
            {
                "category": "electrical",
                "base_price": 85000,
                "tools": ["Tester Listrik", "Tang Potong", "Isolasi Set"],
                "description": "Ganti stop kontak, lampu mati, dan kabel putus ringan.",
            },
        ],
    },
    {
        "email": "siti.moving@suruahai.com",
        "password": "mitra123",
        "name": "Siti Aminah",
        "phone": "08166666666",
        "bio": "Tim pindahan cekatan, packing aman.",
        "service_area": "Jabodetabek",
        "location": {"lat": -6.1751, "lng": 106.8650, "address": "Jakarta Timur"},
        "rating": 4.8,
        "review_count": 38,
        "total_orders": 38,
        "completed_orders": 38,
        "wallet_balance": 620000,
        "service_offerings": [
            {
                "category": "moving",
                "base_price": 380000,
                "tools": ["Truk Box", "Bubble Wrap", "Troli"],
                "description": "Jasa pindahan rumah & kantor dengan tim profesional.",
            },
        ],
    },
    {
        "email": "joko.moving@suruahai.com",
        "password": "mitra123",
        "name": "Joko Susilo",
        "phone": "08168888001",
        "bio": "Pindahan kost & apartemen studio.",
        "service_area": "Jakarta Selatan, Depok",
        "location": {"lat": -6.3920, "lng": 106.8230, "address": "Depok"},
        "rating": 4.55,
        "review_count": 21,
        "total_orders": 21,
        "completed_orders": 21,
        "wallet_balance": 340000,
        "service_offerings": [
            {
                "category": "moving",
                "base_price": 275000,
                "tools": ["Pickup", "Kardus", "Stretch Wrap"],
                "description": "Pindahan ringan kost/studio, max 1 pickup load.",
            },
        ],
    },
    {
        "email": "agus.renovation@suruahai.com",
        "password": "mitra123",
        "name": "Agus Firmansyah",
        "phone": "08177777777",
        "bio": "Cat rapi tanpa belang, hasil halus.",
        "service_area": "Jakarta Selatan, Bekasi",
        "location": {"lat": -6.2444, "lng": 106.8000, "address": "Jakarta Selatan"},
        "rating": 4.4,
        "review_count": 22,
        "total_orders": 22,
        "completed_orders": 22,
        "wallet_balance": 150000,
        "service_offerings": [
            {
                "category": "renovation",
                "base_price": 265000,
                "tools": ["Roller Set", "Kompresor Cat", "Scaffolding"],
                "description": "Spesialis pengecatan interior & eksterior, finishing rapi.",
            },
        ],
    },
    {
        "email": "linda.renovation@suruahai.com",
        "password": "mitra123",
        "name": "Linda Anggraini",
        "phone": "08178888001",
        "bio": "Renovasi ringan & patch dinding.",
        "service_area": "Jakarta Barat, Tangerang",
        "location": {"lat": -6.1920, "lng": 106.7120, "address": "Tangerang"},
        "rating": 4.65,
        "review_count": 17,
        "total_orders": 17,
        "completed_orders": 17,
        "wallet_balance": 98000,
        "service_offerings": [
            {
                "category": "renovation",
                "base_price": 195000,
                "tools": ["Spatula Set", "Cat Dulux", "Sandpaper"],
                "description": "Cat ulang 1–2 ruangan, perbaikan retak dinding kecil.",
            },
        ],
    },
]


def main() -> int:
    load_dotenv()
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "suruahai")
    if not mongo_url:
        print("MONGO_URL tidak ditemukan di .env")
        return 1

    client = MongoClient(mongo_url, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=15000)
    db = client[db_name]
    users = db["users"]
    wallets = db["wallets"]
    now = datetime.now(timezone.utc).isoformat()

    created = 0
    updated = 0

    for m in DUMMY_MITRAS:
        existing = users.find_one({"email": m["email"]})
        user_doc = {
            "email": m["email"],
            "password": hash_password(m["password"]),
            "name": m["name"],
            "phone": m["phone"],
            "role": "MITRA",
            "is_active": True,
            "mitra_profile": {
                "service_offerings": m["service_offerings"],
                "bio": m["bio"],
                "photo_url": "",
                "service_area": m["service_area"],
                "location": m["location"],
                "bank_name": "BCA",
                "bank_account": f"123456789{m['phone'][-4:]}",
                "is_verified": True,
                "is_online": True,
                "rating": m["rating"],
                "review_count": m["review_count"],
                "total_orders": m["total_orders"],
                "completed_orders": m["completed_orders"],
                "completion_rate": 98,
                "response_time_stats": {"total_minutes": 0.0, "sample_count": 0},
                "avg_response_time_minutes": None,
            },
            "updated_at": now,
        }

        if existing:
            users.update_one(
                {"_id": existing["_id"]},
                {"$set": {k: v for k, v in user_doc.items() if k != "email"}},
            )
            user_id = str(existing["_id"])
            updated += 1
            action = "updated"
        else:
            user_doc["created_at"] = now
            result = users.insert_one(user_doc)
            user_id = str(result.inserted_id)
            created += 1
            action = "created"

        wallets.update_one(
            {"user_id": user_id},
            {
                "$set": {"balance": m["wallet_balance"]},
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        prices = ", ".join(f"{o['category']} Rp{o['base_price']:,}".replace(",", ".") for o in m["service_offerings"])
        print(f"  [{action}] {m['name']} | {prices}")

    client.close()
    print(f"\nSelesai: {created} baru, {updated} diperbarui. Password semua mitra: mitra123")
    return 0


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


if __name__ == "__main__":
    raise SystemExit(main())
