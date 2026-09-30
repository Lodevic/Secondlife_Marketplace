from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import Schema, fields, validate
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Product, ProductStatus, User, UserStatus, Wishlist
from app.schemas.wishlist import WishlistSchema

wishlist_bp = Blueprint("wishlist", __name__)
wishlist_schema = WishlistSchema()


class WishlistCreateSchema(Schema):
    product_id = fields.Integer(required=True, validate=validate.Range(min=1))


wishlist_create_schema = WishlistCreateSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


@wishlist_bp.get("")
@jwt_required()
def list_wishlist():
    user, error = _current_active_user()
    if error:
        return error

    items = db.session.scalars(
        db.select(Wishlist)
        .where(Wishlist.user_id == user.id)
        .order_by(Wishlist.created_at.desc(), Wishlist.id.desc())
    ).all()
    return jsonify(wishlist=wishlist_schema.dump(items, many=True))


@wishlist_bp.post("")
@jwt_required()
def add_to_wishlist():
    user, error = _current_active_user()
    if error:
        return error

    data = wishlist_create_schema.load(request.get_json() or {})
    product = db.session.get(Product, data["product_id"])
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if product.status != ProductStatus.active:
        return jsonify(error="Hanya produk aktif yang dapat ditambahkan ke wishlist"), 400
    if product.store.seller_id == user.id:
        return jsonify(error="Produk dari toko sendiri tidak dapat ditambahkan ke wishlist"), 400

    item = db.session.scalar(
        db.select(Wishlist).where(
            Wishlist.user_id == user.id,
            Wishlist.product_id == product.id,
        )
    )
    if item is not None:
        return jsonify(error="Produk sudah ada di wishlist"), 409

    item = Wishlist(user_id=user.id, product_id=product.id)
    db.session.add(item)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Produk sudah ada di wishlist"), 409
    return jsonify(wishlist=wishlist_schema.dump(item)), 201


@wishlist_bp.delete("/<int:product_id>")
@jwt_required()
def remove_from_wishlist(product_id):
    user, error = _current_active_user()
    if error:
        return error

    item = db.session.scalar(
        db.select(Wishlist).where(
            Wishlist.user_id == user.id,
            Wishlist.product_id == product_id,
        )
    )
    if item is None:
        return jsonify(error="Produk tidak ditemukan di wishlist"), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Produk dihapus dari wishlist")