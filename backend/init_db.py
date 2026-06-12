"""One-off script to provision SuruAhai collections and indexes on MongoDB Atlas.

Run from the backend/ folder:  python init_db.py
Reads MONGO_URL and DB_NAME from the local .env (never committed).
Safe to re-run: collection/index creation is idempotent.
"""

import os

import certifi
from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.errors import PyMongoError

# Collections used by server.py
COLLECTIONS = [
    "users",
    "services",
    "orders",
    "wallets",
    "escrow",
    "reviews",
    "notifications",
    "wallet_transactions",
    "order_messages",
    "offers",
    "mitra_ratings",
    "user_ratings",
]

# (collection, keys, unique) – keys mirror the lookups performed in server.py
INDEXES = [
    ("users", [("email", ASCENDING)], True),
    ("services", [("catalog_key", ASCENDING)], True),
    ("wallets", [("user_id", ASCENDING)], True),
    ("orders", [("user_id", ASCENDING)], False),
    ("orders", [("mitra_id", ASCENDING)], False),
    ("orders", [("status", ASCENDING)], False),
    ("order_messages", [("order_id", ASCENDING)], False),
    ("wallet_transactions", [("user_id", ASCENDING)], False),
    ("escrow", [("order_id", ASCENDING)], False),
    ("reviews", [("mitra_id", ASCENDING)], False),
    ("notifications", [("user_id", ASCENDING)], False),
    ("offers", [("order_id", ASCENDING)], False),
    ("mitra_ratings", [("mitra_id", ASCENDING)], False),
    ("mitra_ratings", [("order_id", ASCENDING)], True),
    ("user_ratings", [("user_id", ASCENDING)], False),
    ("user_ratings", [("order_id", ASCENDING)], True),
    ("users", [("mitra_profile.service_offerings.category", ASCENDING)], False),
]


def main() -> int:
    load_dotenv()

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "suruahai")

    if not mongo_url:
        print("MONGO_URL is not configured in .env")
        return 1

    client = MongoClient(
        mongo_url,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )

    try:
        client.admin.command("ping")
        print(f"Connected to Atlas. Target database: {db_name}\n")

        db = client[db_name]
        existing = set(db.list_collection_names())

        print("Collections:")
        for name in COLLECTIONS:
            if name in existing:
                print(f"  - {name} (already exists)")
            else:
                db.create_collection(name)
                print(f"  - {name} (created)")

        print("\nIndexes:")
        for coll, keys, unique in INDEXES:
            idx_name = db[coll].create_index(keys, unique=unique)
            flag = " unique" if unique else ""
            print(f"  - {coll}.{idx_name}{flag}")

        print("\nDone. All collections and indexes are in place.")
        return 0
    except PyMongoError as exc:
        print(f"MongoDB operation failed: {exc.__class__.__name__}: {exc}")
        print("Check Atlas Network Access (whitelist your IP) and credentials.")
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
