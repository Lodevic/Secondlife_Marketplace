"""
Skrip penambah data uji SecondLife (supaya dashboard seller/admin terlihat ramai).

Cara pakai:
1. Terminal 1 (folder backend, venv aktif): python -m flask run
2. Terminal 2 (folder backend, venv aktif): python test_seed_data.py

Skrip ini HANYA memakai endpoint API yang sudah ada (cart, checkout, payment,
order, review, offer, report). Tidak mengubah database secara manual.

Catatan penting:
- Setiap order mengurangi stok produk 1. Produk yang stoknya habis jadi "sold"
  dan dilewati. Skrip mencetak stok sebelum jalan, supaya kamu tahu sisa data.
- Semua order dibuat HARI INI, jadi grafik tren tetap menumpuk di hari ini
  (dashboard mengelompokkan berdasarkan tanggal order dibuat).
- Isi CONFIG sesuai data di database kamu.
"""

import requests

BASE_URL = "http://localhost:5000"

# ======================= CONFIG - ISI DULU =======================
BUYER_EMAIL = "devic@tes.com"
BUYER_PASSWORD = "password123"

ADMIN_EMAIL = "adminwxqz@test.com"
ADMIN_PASSWORD = "Password123"

ADDRESS_ID = 2  # alamat milik buyer di atas

# Produk yang dipakai. seller_email/password = pemilik toko produk tsb
# (dibutuhkan untuk proses & kirim order). Tambah/ubah sesuai data Neon.
PRODUCTS = [
    {"id": 2, "seller_email": "seller@tes.com", "seller_password": "password123"},
    # Contoh produk toko lain (hapus tanda # lalu isi id yang benar):
    # {"id": 1, "seller_email": "seller1wxqz@test.com", "seller_password": "Password123"},
]

# Skenario order yang dibuat, berurutan. Dipakai bergantian ke tiap produk.
# completed = sampai selesai + review | paid = perlu diproses
# processing = perlu dikirim | shipped = dikirim | pending = menunggu pembayaran
SKENARIO = ["completed", "completed", "completed", "paid", "processing", "shipped", "pending"]

BUAT_OFFER = True    # buat 1 penawaran pending (muncul di "Penawaran menunggu")
BUAT_REPORT = True   # buat 1 laporan produk (muncul di antrean Laporan admin)
# ===================================================================

tokens = {}
ringkas = {"order_dibuat": 0, "review": 0, "gagal": 0}


def login(email, password):
    if email in tokens:
        return tokens[email]
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        print(f"[LOGIN GAGAL] {email} -> {r.status_code} {r.text}")
        tokens[email] = None
        return None
    tokens[email] = r.json()["access_token"]
    return tokens[email]


def call(method, url, token, json=None, label=""):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.request(method, f"{BASE_URL}{url}", json=json, headers=headers)
    ok = r.status_code < 300
    print(f"   [{'OK' if ok else 'GAGAL'}] {label or method + ' ' + url} -> {r.status_code}")
    if not ok:
        ringkas["gagal"] += 1
        print("        ", r.text[:200])
    try:
        return r, r.json()
    except Exception:
        return r, None


def info_produk(pid):
    r = requests.get(f"{BASE_URL}/api/products/{pid}")
    if r.status_code != 200:
        print(f"   [INFO] GET /api/products/{pid} -> {r.status_code} {r.text[:150]}")
        return None
    body = r.json()
    # Response bisa dibungkus, misalnya {"product": {...}} atau {"data": {...}}
    if isinstance(body, dict) and "status" not in body:
        for k in ("product", "data", "item"):
            if isinstance(body.get(k), dict):
                return body[k]
        print(f"   [INFO] Bentuk response produk tidak dikenali, key: {list(body.keys())}")
    return body


def pilih_produk(urutan):
    """Ambil produk berikutnya (round-robin) yang masih active dan stok > 0."""
    n = len(PRODUCTS)
    for i in range(n):
        p = PRODUCTS[(urutan + i) % n]
        data = info_produk(p["id"])
        if data and data.get("status") == "active" and (data.get("stock") or 0) > 0:
            return p
    return None


def buat_order(buyer, produk):
    call("DELETE", "/api/cart", buyer, label="Kosongkan cart")
    r, _ = call("POST", "/api/cart/items", buyer,
                json={"product_id": produk["id"], "quantity": 1}, label=f"Tambah produk {produk['id']} ke cart")
    if r.status_code >= 300:
        return None, None
    r, body = call("POST", "/api/orders/checkout", buyer,
                   json={"address_id": ADDRESS_ID, "payment_method": "transfer"}, label="Checkout")
    if r.status_code != 201 or not body:
        return None, None
    if isinstance(body, dict) and "orders" in body:
        orders = body["orders"]
    elif isinstance(body, list):
        orders = body
    else:
        orders = [body]
    order = orders[0]
    pay = order.get("payment") or {}
    ringkas["order_dibuat"] += 1
    return order["id"], pay.get("id")


def jalankan_skenario(tahap, buyer, admin, produk):
    order_id, payment_id = buat_order(buyer, produk)
    if not order_id:
        return
    print(f"   -> order_id={order_id}, payment_id={payment_id}, target={tahap}")
    if tahap == "pending":
        return

    seller = login(produk["seller_email"], produk["seller_password"])
    if not (admin and payment_id and seller):
        print("   [SKIP] token admin/seller atau payment_id tidak ada")
        return

    call("POST", f"/api/payments/{payment_id}/confirm", admin, label="Admin konfirmasi bayar")
    if tahap == "paid":
        return

    call("POST", f"/api/orders/{order_id}/process", seller, label="Seller proses")
    if tahap == "processing":
        return

    call("POST", f"/api/orders/{order_id}/ship", seller, json={
        "courier": "JNE", "tracking_number": f"SEED{order_id:06d}", "shipping_method": "regular",
    }, label="Seller kirim")
    if tahap == "shipped":
        return

    call("POST", f"/api/orders/{order_id}/receive", buyer, label="Buyer terima")
    call("POST", f"/api/orders/{order_id}/complete", buyer, label="Buyer selesaikan")

    r, detail = call("GET", f"/api/orders/{order_id}", buyer, label="Ambil detail order")
    if detail and detail.get("items"):
        item_id = detail["items"][0]["id"]
        r, _ = call("POST", "/api/reviews", buyer, json={
            "order_item_id": item_id,
            "product_rating": 5 if order_id % 2 else 4,
            "seller_rating": 5,
            "shipping_rating": 4,
            "comment": "Barang sesuai deskripsi, pengiriman cepat (data uji).",
        }, label="Buyer beri review")
        if r.status_code == 201:
            ringkas["review"] += 1


def main():
    buyer = login(BUYER_EMAIL, BUYER_PASSWORD)
    admin = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not (buyer and admin):
        print("Login buyer/admin gagal, hentikan.")
        return

    print("=== STOK PRODUK SEBELUM MULAI ===")
    for p in PRODUCTS:
        d = info_produk(p["id"])
        if d:
            print(f"   produk {p['id']}: {d.get('name')} | status={d.get('status')} | stok={d.get('stock')}")
        else:
            print(f"   produk {p['id']}: tidak ditemukan")

    print("\n=== MEMBUAT ORDER ===")
    for i, tahap in enumerate(SKENARIO):
        produk = pilih_produk(i)
        print(f"\n[{i + 1}/{len(SKENARIO)}] skenario '{tahap}'")
        if not produk:
            print("   [STOP] tidak ada produk active dengan stok tersisa. "
                  "Tambah produk/stok lewat API (PUT /api/products/<id>) lalu jalankan lagi.")
            break
        jalankan_skenario(tahap, buyer, admin, produk)

    pertama = PRODUCTS[0]["id"]
    if BUAT_OFFER:
        print("\n=== PENAWARAN (pending) ===")
        d = info_produk(pertama)
        if d and d.get("status") == "active":
            harga = float(d.get("price", 0)) * 0.8
            call("POST", "/api/offers", buyer,
                 json={"product_id": pertama, "amount": round(harga, 2), "message": "Boleh nego? (data uji)"},
                 label="Buyer kirim offer")
        else:
            print("   [SKIP] produk pertama tidak active")

    if BUAT_REPORT:
        print("\n=== LAPORAN ===")
        call("POST", "/api/reports", buyer, json={
            "target_type": "product", "target_id": pertama,
            "reason": "Deskripsi kurang sesuai", "description": "Laporan data uji untuk dashboard.",
        }, label="Buyer laporkan produk")

    print(f"\n=== SELESAI: {ringkas['order_dibuat']} order dibuat, "
          f"{ringkas['review']} review, {ringkas['gagal']} langkah gagal ===")
    print("Refresh dashboard seller dan admin untuk melihat hasilnya.")


if __name__ == "__main__":
    main()