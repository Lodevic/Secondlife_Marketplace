"""
Script uji coba otomatis backend SecondLife.
Jalankan: python test_flow.py

Sebelum jalankan, isi dulu bagian CONFIG di bawah sesuai data yang ada
di database kamu (akun test, address_id, product_id, dll).
"""

import requests

BASE_URL = "http://localhost:5000"

# ======================= CONFIG — ISI DULU =======================
BUYER_EMAIL = "devic@tes.com"
BUYER_PASSWORD = "password123"

SELLER_EMAIL = "seller@tes.com"
SELLER_PASSWORD = "password123"

ADMIN_EMAIL = "adminwxqz@test.com"       # ganti sesuai akun admin tes di Neon
ADMIN_PASSWORD = "Password123"

PRODUCT_ID = 1                        # produk yang akan diuji
ADDRESS_ID = 2                        # address milik buyer (buat manual dulu via SQL kalau belum ada)
# ===================================================================


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    print(f"[LOGIN] {email} -> {r.status_code}")
    if r.status_code != 200:
        print("    ", r.json())
        return None
    return r.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def step(name, method, url, token=None, json=None):
    """Helper: panggil endpoint, print hasilnya, return response."""
    headers = auth_header(token) if token else {}
    r = requests.request(method, f"{BASE_URL}{url}", json=json, headers=headers)
    print(f"[{name}] {method} {url} -> {r.status_code}")
    try:
        body = r.json()
        print("    ", body)
    except Exception:
        body = None
    return r, body


def main():
    print("=== 1. LOGIN ===")
    buyer_token = login(BUYER_EMAIL, BUYER_PASSWORD)
    seller_token = login(SELLER_EMAIL, SELLER_PASSWORD)
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)

    if not (buyer_token and seller_token):
        print("Login buyer/seller gagal, hentikan.")
        return

    print("\n=== 2. BUYER: TAMBAH KE CART ===")
    step("ADD_CART", "POST", "/api/cart/items", buyer_token,
         json={"product_id": PRODUCT_ID, "quantity": 1})

    print("\n=== 3. BUYER: CEK CART ===")
    step("GET_CART", "GET", "/api/cart", buyer_token)

    print("\n=== 4. BUYER: CHECKOUT ===")
    r, body = step("CHECKOUT", "POST", "/api/orders/checkout", buyer_token,
                    json={"address_id": ADDRESS_ID, "payment_method": "transfer"})

    if r.status_code != 201 or not body:
        print("Checkout gagal, hentikan.")
        return

    order = body[0] if isinstance(body, list) else body
    order_id = order["id"]
    payment_id = order.get("payment", {}).get("id") or order.get("payment_id")
    print(f"    -> order_id={order_id}, payment_id={payment_id}")

    if admin_token and payment_id:
        print("\n=== 5. ADMIN: KONFIRMASI PEMBAYARAN ===")
        step("CONFIRM_PAYMENT", "POST", f"/api/payments/{payment_id}/confirm", admin_token)
    else:
        print("\n[SKIP] Admin token atau payment_id tidak ada, lewati konfirmasi pembayaran.")

    print("\n=== 6. SELLER: PROSES ORDER ===")
    step("PROCESS_ORDER", "POST", f"/api/orders/{order_id}/process", seller_token)

    print("\n=== 7. SELLER: KIRIM BARANG ===")
    step("SHIP_ORDER", "POST", f"/api/orders/{order_id}/ship", seller_token, json={
        "courier": "JNE",
        "tracking_number": "TEST123456",
        "shipping_method": "regular",
    })

    print("\n=== 8. BUYER: KONFIRMASI DITERIMA ===")
    step("RECEIVE_ORDER", "POST", f"/api/orders/{order_id}/receive", buyer_token)

    print("\n=== 9. BUYER: SELESAIKAN ORDER ===")
    step("COMPLETE_ORDER", "POST", f"/api/orders/{order_id}/complete", buyer_token)

    print("\n=== 10. BUYER: LIHAT DETAIL ORDER (untuk ambil order_item_id) ===")
    r, order_detail = step("GET_ORDER_DETAIL", "GET", f"/api/orders/{order_id}", buyer_token)

    order_item_id = None
    if order_detail and "items" in order_detail and len(order_detail["items"]) > 0:
        order_item_id = order_detail["items"][0]["id"]

    if order_item_id:
        print("\n=== 11. BUYER: BERI REVIEW ===")
        step("CREATE_REVIEW", "POST", "/api/reviews", buyer_token, json={
            "order_item_id": order_item_id,
            "product_rating": 5,
            "seller_rating": 5,
            "shipping_rating": 4,
            "comment": "Barang sesuai deskripsi, pengiriman cepat.",
        })
    else:
        print("\n[SKIP] order_item_id tidak ditemukan, lewati review.")

    print("\n=== SELESAI ===")


if __name__ == "__main__":
    main()
