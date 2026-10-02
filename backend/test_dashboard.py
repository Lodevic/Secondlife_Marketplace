"""
Script uji coba Dashboard (Tahap 7A) SecondLife.

Cara pakai:
1. Terminal 1 (folder backend, venv aktif): python -m flask run
2. Terminal 2 (folder backend, venv aktif):  python test_dashboard.py

Disarankan jalankan test_flow.py dulu beberapa kali supaya ada
order berstatus completed (kalau tidak, angka dashboard semuanya 0).
"""

from decimal import Decimal

import requests

BASE_URL = "http://localhost:5000"

# ======================= CONFIG - ISI DULU =======================
BUYER_EMAIL = "devic@tes.com"
BUYER_PASSWORD = "password123"

SELLER_EMAIL = "seller@tes.com"        # seller yang SUDAH punya toko
SELLER_PASSWORD = "password123"

ADMIN_EMAIL = "adminwxqz@test.com"
ADMIN_PASSWORD = "Password123"
# ===================================================================

hasil = {"lolos": 0, "gagal": 0, "lewat": 0}


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        print(f"[LOGIN GAGAL] {email} -> {r.status_code} {r.text}")
        return None
    return r.json()["access_token"]


def catat(ok, pesan):
    hasil["lolos" if ok else "gagal"] += 1
    print(f"[{'OK   ' if ok else 'GAGAL'}] {pesan}")


def panggil(nama, url, token, harapan, tampil=False):
    """GET endpoint, cek status code (harapan boleh int atau tuple), return body JSON."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(f"{BASE_URL}{url}", headers=headers)
    harapan_set = harapan if isinstance(harapan, (tuple, list)) else (harapan,)
    ok = r.status_code in harapan_set
    catat(ok, f"{nama}: GET {url} -> {r.status_code} (harapan {'/'.join(map(str, harapan_set))})")
    try:
        body = r.json()
    except Exception:
        body = None
    if tampil or not ok:
        print("        ", body)
    return body


def cek_key(nama, body, keys):
    """Pastikan semua key kontrak response ada."""
    if not isinstance(body, dict):
        catat(False, f"{nama}: response bukan objek JSON")
        return
    hilang = [k for k in keys if k not in body]
    catat(not hilang, f"{nama}: key kontrak lengkap" + (f" (hilang: {hilang})" if hilang else ""))


def ambil_list_order(body):
    """Ambil daftar order dari response GET /api/orders (bentuk wrapper belum pasti)."""
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for k in ("orders", "items", "data", "results"):
            if isinstance(body.get(k), list):
                return body[k]
    return None


def main():
    buyer = login(BUYER_EMAIL, BUYER_PASSWORD)
    seller = login(SELLER_EMAIL, SELLER_PASSWORD)
    admin = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not (buyer and seller and admin):
        print("Login ada yang gagal, hentikan.")
        return

    # ---------------------------------------------------------------
    print("\n=== 1. SELLER: STATUS 200 + KONTRAK RESPONSE ===")
    summary = panggil("Seller summary", "/api/dashboard/seller/summary", seller, 200, tampil=True)
    cek_key("Seller summary", summary, [
        "total_revenue", "orders_by_status", "products_by_status",
        "reviews", "pending_offers", "needs_action",
    ])

    trend = panggil("Seller sales-trend (day)", "/api/dashboard/seller/sales-trend?period=day", seller, 200)
    cek_key("Seller sales-trend", trend, ["period", "start_date", "end_date", "data"])
    if trend and isinstance(trend.get("data"), list):
        catat(len(trend["data"]) == 30, f"Seller sales-trend default = 30 hari (dapat {len(trend['data'])})")

    panggil("Seller sales-trend (month)", "/api/dashboard/seller/sales-trend?period=month", seller, 200)

    top = panggil("Seller top-products", "/api/dashboard/seller/top-products?limit=5", seller, 200, tampil=True)
    cek_key("Seller top-products", top, ["products"])

    low = panggil("Seller low-stock", "/api/dashboard/seller/low-stock?threshold=3", seller, 200, tampil=True)
    cek_key("Seller low-stock", low, ["threshold", "products"])

    # ---------------------------------------------------------------
    print("\n=== 2. SELLER: CEK KECOCOKAN ANGKA DENGAN DATA ORDER ===")
    r = requests.get(
        f"{BASE_URL}/api/orders?role=seller&status=completed&per_page=100",
        headers={"Authorization": f"Bearer {seller}"},
    )
    orders = ambil_list_order(r.json()) if r.status_code == 200 else None
    # >>> PERBAIKAN 1 (mulai): cek dulu summary valid, supaya tidak crash saat endpoint 500
    summary_ok = isinstance(summary, dict) and "total_revenue" in summary
    if orders is None or not summary_ok:
    # <<< PERBAIKAN 1 (selesai)
        hasil["lewat"] += 1
        print("[LEWAT] Bentuk response /api/orders tidak dikenali, cocokkan angka manual.")
    else:
        total_manual = sum(
            Decimal(str(item["subtotal"])) for o in orders for item in o.get("items", [])
        )
        total_dashboard = Decimal(summary["total_revenue"])
        catat(total_manual == total_dashboard,
              f"total_revenue dashboard {total_dashboard} == jumlah subtotal item completed {total_manual}")
        catat(len(orders) == summary["orders_by_status"]["completed"],
              f"jumlah order completed dashboard {summary['orders_by_status']['completed']} == {len(orders)}")

    # ---------------------------------------------------------------
    print("\n=== 3. ADMIN: STATUS 200 + KONTRAK RESPONSE ===")
    a_sum = panggil("Admin summary", "/api/dashboard/admin/summary", admin, 200, tampil=True)
    cek_key("Admin summary", a_sum, [
        "users", "stores_by_status", "products_by_status", "orders_by_status",
        "gmv", "platform_revenue", "total_completed_orders",
    ])

    a_trend = panggil("Admin sales-trend", "/api/dashboard/admin/sales-trend?period=day", admin, 200)
    cek_key("Admin sales-trend", a_trend, ["period", "start_date", "end_date", "data"])

    mod = panggil("Admin moderation-queue", "/api/dashboard/admin/moderation-queue", admin, 200, tampil=True)
    cek_key("Admin moderation-queue", mod, ["payments", "reports", "stores", "hidden_reviews_count"])

    sel = panggil("Admin top-sellers", "/api/dashboard/admin/top-sellers?limit=5", admin, 200, tampil=True)
    cek_key("Admin top-sellers", sel, ["sellers"])

    prod = panggil("Admin top-products", "/api/dashboard/admin/top-products?limit=5", admin, 200, tampil=True)
    cek_key("Admin top-products", prod, ["products"])

    # >>> PERBAIKAN 2 (mulai): cek dulu admin summary valid sebelum membaca gmv
    if isinstance(a_sum, dict) and "gmv" in a_sum and "platform_revenue" in a_sum:
    # <<< PERBAIKAN 2 (selesai)
        gmv = Decimal(a_sum["gmv"])
        fee = Decimal(a_sum["platform_revenue"])
        catat(gmv >= fee, f"GMV ({gmv}) >= pendapatan platform ({fee})")

    # ---------------------------------------------------------------
    print("\n=== 4. AKSES TERLARANG (harus 403) ===")
    panggil("Buyer -> dashboard seller", "/api/dashboard/seller/summary", buyer, 403)
    panggil("Buyer -> dashboard admin", "/api/dashboard/admin/summary", buyer, 403)
    panggil("Seller -> dashboard admin", "/api/dashboard/admin/summary", seller, 403)
    panggil("Admin -> dashboard seller", "/api/dashboard/seller/summary", admin, 403)

    print("\n=== 5. TANPA TOKEN (harus 401) ===")
    panggil("Tanpa token (seller)", "/api/dashboard/seller/summary", None, 401)
    panggil("Tanpa token (admin)", "/api/dashboard/admin/summary", None, 401)

    # ---------------------------------------------------------------
    print("\n=== 6. VALIDASI INPUT (harus 400) ===")
    panggil("Period tidak valid", "/api/dashboard/seller/sales-trend?period=tahun", seller, 400)
    panggil("Format tanggal salah", "/api/dashboard/seller/sales-trend?start_date=31-12-2026", seller, 400)
    panggil("start_date > end_date",
            "/api/dashboard/seller/sales-trend?start_date=2026-10-10&end_date=2026-10-01", seller, 400)
    panggil("Admin: period tidak valid", "/api/dashboard/admin/sales-trend?period=tahun", admin, 400)
    panggil("Admin: start_date > end_date",
            "/api/dashboard/admin/sales-trend?start_date=2026-10-10&end_date=2026-10-01", admin, 400)
    panggil("Limit 0", "/api/dashboard/seller/top-products?limit=0", seller, 400)

    # Limit di atas maksimal: boleh ditolak (400) atau dipotong jadi 50 (200)
    body = panggil("Limit 999 (400 atau dipotong 200)",
                   "/api/dashboard/seller/top-products?limit=999", seller, (400, 200))
    if body and isinstance(body.get("products"), list):
        catat(len(body["products"]) <= 50, f"Limit 999 tidak mengembalikan lebih dari 50 (dapat {len(body['products'])})")

    # ---------------------------------------------------------------
    print(f"\n=== SELESAI: {hasil['lolos']} lolos, {hasil['gagal']} gagal, {hasil['lewat']} dilewati ===")
    print("Catatan: tes 'akun tanpa data (semua nol)' dilakukan manual dengan seller baru yang belum punya order.")


if __name__ == "__main__":
    main()