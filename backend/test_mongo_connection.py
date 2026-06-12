import os

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


def main() -> int:
    load_dotenv()

    mongo_url = os.environ.get("MONGO_URL")
    print(f"MONGO_URL set: {'yes' if mongo_url else 'no'}")
    print(f"DB_NAME set: {'yes' if os.environ.get('DB_NAME') else 'no'}")

    if not mongo_url:
        print("MongoDB ping skipped: MONGO_URL is not configured.")
        return 1

    client = MongoClient(
        mongo_url,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
    )
    try:
        client.admin.command("ping")
    except PyMongoError as exc:
        print(f"MongoDB ping failed: {exc.__class__.__name__}")
        print("Check Atlas Network Access, local firewall/proxy, and TLS settings.")
        return 1
    finally:
        client.close()

    print("MongoDB ping succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
