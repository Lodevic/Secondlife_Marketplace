import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Address,
    Cart,
    CartStatus,
    Offer,
    OfferStatus,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
    Product,
    ProductStatus,
    Shipment,
    ShipmentStatus,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.order import (
    CheckoutSchema,
    OrderListQuerySchema,
    OrderSchema,
    ShipOrderSchema,
    ShipmentStatusSchema,
)

order_bp = Blueprint("orders", __name__)
checkout_schema = CheckoutSchema()
order_list_query_schema = OrderListQuerySchema()
order_schema = OrderSchema()
ship_order_schema = ShipOrderSchema()
shipment_status_schema = ShipmentStatusSchema()

SHIPPING_COST_PER_ORDER = Decimal("15000.00")
PLATFORM_FEE_RATE = Decimal("0.05")
ZERO_MONEY = Decimal("0.00")
CENT = Decimal("0.01")


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _order_number():
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    while True:
        candidate = f"SL-{date_part}-{secrets.randbelow(1_000_000):06d}"
        exists = db.session.scalar(select(Order.id).where(Order.order_number == candidate))
        if exists is None:
            return candidate


def _new_order(buyer, address, payment_method, seller_id, line_items):
    subtotal = sum((item["price"] * item["quantity"] for item in line_items), ZERO_MONEY)
    platform_fee = (subtotal * PLATFORM_FEE_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
    total_amount = subtotal + SHIPPING_COST_PER_ORDER + platform_fee
    order = Order(
        order_number=_order_number(),
        buyer_id=buyer.id,
        address_id=address.id,
        subtotal=subtotal,
        shipping_cost=SHIPPING_COST_PER_ORDER,
        platform_fee=platform_fee,
        discount=ZERO_MONEY,
        total_amount=total_amount,
        status=OrderStatus.pending_payment,
    )
    order.items.extend(
        OrderItem(
            product_id=item["product"].id,
            seller_id=seller_id,
            offer_id=item.get("offer_id"),
            product_name_snapshot=item["product"].name,
            price=item["price"],
            quantity=item["quantity"],
            subtotal=item["price"] * item["quantity"],
        )
        for item in line_items
    )
    order.payments.append(
        Payment(
            payment_method=payment_method.strip(),
            payment_reference=f"PAY-{secrets.token_hex(16)}",
            amount=total_amount,
            status=PaymentStatus.pending,
        )
    )
    db.session.add(order)
    return order


def _order_for_update(order_id):
    return db.session.scalar(select(Order).where(Order.id == order_id).with_for_update())


def _commit_with_rollback():
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _seller_participates(order, user):
    return user.role == UserRole.seller and any(item.seller_id == user.id for item in order.items)


def _latest_shipment(order):
    return db.session.scalar(
        select(Shipment)
        .where(Shipment.order_id == order.id)
        .order_by(Shipment.id.desc())
        .limit(1)
    )


def cancel_order_and_restore_stock(order):
    quantities = {}
    for item in order.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products = db.session.scalars(
        select(Product)
        .where(Product.id.in_(sorted(quantities)))
        .order_by(Product.id)
        .with_for_update()
    ).all()
    for product in products:
        product.stock += quantities[product.id]
        if product.status == ProductStatus.sold and product.stock > 0:
            product.status = ProductStatus.active

    for payment in order.payments:
        if payment.status == PaymentStatus.pending:
            payment.status = PaymentStatus.failed
    order.status = OrderStatus.cancelled


@order_bp.post("/checkout")
@jwt_required()
def checkout():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.buyer:
        return jsonify(error="Hanya buyer yang dapat checkout"), 403

    data = checkout_schema.load(request.get_json() or {})
    address = db.session.get(Address, data["address_id"])
    if address is None:
        return jsonify(error="Alamat tidak ditemukan"), 404
    if address.user_id != user.id:
        return jsonify(error="Alamat bukan milik user"), 403

    orders = []
    try:
        if data.get("offer_id") is not None:
            offer = db.session.scalar(
                select(Offer).where(Offer.id == data["offer_id"]).with_for_update()
            )
            if offer is None:
                return jsonify(error="Penawaran tidak ditemukan"), 404
            if offer.status != OfferStatus.accepted:
                return jsonify(error="Penawaran belum diterima"), 409
            if offer.buyer_id != user.id:
                return jsonify(error="Penawaran bukan milik user"), 403
            if offer.expires_at is not None:
                expires_at = offer.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at <= datetime.now(timezone.utc):
                    return jsonify(error="Penawaran sudah kedaluwarsa"), 409
            used = db.session.scalar(
                select(OrderItem.id)
                .join(Order, Order.id == OrderItem.order_id)
                .where(OrderItem.offer_id == offer.id, Order.status != OrderStatus.cancelled)
                .limit(1)
            )
            if used is not None:
                return jsonify(error="Penawaran sudah digunakan"), 409

            product = db.session.scalar(
                select(Product).where(Product.id == offer.product_id).with_for_update()
            )
            if product is None:
                return jsonify(error="Produk tidak ditemukan"), 404
            if product.status != ProductStatus.active or product.stock < 1:
                return jsonify(error="Produk tidak aktif atau stok tidak mencukupi"), 400
            product.stock -= 1
            if product.stock == 0:
                product.status = ProductStatus.sold
            orders.append(
                _new_order(
                    user,
                    address,
                    data["payment_method"],
                    offer.seller_id,
                    [{"product": product, "quantity": 1, "price": offer.amount, "offer_id": offer.id}],
                )
            )
        else:
            cart = db.session.scalar(
                select(Cart)
                .where(Cart.user_id == user.id, Cart.status == CartStatus.active)
                .with_for_update()
            )
            if cart is None or not cart.items:
                return jsonify(error="Cart kosong"), 400

            product_ids = sorted({item.product_id for item in cart.items})
            products = db.session.scalars(
                select(Product)
                .where(Product.id.in_(product_ids))
                .order_by(Product.id)
                .with_for_update()
            ).all()
            products_by_id = {product.id: product for product in products}
            invalid_items = []
            grouped_items = {}
            for cart_item in cart.items:
                product = products_by_id.get(cart_item.product_id)
                reason = None
                if product is None:
                    reason = "Produk tidak ditemukan"
                elif product.status != ProductStatus.active:
                    reason = "Produk tidak aktif"
                elif product.stock < cart_item.quantity:
                    reason = "Stok produk tidak mencukupi"
                elif product.store.seller_id == user.id:
                    reason = "Produk dari toko sendiri tidak dapat dibeli"
                if reason:
                    invalid_items.append(
                        {
                            "item_id": cart_item.id,
                            "product_id": cart_item.product_id,
                            "error": reason,
                        }
                    )
                    continue
                seller_id = product.store.seller_id
                grouped_items.setdefault(seller_id, []).append(
                    {
                        "product": product,
                        "quantity": cart_item.quantity,
                        "price": product.price,
                    }
                )

            if invalid_items:
                return jsonify(error="Ada item cart yang tidak dapat dibeli", items=invalid_items), 400

            for seller_id, line_items in grouped_items.items():
                for item in line_items:
                    product = item["product"]
                    product.stock -= item["quantity"]
                    if product.stock == 0:
                        product.status = ProductStatus.sold
                orders.append(
                    _new_order(user, address, data["payment_method"], seller_id, line_items)
                )
            cart.items.clear()
            cart.status = CartStatus.checked_out

        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Gagal membuat order karena data duplikat"), 409
    except Exception:
        db.session.rollback()
        raise

    return jsonify(orders=order_schema.dump(orders, many=True)), 201


@order_bp.get("")
@jwt_required()
def list_orders():
    user, error = _current_active_user()
    if error:
        return error
    filters = order_list_query_schema.load(request.args)
    role = filters["role"]
    query = db.select(Order)
    if role == "buyer":
        query = query.where(Order.buyer_id == user.id)
    elif role == "seller":
        if user.role != UserRole.seller:
            return jsonify(error="Hanya seller yang dapat melihat order sebagai seller"), 403
        query = query.where(Order.items.any(OrderItem.seller_id == user.id))
    else:
        if user.role != UserRole.admin:
            return jsonify(error="Hanya admin yang dapat melihat semua order"), 403
    if filters.get("status"):
        query = query.where(Order.status == OrderStatus(filters["status"]))

    pagination = db.paginate(
        query.order_by(Order.created_at.desc(), Order.id.desc()),
        page=filters["page"],
        per_page=filters["per_page"],
        error_out=False,
    )
    return jsonify(
        orders=order_schema.dump(pagination.items, many=True),
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
        pages=pagination.pages,
    )


@order_bp.get("/<int:order_id>")
@jwt_required()
def get_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if (
        user.role != UserRole.admin
        and order.buyer_id != user.id
        and not _seller_participates(order, user)
    ):
        return jsonify(error="Order bukan milik user"), 403
    return jsonify(order=order_schema.dump(order))


@order_bp.post("/<int:order_id>/cancel")
@jwt_required()
def cancel_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if order.buyer_id != user.id:
        return jsonify(error="Order bukan milik buyer"), 403
    if order.status != OrderStatus.pending_payment:
        return jsonify(error="Order hanya dapat dibatalkan saat menunggu pembayaran"), 409

    try:
        cancel_order_and_restore_stock(order)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify(order=order_schema.dump(order))


@order_bp.post("/<int:order_id>/process")
@jwt_required()
def process_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if not _seller_participates(order, user):
        return jsonify(error="Hanya seller pemilik order yang dapat memproses"), 403
    if order.status != OrderStatus.paid:
        return jsonify(error="Order hanya dapat diproses setelah dibayar"), 409
    order.status = OrderStatus.processing
    _commit_with_rollback()
    return jsonify(order=order_schema.dump(order))


@order_bp.post("/<int:order_id>/ship")
@jwt_required()
def ship_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    data = ship_order_schema.load(request.get_json() or {})
    data = {key: value.strip() for key, value in data.items()}
    if any(not value for value in data.values()):
        return jsonify(error="courier, tracking_number, dan shipping_method wajib diisi"), 400

    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if not _seller_participates(order, user):
        return jsonify(error="Hanya seller pemilik order yang dapat mengirim"), 403
    if order.status != OrderStatus.processing:
        return jsonify(error="Order hanya dapat dikirim saat berstatus processing"), 409

    shipment = Shipment(
        order_id=order.id,
        courier=data["courier"],
        tracking_number=data["tracking_number"],
        shipping_method=data["shipping_method"],
        status=ShipmentStatus.in_transit,
        shipped_at=datetime.now(timezone.utc),
    )
    db.session.add(shipment)
    order.status = OrderStatus.shipped
    _commit_with_rollback()
    return jsonify(order=order_schema.dump(order)), 201


@order_bp.patch("/<int:order_id>/shipment")
@jwt_required()
def update_shipment(order_id):
    user, error = _current_active_user()
    if error:
        return error
    data = shipment_status_schema.load(request.get_json() or {})
    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if not _seller_participates(order, user):
        return jsonify(error="Hanya seller pemilik order yang dapat mengubah pengiriman"), 403
    if order.status != OrderStatus.shipped:
        return jsonify(error="Status pengiriman hanya dapat diubah untuk order shipped"), 409
    shipment = _latest_shipment(order)
    if shipment is None:
        return jsonify(error="Data shipment tidak ditemukan"), 404
    shipment.status = ShipmentStatus(data["status"])
    _commit_with_rollback()
    return jsonify(order=order_schema.dump(order))


@order_bp.post("/<int:order_id>/receive")
@jwt_required()
def receive_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if order.buyer_id != user.id:
        return jsonify(error="Order bukan milik buyer"), 403
    if order.status != OrderStatus.shipped:
        return jsonify(error="Order hanya dapat diterima saat berstatus shipped"), 409
    shipment = _latest_shipment(order)
    if shipment is None:
        return jsonify(error="Data shipment tidak ditemukan"), 409

    now = datetime.now(timezone.utc)
    shipment.status = ShipmentStatus.delivered
    shipment.delivered_at = now
    order.status = OrderStatus.delivered
    _commit_with_rollback()
    return jsonify(order=order_schema.dump(order))


@order_bp.post("/<int:order_id>/complete")
@jwt_required()
def complete_order(order_id):
    user, error = _current_active_user()
    if error:
        return error
    order = _order_for_update(order_id)
    if order is None:
        return jsonify(error="Order tidak ditemukan"), 404
    if order.buyer_id != user.id:
        return jsonify(error="Order bukan milik buyer"), 403
    if order.status != OrderStatus.delivered:
        return jsonify(error="Order hanya dapat diselesaikan setelah diterima"), 409
    order.status = OrderStatus.completed
    _commit_with_rollback()
    return jsonify(order=order_schema.dump(order))