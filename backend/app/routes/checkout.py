from decimal import Decimal

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Cart, CartStatus, ProductStatus, User, UserStatus

checkout_bp = Blueprint("checkout", __name__)


@checkout_bp.post("/preview")
@jwt_required()
def preview_checkout():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User tidak ditemukan"), 404
    if user.status != UserStatus.active:
        return jsonify(error="Akun tidak aktif"), 403

    cart = db.session.scalar(
        db.select(Cart).where(Cart.user_id == user.id, Cart.status == CartStatus.active)
    )
    if cart is None or not cart.items:
        return jsonify(error="Cart kosong"), 400

    groups = {}
    warnings = []
    total = Decimal("0.00")
    can_checkout = True

    for item in cart.items:
        product = item.product
        store = product.store
        group = groups.get(store.id)
        if group is None:
            group = {
                "store_id": store.id,
                "store_name": store.store_name,
                "items": [],
                "subtotal_amount": Decimal("0.00"),
            }
            groups[store.id] = group

        current_price = product.price
        subtotal = current_price * item.quantity
        group["items"].append(
            {
                "item_id": item.id,
                "product_id": product.id,
                "product_name": product.name,
                "quantity": item.quantity,
                "price_snapshot": str(item.price_snapshot),
                "current_price": str(current_price),
                "subtotal": str(subtotal),
            }
        )
        group["subtotal_amount"] += subtotal
        total += subtotal

        if current_price != item.price_snapshot:
            warnings.append(
                {
                    "type": "price_changed",
                    "item_id": item.id,
                    "message": f"Harga berubah dari {item.price_snapshot} menjadi {current_price}",
                }
            )
        if product.stock < item.quantity:
            warnings.append(
                {
                    "type": "stock_insufficient",
                    "item_id": item.id,
                    "message": f"Stok tersedia {product.stock}, sedangkan jumlah di cart {item.quantity}",
                }
            )
            can_checkout = False
        if product.status != ProductStatus.active:
            warnings.append(
                {
                    "type": "product_inactive",
                    "item_id": item.id,
                    "message": "Produk sudah tidak aktif",
                }
            )
            can_checkout = False

    stores = [
        {
            "store_id": group["store_id"],
            "store_name": group["store_name"],
            "items": group["items"],
            "subtotal": str(group["subtotal_amount"]),
        }
        for group in groups.values()
    ]
    return jsonify(
        stores=stores,
        total=str(total),
        warnings=warnings,
        can_checkout=can_checkout,
    )