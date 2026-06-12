"""End-to-end smoke test for the marketplace flow against a running server.

Uses only the standard library (urllib) so it has no extra dependencies and is
immune to TestClient/httpx version mismatches.

Set BASE_URL (default http://127.0.0.1:8011). Start a server first, e.g.:
    python -m uvicorn server:app --port 8011

Exercises: OPEN order, mitra listing + distance, select-mitra, two-way offers,
supersede, accept -> AWAITING_PAYMENT, chat lock, payment, status progression,
two-way ratings + visibility, chat text + image.
"""

import os
import sys
import json
import uuid
import base64
import urllib.request
import urllib.error

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8011")
results = []


def req(method, path, token=None, body=None):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    print(f"[{'PASS' if condition else 'FAIL'}] {name}" + (f" :: {detail}" if detail else ""))
    return condition


def main():
    req("POST", "/api/seed")
    uniq = uuid.uuid4().hex[:8]

    st, body = req("POST", "/api/auth/register", body={
        "email": f"user_{uniq}@test.com", "password": "secret123", "name": "Test User", "phone": "08120000000", "role": "USER"
    })
    if not check("register user", st == 200 and body and body.get("token"), f"status={st}"):
        return finish()
    user_token = body["token"]
    user_id = body["user"]["id"]

    st, body = req("POST", "/api/auth/login", body={"email": "mitra@suruahai.com", "password": "mitra123"})
    if not check("login seeded mitra", st == 200, f"status={st}"):
        return finish()
    mitra_token = body["token"]
    mitra_id = body["user"]["id"]

    st, services = req("GET", "/api/services")
    cleaning = next((s for s in services if s.get("category") == "cleaning"), None)
    check("cleaning service exists", cleaning is not None)

    st, body = req("POST", "/api/orders", token=user_token, body={
        "service_id": cleaning["id"], "scheduled_date": "2026-07-01", "scheduled_time": "10:00",
        "address": "Jl. Testing No. 1, Jakarta", "description": "Deep cleaning 2 kamar",
        "location": {"lat": -6.20, "lng": 106.81, "address": "Jakarta Pusat"}
    })
    check("create OPEN order", st == 200 and body.get("status") == "OPEN", f"status={st} body={str(body)[:120]}")
    order_id = body["id"]

    st, mitras = req("GET", f"/api/orders/{order_id}/mitras?sort=distance", token=user_token)
    found = next((m for m in mitras if m["id"] == mitra_id), None) if isinstance(mitras, list) else None
    check("mitra list returns candidates", st == 200 and isinstance(mitras, list) and len(mitras) > 0, f"count={len(mitras) if isinstance(mitras, list) else mitras}")
    check("candidate enriched (base_price + distance)", found and found.get("base_price") is not None and found.get("distance_km") is not None,
          f"base_price={found and found.get('base_price')} distance={found and found.get('distance_km')}")

    st, body = req("POST", f"/api/orders/{order_id}/select-mitra", token=user_token, body={"mitra_id": mitra_id})
    check("select mitra -> NEGOTIATING", st == 200 and body.get("status") == "NEGOTIATING", f"status={st} body={str(body)[:120]}")

    st, _ = req("POST", f"/api/orders/{order_id}/messages", token=user_token, body={"message": "Halo, bisa nego?", "message_type": "TEXT"})
    check("user chat text", st == 200)

    tiny_png = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 32).decode()
    st, body = req("POST", f"/api/orders/{order_id}/messages", token=user_token, body={"message_type": "IMAGE", "image_data": tiny_png})
    check("user chat image", st == 200 and body.get("message_type") == "IMAGE", f"status={st}")

    st, body = req("POST", f"/api/orders/{order_id}/offers", token=user_token, body={"amount": 80000, "message": "Tawaran saya"})
    check("user creates offer", st == 200 and body.get("status") == "PENDING", f"status={st} body={str(body)[:120]}")
    offer_id = body["id"]

    st, _ = req("POST", f"/api/offers/{offer_id}/accept", token=user_token)
    check("user cannot accept own offer", st == 400, f"status={st}")

    st, body = req("POST", f"/api/orders/{order_id}/offers", token=mitra_token, body={"amount": 95000})
    check("mitra counter offer", st == 200, f"status={st}")
    mitra_offer_id = body["id"]

    st, offers = req("GET", f"/api/orders/{order_id}/offers", token=user_token)
    old = next((o for o in offers if o["id"] == offer_id), None)
    check("old offer superseded", old and old["status"] == "SUPERSEDED", f"status={old and old['status']}")

    st, body = req("POST", f"/api/offers/{mitra_offer_id}/accept", token=user_token)
    check("accept offer -> AWAITING_PAYMENT", st == 200 and body.get("status") == "AWAITING_PAYMENT", f"status={st} body={str(body)[:160]}")

    st, _ = req("POST", f"/api/orders/{order_id}/messages", token=user_token, body={"message": "masih bisa?", "message_type": "TEXT"})
    check("chat locked after deal", st == 400, f"status={st}")

    req("POST", "/api/wallet/topup", token=user_token, body={"amount": 200000})
    st, body = req("POST", f"/api/orders/{order_id}/pay", token=user_token)
    check("pay -> PENDING", st == 200 and body.get("status") == "PENDING", f"status={st} body={str(body)[:160]}")

    for nxt, tok in [("CONFIRMED", mitra_token), ("IN_PROGRESS", mitra_token), ("AWAITING_USER_CONFIRMATION", mitra_token), ("COMPLETED", user_token)]:
        st, body = req("PUT", f"/api/orders/{order_id}/status?status={nxt}", token=tok)
        check(f"status -> {nxt}", st == 200, f"status={st} {str(body)[:100]}")

    st, body = req("POST", "/api/ratings/mitra", token=user_token, body={
        "order_id": order_id, "quality": 5, "punctuality": 4, "friendliness": 5, "professionalism": 5, "comment": "Mantap"
    })
    check("user rates mitra", st == 200, f"status={st} {str(body)[:120]}")

    st, body = req("POST", "/api/ratings/user", token=mitra_token, body={
        "order_id": order_id, "payment": 5, "politeness": 5, "clarity": 4, "communication": 5
    })
    check("mitra rates user", st == 200, f"status={st} {str(body)[:120]}")

    st, _ = req("GET", f"/api/users/{user_id}/rating", token=user_token)
    check("user cannot view user-ratings", st == 403, f"status={st}")
    st, body = req("GET", f"/api/users/{user_id}/rating", token=mitra_token)
    check("mitra can view user-ratings", st == 200 and body.get("rating_count", 0) >= 1, f"status={st} {str(body)[:120]}")

    return finish()


def finish():
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\nSUMMARY: {passed}/{total} passed")
    failed = [n for n, ok, _ in results if not ok]
    if failed:
        print("FAILED: " + ", ".join(failed))
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
