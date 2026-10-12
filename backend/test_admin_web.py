"""Tes kontrak API untuk halaman web admin (7F).

Jalankan dari folder backend dengan server Flask aktif:
    python test_admin_web.py

Tes pembayaran hanya mengirim confirm/fail untuk payment yang statusnya sudah
bukan pending. Tidak ada aksi pembayaran pada data pending yang dipakai bersama.
Perubahan status sementara pada user, produk, dan laporan dipulihkan di finally.
"""
import sys

import requests


BASE = "http://localhost:5000"
ADMIN = ("adminwxqz@test.com", "Password123")
SELLER = ("seller@tes.com", "password123")
BUYER = ("devic@tes.com", "password123")
PROTECTED_EMAILS = {email.casefold() for email, _ in (ADMIN, SELLER, BUYER)}
TIMEOUT = 15

lolos, gagal, dilewati = 0, 0, 0


def cek(nama, kondisi, info=""):
    global lolos, gagal
    if kondisi:
        lolos += 1
        print(f"  [OK]    {nama}")
    else:
        gagal += 1
        print(f"  [GAGAL] {nama} {info}")


def lewati(nama, alasan):
    global dilewati
    dilewati += 1
    print(f"  [LEWAT] {nama} ({alasan})")


def login(email, password):
    response = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Login akun tes gagal dengan status {response.status_code}")
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Respons login tidak memuat access_token")
    return {"Authorization": f"Bearer {token}"}


def get_json(path, headers=None, params=None):
    return requests.get(
        f"{BASE}{path}",
        headers=headers,
        params=params,
        timeout=TIMEOUT,
    )


def patch_json(path, payload, headers):
    return requests.patch(
        f"{BASE}{path}",
        json=payload,
        headers=headers,
        timeout=TIMEOUT,
    )


def daftar_semua_pengguna(admin):
    users = []
    page = 1
    while True:
        response = get_json(
            "/api/admin/users",
            admin,
            {"page": page, "per_page": 100},
        )
        if response.status_code != 200:
            break
        body = response.json()
        users.extend(body.get("users", []))
        if page >= body.get("pages", 1):
            break
        page += 1
    return users


def daftar_semua_pesanan(admin):
    orders = []
    page = 1
    while True:
        response = get_json(
            "/api/orders",
            admin,
            {"role": "admin", "page": page, "per_page": 100},
        )
        if response.status_code != 200:
            break
        body = response.json()
        orders.extend(body.get("orders", []))
        if page >= body.get("pages", 1):
            break
        page += 1
    return orders


def tes_kontrak(admin):
    print("\n== KONTRAK ENDPOINT ==")
    users_response = get_json("/api/admin/users", admin, {"per_page": 5})
    cek(
        "GET /api/admin/users = 200 dengan key pagination",
        users_response.status_code == 200
        and all(
            key in users_response.json()
            for key in ("users", "page", "per_page", "total", "pages")
        ),
        f"(dapat {users_response.status_code})",
    )
    if users_response.status_code == 200 and users_response.json().get("users"):
        item = users_response.json()["users"][0]
        cek(
            "kontrak item pengguna",
            all(key in item for key in ("id", "name", "email", "phone", "role", "status", "created_at")),
            f"(key: {list(item)})",
        )

    products_response = get_json("/api/admin/products", admin, {"per_page": 5})
    cek(
        "GET /api/admin/products = 200 dengan key pagination",
        products_response.status_code == 200
        and all(
            key in products_response.json()
            for key in ("products", "page", "per_page", "total", "pages")
        ),
        f"(dapat {products_response.status_code})",
    )
    if products_response.status_code == 200 and products_response.json().get("products"):
        item = products_response.json()["products"][0]
        cek(
            "kontrak item produk admin",
            all(
                key in item
                for key in (
                    "id",
                    "name",
                    "price",
                    "stock",
                    "status",
                    "store_id",
                    "store_name",
                    "category",
                    "condition",
                    "main_image",
                    "created_at",
                )
            ),
            f"(key: {list(item)})",
        )

    orders_response = get_json(
        "/api/orders",
        admin,
        {"role": "admin", "per_page": 5},
    )
    cek(
        "GET /api/orders?role=admin = 200 dengan key pagination",
        orders_response.status_code == 200
        and all(
            key in orders_response.json()
            for key in ("orders", "page", "per_page", "total", "pages")
        ),
        f"(dapat {orders_response.status_code})",
    )
    orders = orders_response.json().get("orders", []) if orders_response.status_code == 200 else []
    if orders:
        item = orders[0]
        cek(
            "kontrak item daftar pesanan",
            all(key in item for key in ("id", "order_number", "buyer_id", "total_amount", "status", "created_at")),
            f"(key: {list(item)})",
        )
        if item.get("payment") is not None:
            cek(
                "payment daftar pesanan menyediakan id dan status",
                all(key in item["payment"] for key in ("id", "status")),
                f"(key: {list(item['payment'])})",
            )
        detail_response = get_json(f"/api/orders/{item['id']}", admin)
        order_detail = detail_response.json().get("order", {}) if detail_response.status_code == 200 else {}
        cek(
            "GET /api/orders/<id> = 200 dengan order detail",
            detail_response.status_code == 200
            and all(
                key in order_detail
                for key in (
                    "id",
                    "order_number",
                    "buyer_id",
                    "status",
                    "subtotal",
                    "shipping_cost",
                    "platform_fee",
                    "discount",
                    "total_amount",
                    "items",
                    "payment",
                    "shipment",
                )
            ),
            f"(dapat {detail_response.status_code})",
        )
        if detail_response.status_code == 200:
            if order_detail.get("items"):
                cek(
                    "kontrak snapshot item pesanan",
                    all(
                        key in order_detail["items"][0]
                        for key in ("product_name_snapshot", "price", "quantity", "subtotal")
                    ),
                )
            if order_detail.get("payment") is not None:
                cek(
                    "payment detail menyediakan id dan status",
                    all(key in order_detail["payment"] for key in ("id", "status")),
                    f"(key: {list(order_detail['payment'])})",
                )
    else:
        lewati("key detail pesanan dan item nested", "tidak ada order untuk diperiksa")

    reports_response = get_json("/api/reports", admin, {"per_page": 5})
    report_body = reports_response.json() if reports_response.status_code == 200 else {}
    cek(
        "GET /api/reports = 200 dengan reports dan pagination",
        reports_response.status_code == 200
        and "reports" in report_body
        and all(key in report_body.get("pagination", {}) for key in ("page", "per_page", "total")),
        f"(dapat {reports_response.status_code})",
    )
    reports = report_body.get("reports", [])
    if reports:
        item = reports[0]
        report_keys = (
            "id",
            "reporter_id",
            "target_type",
            "target_id",
            "reason",
            "description",
            "status",
            "handled_by",
            "handled_at",
            "resolution_note",
            "created_at",
        )
        cek("kontrak item daftar laporan", all(key in item for key in report_keys), f"(key: {list(item)})")
        detail_response = get_json(f"/api/reports/{item['id']}", admin)
        detail = detail_response.json().get("report", {}) if detail_response.status_code == 200 else {}
        cek(
            "GET /api/reports/<id> = 200 dengan seluruh field laporan",
            detail_response.status_code == 200 and all(key in detail for key in report_keys),
            f"(dapat {detail_response.status_code}, key: {list(detail)})",
        )
    else:
        lewati("GET /api/reports/<id> kontrak detail", "belum ada laporan untuk diperiksa")


def tes_akses(admin, seller, buyer):
    print("\n== AKSES ==")
    admin_endpoints = (
        "/api/admin/users",
        "/api/admin/products",
        "/api/reports",
        "/api/orders?role=admin",
    )
    for path in admin_endpoints:
        cek(f"tanpa token {path} = 401", get_json(path).status_code == 401)
        cek(f"seller {path} = 403", get_json(path, seller).status_code == 403)
        cek(f"buyer {path} = 403", get_json(path, buyer).status_code == 403)


def tes_pembayaran_bukan_pending(admin):
    print("\n== PEMBAYARAN NON-PENDING ==")
    orders = daftar_semua_pesanan(admin)
    candidate = next(
        (
            order["payment"]
            for order in orders
            if order.get("status") in ("paid", "completed", "cancelled")
            if order.get("payment")
            and order["payment"].get("status") != "pending"
            and order["payment"].get("id") is not None
        ),
        None,
    )
    if not candidate:
        lewati("confirm dan fail pada payment non-pending = 409", "tidak ada payment non-pending")
        return

    for action in ("confirm", "fail"):
        response = requests.post(
            f"{BASE}/api/payments/{candidate['id']}/{action}",
            headers=admin,
            timeout=TIMEOUT,
        )
        expected_error = (
            "Payment hanya dapat dikonfirmasi saat pending"
            if action == "confirm"
            else "Payment hanya dapat ditandai gagal saat pending"
        )
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        cek(
            f"POST /api/payments/<id>/{action} untuk payment non-pending = 409",
            response.status_code == 409 and body.get("error") == expected_error,
            f"(dapat {response.status_code}: {body.get('error')})",
        )


def tes_status_pengguna(admin):
    print("\n== STATUS PENGGUNA ==")
    users = daftar_semua_pengguna(admin)
    current_admin = next(
        (item for item in users if item.get("email", "").casefold() == ADMIN[0].casefold()),
        None,
    )
    if not current_admin:
        lewati("PATCH akun sendiri = 400", "akun admin saat ini tidak ditemukan di daftar")
    else:
        response = patch_json(
            f"/api/admin/users/{current_admin['id']}",
            {"status": "suspended"},
            admin,
        )
        cek("PATCH akun sendiri = 400", response.status_code == 400, f"(dapat {response.status_code})")

    other_admin = next(
        (
            item
            for item in users
            if item.get("role") == "admin"
            and item.get("email", "").casefold() != ADMIN[0].casefold()
        ),
        None,
    )
    if other_admin:
        response = patch_json(
            f"/api/admin/users/{other_admin['id']}",
            {"status": "suspended"},
            admin,
        )
        cek("PATCH admin lain = 403", response.status_code == 403, f"(dapat {response.status_code})")
    else:
        lewati("PATCH admin lain = 403", "tidak ada akun admin lain")

    max_user_id = max((item.get("id", 0) for item in users), default=0)
    missing_id = max_user_id + 1000000
    response = patch_json(f"/api/admin/users/{missing_id}", {"status": "active"}, admin)
    cek("PATCH user tidak ada = 404", response.status_code == 404, f"(dapat {response.status_code})")

    invalid_target = current_admin["id"] if current_admin else missing_id
    response = patch_json(
        f"/api/admin/users/{invalid_target}",
        {"status": "invalid-status"},
        admin,
    )
    cek("PATCH status pengguna tidak valid = 400", response.status_code == 400, f"(dapat {response.status_code})")

    candidates = [
        item
        for item in users
        if item.get("role") in ("buyer", "seller")
        and item.get("status") == "active"
        and item.get("email", "").casefold() not in PROTECTED_EMAILS
        and any(marker in item.get("email", "").casefold() for marker in ("uji", "test"))
    ]
    test_user = candidates[0] if candidates else None
    if not test_user:
        lewati("suspend lalu pulihkan akun uji lain", "tidak ditemukan akun uji aktif yang aman")
        return

    attempted = False
    try:
        attempted = True
        response = patch_json(
            f"/api/admin/users/{test_user['id']}",
            {"status": "suspended"},
            admin,
        )
        cek("suspend akun uji lain = 200", response.status_code == 200, f"(dapat {response.status_code})")
    finally:
        if attempted:
            restored = patch_json(
                f"/api/admin/users/{test_user['id']}",
                {"status": "active"},
                admin,
            )
            cek("pulihkan akun uji ke active = 200", restored.status_code == 200, f"(dapat {restored.status_code})")


def tes_status_produk(admin):
    print("\n== STATUS PRODUK ==")
    invalid = patch_json(
        "/api/admin/products/1/status",
        {"status": "invalid-status"},
        admin,
    )
    cek("PATCH status produk tidak valid = 400", invalid.status_code == 400, f"(dapat {invalid.status_code})")

    sold_response = get_json("/api/admin/products", admin, {"status": "sold", "per_page": 1})
    sold_items = sold_response.json().get("products", []) if sold_response.status_code == 200 else []
    if sold_items:
        sold_result = patch_json(
            f"/api/admin/products/{sold_items[0]['id']}/status",
            {"status": "active"},
            admin,
        )
        cek("PATCH produk sold = 409", sold_result.status_code == 409, f"(dapat {sold_result.status_code})")
    else:
        lewati("PATCH produk sold = 409", "tidak ada produk berstatus sold")

    products_response = get_json("/api/admin/products", admin, {"per_page": 100})
    products = products_response.json().get("products", []) if products_response.status_code == 200 else []
    product_ids = [item.get("id", 0) for item in products]
    missing_id = max(product_ids, default=0) + 1000000
    missing = patch_json(
        f"/api/admin/products/{missing_id}/status",
        {"status": "archived"},
        admin,
    )
    cek("PATCH produk tidak ada = 404", missing.status_code == 404, f"(dapat {missing.status_code})")

    product = next(
        (
            item
            for item in products
            if item.get("status") != "sold" and item.get("stock", 0) > 0
        ),
        None,
    )
    if not product:
        lewati("ubah status produk sementara lalu pulihkan", "tidak ada produk non-sold dengan stok")
        return

    original_status = product["status"]
    temporary_status = "rejected" if original_status == "active" else "active"
    attempted = False
    try:
        attempted = True
        response = patch_json(
            f"/api/admin/products/{product['id']}/status",
            {"status": temporary_status},
            admin,
        )
        cek("PATCH produk ke status sementara = 200", response.status_code == 200, f"(dapat {response.status_code})")
    finally:
        if attempted:
            restored = patch_json(
                f"/api/admin/products/{product['id']}/status",
                {"status": original_status},
                admin,
            )
            cek("pulihkan status produk semula = 200", restored.status_code == 200, f"(dapat {restored.status_code})")


def tes_status_laporan(admin):
    print("\n== STATUS LAPORAN ==")
    response = get_json("/api/reports", admin, {"per_page": 1})
    reports = response.json().get("reports", []) if response.status_code == 200 else []
    if not reports:
        lewati("PATCH status tidak valid dan status sementara laporan", "tidak ada laporan untuk diuji")
        missing = patch_json("/api/reports/1000000000", {"status": "pending"}, admin)
        cek("PATCH laporan tidak ada = 404", missing.status_code == 404, f"(dapat {missing.status_code})")
        return

    report = reports[0]
    invalid = patch_json(
        f"/api/reports/{report['id']}",
        {"status": "invalid-status"},
        admin,
    )
    cek("PATCH status laporan tidak valid = 400", invalid.status_code == 400, f"(dapat {invalid.status_code})")

    missing = patch_json(
        "/api/reports/1000000000",
        {"status": "pending"},
        admin,
    )
    cek("PATCH laporan tidak ada = 404", missing.status_code == 404, f"(dapat {missing.status_code})")

    detail_response = get_json(f"/api/reports/{report['id']}", admin)
    if detail_response.status_code != 200:
        lewati("ubah status laporan sementara lalu pulihkan", "detail laporan tidak dapat dimuat")
        return
    detail = detail_response.json().get("report", {})
    original_status = detail.get("status", report["status"])
    original_note = detail.get("resolution_note")
    temporary_status = "investigating" if original_status != "investigating" else "pending"
    attempted = False
    try:
        attempted = True
        updated = patch_json(
            f"/api/reports/{report['id']}",
            {"status": temporary_status, "resolution_note": original_note},
            admin,
        )
        cek("PATCH laporan ke status sementara = 200", updated.status_code == 200, f"(dapat {updated.status_code})")
    finally:
        if attempted:
            restored = patch_json(
                f"/api/reports/{report['id']}",
                {"status": original_status, "resolution_note": original_note},
                admin,
            )
            cek("pulihkan status dan catatan laporan semula = 200", restored.status_code == 200, f"(dapat {restored.status_code})")


try:
    admin_headers = login(*ADMIN)
    seller_headers = login(*SELLER)
    buyer_headers = login(*BUYER)
    tes_kontrak(admin_headers)
    tes_akses(admin_headers, seller_headers, buyer_headers)
    tes_pembayaran_bukan_pending(admin_headers)
    tes_status_pengguna(admin_headers)
    tes_status_produk(admin_headers)
    tes_status_laporan(admin_headers)
except Exception as error:
    gagal += 1
    print(f"ERROR tak terduga: {error}")
finally:
    print(f"\nHasil: {lolos} lolos, {gagal} gagal, {dilewati} dilewati")
    sys.exit(1 if gagal else 0)
