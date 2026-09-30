from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Cart, CartItem, CartStatus, Product, ProductStatus, User, UserStatus
from app.schemas.cart import CartItemCreateSchema, CartItemQuantitySchema, CartSchema

cart_bp = Blueprint("cart", __name__)
cart_schema = CartSchema()
cart_item_create_schema = CartItemCreateSchema()
cart_item_quantity_schema = CartItemQuantitySchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _get_active_cart(user):
    return db.session.scalar(
        db.select(Cart).where(Cart.user_id == user.id, Cart.status == CartStatus.active)
    )


def _get_or_create_active_cart(user):
    cart = _get_active_cart(user)
    if cart is not None:
        return cart

    cart = Cart(user_id=user.id, status=CartStatus.active)
    db.session.add(cart)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        cart = _get_active_cart(user)
        if cart is None:
            raise
    return cart


def _owned_cart_item(item_id, user):
    item = db.session.get(CartItem, item_id)
    if item is None:
        return None, (jsonify(error="Item cart tidak ditemukan"), 404)
    if item.cart.user_id != user.id:
        return None, (jsonify(error="Item cart bukan milik user"), 403)
    if item.cart.status != CartStatus.active:
        return None, (jsonify(error="Cart tidak aktif"), 409)
    return item, None


@cart_bp.get("")
@jwt_required()
def get_cart():
    user, error = _current_active_user()
    if error:
        return error

    cart = _get_or_create_active_cart(user)
    return jsonify(cart=cart_schema.dump(cart))


@cart_bp.post("/items")
@jwt_required()
def add_cart_item():
    user, error = _current_active_user()
    if error:
        return error

    data = cart_item_create_schema.load(request.get_json() or {})
    product = db.session.get(Product, data["product_id"])
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if product.status != ProductStatus.active:
        return jsonify(error="Hanya produk aktif yang dapat ditambahkan ke cart"), 400
    if product.store.seller_id == user.id:
        return jsonify(error="Produk dari toko sendiri tidak dapat ditambahkan ke cart"), 400
    if data["quantity"] > product.stock:
        return jsonify(error="Stok produk tidak mencukupi"), 409

    cart = _get_or_create_active_cart(user)
    cart = db.session.scalar(
        db.select(Cart).where(Cart.id == cart.id).with_for_update()
    )
    item = db.session.scalar(
        db.select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product.id,
        )
    )
    created = item is None
    if created:
        item = CartItem(
            product_id=product.id,
            quantity=data["quantity"],
            price_snapshot=product.price,
        )
        cart.items.append(item)
    else:
        quantity = item.quantity + data["quantity"]
        if quantity > product.stock:
            return jsonify(error="Stok produk tidak mencukupi"), 409
        item.quantity = quantity
        item.price_snapshot = product.price

    db.session.commit()
    return jsonify(cart=cart_schema.dump(cart)), 201 if created else 200


@cart_bp.patch("/items/<int:item_id>")
@jwt_required()
def update_cart_item(item_id):
    user, error = _current_active_user()
    if error:
        return error

    data = cart_item_quantity_schema.load(request.get_json() or {})
    item, error = _owned_cart_item(item_id, user)
    if error:
        return error
    if data["quantity"] > item.product.stock:
        return jsonify(error="Stok produk tidak mencukupi"), 409

    item.quantity = data["quantity"]
    db.session.commit()
    return jsonify(cart=cart_schema.dump(item.cart))


@cart_bp.delete("/items/<int:item_id>")
@jwt_required()
def remove_cart_item(item_id):
    user, error = _current_active_user()
    if error:
        return error

    item, error = _owned_cart_item(item_id, user)
    if error:
        return error
    cart = item.cart
    cart.items.remove(item)
    db.session.commit()
    return jsonify(cart=cart_schema.dump(cart))


@cart_bp.delete("")
@jwt_required()
def clear_cart():
    user, error = _current_active_user()
    if error:
        return error

    cart = _get_active_cart(user)
    if cart is None:
        return jsonify(message="Cart sudah kosong", items=[], total="0.00")

    cart.items.clear()
    db.session.commit()
    return jsonify(cart=cart_schema.dump(cart))