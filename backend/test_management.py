"""Script uji endpoint management seller dan admin SecondLife."""

import requests

BASE_URL = "http://localhost:5000"

# ======================= CONFIG - ISI DULU =======================
BUYER_EMAIL = "devic@tes.com"
BUYER_PASSWORD = "password123"

SELLER_EMAIL = "seller@tes.com"
SELLER_PASSWORD = "password123"

ADMIN_EMAIL = "adminwxqz@test.com"
ADMIN_PASSWORD = "Password123"
# ===================================================================

PROTECTED_EMAILS = {
    BUYER_EMAIL.lower(),
    SELLER_EMAIL.lower(),
    ADMIN_EMAIL.lower(),
}
hasil = {"lolos": 0, "gagal": 0, "lewat": 0}


def login(email, password):
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    if response.status_code != 200:
        print(f"[LOGIN GAGAL] {email} -> {response.status_code} {response.text}")
        return None
    return response.json()["access_token"]


def catat(ok, pesan):
    hasil["lolos" if ok else "gagal"] += 1
    print(f"[{'OK   ' if ok else 'GAGAL'}] {pesan}")


def panggil(nama, method, url, token, harapan, params=None, payload=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = requests.request(
        method,
        f"{BASE_URL}{url}",
        headers=headers,
        params=params,
        json=payload,
        timeout=20,
    )
    harapan_set = harapan if isinstance(harapan, (tuple, list)) else (harapan,)
    ok = response.status_code in harapan_set
    catat(
        ok,
        f"{nama}: {method} {url} -> {response.status_code} "
        f"(harapan {'/'.join(map(str, harapan_set))})",
    )
    try:
        body = response.json()
    except ValueError:
        body = None
    if not ok:
        print("        ", body if body is not None else response.text)
    return response.status_code, body


def cek_key(nama, body, keys):
    if not isinstance(body, dict):
        catat(False, f"{nama}: response bukan objek JSON")
        return
    hilang = [key for key in keys if key not in body]
    catat(not hilang, f"{nama}: key kontrak lengkap" + (f" (hilang: {hilang})" if hilang else ""))


def cek_error(nama, body):
    catat(isinstance(body, dict) and isinstance(body.get("error"), str), f"{nama}: format error memiliki key error")


def cek_pagination(nama, body, collection_key):
    cek_key(nama, body, [collection_key, "page", "per_page", "total", "pages"])
    if isinstance(body, dict):
        catat(isinstance(body.get(collection_key), list), f"{nama}: {collection_key} berupa list")


def cek_item_keys(nama, items, required_keys):
    if not isinstance(items, list) or not items:
        hasil["lewat"] += 1
        print(f"[LEWAT] {nama}: tidak ada item untuk memeriksa key item")
        return
    missing = [key for key in required_keys if key not in items[0]]
    catat(not missing, f"{nama}: key item lengkap" + (f" (hilang: {missing})" if missing else ""))


def cari_user_yang_aman(admin_token, admin_id):
    _, body = panggil(
        "Cari user aktif untuk uji perubahan status",
        "GET",
        "/api/admin/users",
        admin_token,
        200,
        params={"status": "active", "per_page": 100},
    )
    if not isinstance(body, dict):
        return None
    for page in range(1, body.get("pages", 1) + 1):
        if page == 1:
            page_body = body
        else:
            _, page_body = panggil(
                f"Ambil halaman user {page}",
                "GET",
                "/api/admin/users",
                admin_token,
                200,
                params={"status": "active", "per_page": 100, "page": page},
            )
        if not isinstance(page_body, dict):
            continue
        for user in page_body.get("users", []):
            if (
                user.get("id") != admin_id
                and user.get("role") != "admin"
                and user.get("email", "").lower() not in PROTECTED_EMAILS
            ):
                return user
    return None


def cari_produk_yang_aman(admin_token):
    _, body = panggil(
        "Cari produk yang statusnya dapat dipulihkan",
        "GET",
        "/api/admin/products",
        admin_token,
        200,
        params={"per_page": 100},
    )
    if not isinstance(body, dict):
        return None
    page_count = body.get("pages", 1)
    for page in range(1, page_count + 1):
        if page == 1:
            page_body = body
        else:
            _, page_body = panggil(
                f"Ambil halaman produk {page}",
                "GET",
                "/api/admin/products",
                admin_token,
                200,
                params={"per_page": 100, "page": page},
            )
        if not isinstance(page_body, dict):
            continue
        for product in page_body.get("products", []):
            if product.get("status") in {"active", "archived", "rejected"}:
                if product.get("status") != "active" or product.get("stock", 0) > 0:
                    return product
    return None


def cari_produk_stok_nol(admin_token):
    _, body = panggil(
        "Cari produk stok 0 untuk uji aktivasi",
        "GET",
        "/api/admin/products",
        admin_token,
        200,
        params={"per_page": 100},
    )
    if not isinstance(body, dict):
        return None
    for page in range(1, body.get("pages", 1) + 1):
        if page == 1:
            page_body = body
        else:
            _, page_body = panggil(
                f"Ambil halaman produk stok 0 {page}",
                "GET",
                "/api/admin/products",
                admin_token,
                200,
                params={"per_page": 100, "page": page},
            )
        if not isinstance(page_body, dict):
            continue
        for product in page_body.get("products", []):
            if product.get("stock") == 0 and product.get("status") != "sold":
                return product
    return None


def uji_user_status(admin_token, user, restore):
    if user is None:
        hasil["lewat"] += 1
        print("[LEWAT] Tidak ada user aktif non-admin yang aman untuk uji perubahan status")
        return

    restore["user_id"] = user["id"]
    status_code, body = panggil(
        "Suspend user non-protected",
        "PATCH",
        f"/api/admin/users/{user['id']}",
        admin_token,
        200,
        payload={"status": "suspended"},
    )
    if status_code == 200:
        restore["user_changed"] = True
        cek_key("PATCH user", body, ["user"])
        if isinstance(body, dict) and isinstance(body.get("user"), dict):
            cek_item_keys("PATCH user", [body["user"]], ["id", "name", "email", "phone", "role", "status", "created_at"])
            catat(body["user"].get("status") == "suspended", "PATCH user menyimpan status suspended")

        status_code, body = panggil(
            "Kembalikan user ke active",
            "PATCH",
            f"/api/admin/users/{user['id']}",
            admin_token,
            200,
            payload={"status": "active"},
        )
        if status_code == 200:
            restore["user_changed"] = False
            cek_key("PATCH user kembali active", body, ["user"])
            if isinstance(body, dict) and isinstance(body.get("user"), dict):
                catat(body["user"].get("status") == "active", "User dikembalikan ke active")


def uji_produk_status(admin_token, product, restore):
    if product is None:
        hasil["lewat"] += 1
        print("[LEWAT] Tidak ada produk berstatus active/archived/rejected yang aman untuk dipulihkan")
        return

    original_status = product["status"]
    temporary_status = "archived" if original_status != "archived" else "rejected"
    restore["product_id"] = product["id"]
    restore["product_status"] = original_status
    status_code, body = panggil(
        "Ubah status produk sementara",
        "PATCH",
        f"/api/admin/products/{product['id']}/status",
        admin_token,
        200,
        payload={"status": temporary_status},
    )
    if status_code == 200:
        restore["product_changed"] = True
        cek_key("PATCH produk", body, ["product"])
        if isinstance(body, dict) and isinstance(body.get("product"), dict):
            cek_item_keys(
                "PATCH produk",
                [body["product"]],
                ["id", "name", "price", "stock", "status", "store_id", "store_name",
                 "category", "condition", "main_image", "created_at"],
            )
            catat(body["product"].get("status") == temporary_status, "PATCH produk menyimpan status sementara")

        status_code, body = panggil(
            "Pulihkan status produk",
            "PATCH",
            f"/api/admin/products/{product['id']}/status",
            admin_token,
            200,
            payload={"status": original_status},
        )
        if status_code == 200:
            restore["product_changed"] = False
            cek_key("PATCH produk dipulihkan", body, ["product"])
            if isinstance(body, dict) and isinstance(body.get("product"), dict):
                catat(body["product"].get("status") == original_status, "Status produk kembali seperti semula")


def pulihkan_data(admin_token, restore):
    try:
        if restore.get("user_changed"):
            panggil(
                "Pemulihan akhir user ke active",
                "PATCH",
                f"/api/admin/users/{restore['user_id']}",
                admin_token,
                200,
                payload={"status": "active"},
            )
    finally:
        if restore.get("product_changed"):
            panggil(
                "Pemulihan akhir status produk",
                "PATCH",
                f"/api/admin/products/{restore['product_id']}/status",
                admin_token,
                200,
                payload={"status": restore["product_status"]},
            )


def main():
    buyer = login(BUYER_EMAIL, BUYER_PASSWORD)
    seller = login(SELLER_EMAIL, SELLER_PASSWORD)
    admin = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not (buyer and seller and admin):
        print("Login ada yang gagal, hentikan.")
        return

    restore = {"user_changed": False, "product_changed": False}
    try:
        print("\n=== SELLER: DAFTAR PRODUK DAN KONTRAK RESPONSE ===")
        _, seller_products = panggil(
            "Seller products",
            "GET",
            "/api/seller/products",
            seller,
            200,
        )
        cek_pagination("Seller products", seller_products, "products")
        if isinstance(seller_products, dict):
            cek_item_keys(
                "Seller products",
                seller_products.get("products"),
                ["id", "name", "price", "stock", "status", "category", "condition", "main_image", "created_at"],
            )
            items = seller_products.get("products", [])
            if items:
                for relation in ("category", "condition"):
                    nested = items[0].get(relation)
                    catat(
                        isinstance(nested, dict) and {"id", "name"}.issubset(nested),
                        f"Seller products: {relation} memiliki id dan name",
                    )

        print("\n=== ADMIN: DAFTAR USER DAN PRODUK ===")
        _, admin_users = panggil("Admin users", "GET", "/api/admin/users", admin, 200)
        cek_pagination("Admin users", admin_users, "users")
        if isinstance(admin_users, dict):
            users = admin_users.get("users", [])
            cek_item_keys("Admin users", users, ["id", "name", "email", "phone", "role", "status", "created_at"])
            if users:
                catat(
                    all("password_hash" not in user for user in users),
                    "Admin users tidak mengembalikan password_hash",
                )

        _, admin_products = panggil("Admin products", "GET", "/api/admin/products", admin, 200)
        cek_pagination("Admin products", admin_products, "products")
        if isinstance(admin_products, dict):
            cek_item_keys(
                "Admin products",
                admin_products.get("products"),
                ["id", "name", "price", "stock", "status", "store_id", "store_name",
                 "category", "condition", "main_image", "created_at"],
            )

        print("\n=== ROLE DAN AUTENTIKASI ===")
        panggil("Buyer -> admin users", "GET", "/api/admin/users", buyer, 403)
        panggil("Seller -> admin users", "GET", "/api/admin/users", seller, 403)
        panggil("Buyer -> admin products", "GET", "/api/admin/products", buyer, 403)
        panggil("Seller -> admin products", "GET", "/api/admin/products", seller, 403)
        panggil("Admin -> seller products", "GET", "/api/seller/products", admin, 403)
        panggil("Tanpa token -> seller products", "GET", "/api/seller/products", None, 401)
        panggil("Tanpa token -> admin users", "GET", "/api/admin/users", None, 401)
        panggil("Tanpa token -> admin products", "GET", "/api/admin/products", None, 401)
        panggil("Buyer -> PATCH admin users", "PATCH", "/api/admin/users/2147483647", buyer, 403,
               payload={"status": "active"})
        panggil("Seller -> PATCH admin users", "PATCH", "/api/admin/users/2147483647", seller, 403,
               payload={"status": "active"})
        panggil("Buyer -> PATCH admin products", "PATCH", "/api/admin/products/2147483647/status", buyer, 403,
               payload={"status": "archived"})
        panggil("Seller -> PATCH admin products", "PATCH", "/api/admin/products/2147483647/status", seller, 403,
               payload={"status": "archived"})
        panggil("Tanpa token -> PATCH admin users", "PATCH", "/api/admin/users/2147483647", None, 401,
               payload={"status": "active"})
        panggil("Tanpa token -> PATCH admin products", "PATCH", "/api/admin/products/2147483647/status", None, 401,
               payload={"status": "archived"})

        print("\n=== VALIDASI QUERY DAN PAYLOAD ===")
        for name, path, token, params in (
            ("Seller status tidak valid", "/api/seller/products", seller, {"status": "unknown"}),
            ("Seller per_page di atas 100", "/api/seller/products", seller, {"per_page": 101}),
            ("Admin role tidak valid", "/api/admin/users", admin, {"role": "unknown"}),
            ("Admin status user tidak valid", "/api/admin/users", admin, {"status": "unknown"}),
            ("Admin page tidak valid", "/api/admin/products", admin, {"page": 0}),
            ("Admin store_id tidak valid", "/api/admin/products", admin, {"store_id": 0}),
        ):
            _, body = panggil(name, "GET", path, token, 400, params=params)
            cek_error(name, body)

        _, self_result = panggil(
            "Cari akun admin sendiri",
            "GET",
            "/api/admin/users",
            admin,
            200,
            params={"search": ADMIN_EMAIL, "per_page": 100},
        )
        own_admin = None
        if isinstance(self_result, dict):
            own_admin = next(
                (user for user in self_result.get("users", []) if user.get("email", "").lower() == ADMIN_EMAIL.lower()),
                None,
            )

        if own_admin:
            status_code, body = panggil(
                "Admin mengubah status akun sendiri",
                "PATCH",
                f"/api/admin/users/{own_admin['id']}",
                admin,
                400,
                payload={"status": "suspended"},
            )
            if status_code == 400:
                cek_error("Admin mengubah status akun sendiri", body)
        else:
            hasil["gagal"] += 1
            print("[GAGAL] Akun admin sendiri tidak ditemukan untuk menguji larangan perubahan status")

        _, invalid_user_body = panggil(
            "PATCH user dengan status tidak valid",
            "PATCH",
            "/api/admin/users/1",
            admin,
            400,
            payload={"status": "unknown"},
        )
        cek_error("PATCH user status tidak valid", invalid_user_body)
        _, invalid_product_body = panggil(
            "PATCH produk dengan status tidak valid",
            "PATCH",
            "/api/admin/products/1/status",
            admin,
            400,
            payload={"status": "sold"},
        )
        cek_error("PATCH produk status tidak valid", invalid_product_body)

        print("\n=== LARANGAN PERUBAHAN ADMIN LAIN DAN RESOURCE HILANG ===")
        _, other_admins = panggil(
            "Cari admin lain",
            "GET",
            "/api/admin/users",
            admin,
            200,
            params={"role": "admin", "per_page": 100},
        )
        if isinstance(other_admins, dict) and own_admin:
            other_admin = next(
                (user for user in other_admins.get("users", []) if user.get("id") != own_admin["id"]),
                None,
            )
            if other_admin:
                status_code, body = panggil(
                    "Admin mengubah status admin lain",
                    "PATCH",
                    f"/api/admin/users/{other_admin['id']}",
                    admin,
                    403,
                    payload={"status": "suspended"},
                )
                if status_code == 403:
                    cek_error("Admin lain tidak dapat diubah", body)
            else:
                hasil["lewat"] += 1
                print("[LEWAT] Tidak ada akun admin lain untuk menguji larangan perubahan")

        panggil("PATCH user tidak ditemukan", "PATCH", "/api/admin/users/2147483647", admin, 404,
               payload={"status": "active"})
        panggil("PATCH produk tidak ditemukan", "PATCH", "/api/admin/products/2147483647/status", admin, 404,
               payload={"status": "archived"})

        print("\n=== PERUBAHAN STATUS YANG DIPULIHKAN ===")
        user_to_test = cari_user_yang_aman(admin, own_admin["id"] if own_admin else None)
        uji_user_status(admin, user_to_test, restore)

        product_to_test = cari_produk_yang_aman(admin)
        uji_produk_status(admin, product_to_test, restore)

        zero_stock_product = cari_produk_stok_nol(admin)
        if zero_stock_product:
            status_code, body = panggil(
                "Produk stok 0 tidak dapat diaktifkan",
                "PATCH",
                f"/api/admin/products/{zero_stock_product['id']}/status",
                admin,
                400,
                payload={"status": "active"},
            )
            if status_code == 400:
                cek_error("Produk stok 0 tidak dapat diaktifkan", body)
        else:
            hasil["lewat"] += 1
            print("[LEWAT] Tidak ada produk non-sold dengan stok 0 untuk uji aktivasi")

        sold_status, sold_products = panggil(
            "Cari produk sold",
            "GET",
            "/api/admin/products",
            admin,
            200,
            params={"status": "sold", "per_page": 100},
        )
        sold_product = None
        if sold_status == 200 and isinstance(sold_products, dict):
            sold_product = next(iter(sold_products.get("products", [])), None)
        if sold_product:
            status_code, body = panggil(
                "Produk sold tidak dapat diubah",
                "PATCH",
                f"/api/admin/products/{sold_product['id']}/status",
                admin,
                409,
                payload={"status": "archived"},
            )
            if status_code == 409:
                cek_error("Produk sold tidak dapat diubah", body)
        else:
            hasil["lewat"] += 1
            print("[LEWAT] Tidak ada produk sold untuk menguji status 409")
    finally:
        if admin:
            pulihkan_data(admin, restore)

    print(
        f"\n=== SELESAI: {hasil['lolos']} lolos, "
        f"{hasil['gagal']} gagal, {hasil['lewat']} dilewati ==="
    )


if __name__ == "__main__":
    main()
