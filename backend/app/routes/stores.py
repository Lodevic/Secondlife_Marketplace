from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Store, StoreStatus, User, UserRole
from app.schemas.store import StoreCreateSchema, StoreSchema

stores_bp = Blueprint("stores", __name__)
create_schema = StoreCreateSchema()
store_schema = StoreSchema()


@stores_bp.post("")
@jwt_required()
def create_store():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User tidak ditemukan"), 404
    if user.role != UserRole.seller:
        return jsonify(error="Hanya seller yang dapat membuat toko"), 403
    if user.store is not None:
        return jsonify(error="Seller sudah memiliki toko"), 409

    data = create_schema.load(request.get_json() or {})
    store = Store(seller_id=user.id, status=StoreStatus.pending, **data)
    db.session.add(store)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Seller sudah memiliki toko"), 409
    return jsonify(store=store_schema.dump(store)), 201


@stores_bp.get("/<int:store_id>")
def get_store(store_id):
    store = db.session.get(Store, store_id)
    if store is None:
        return jsonify(error="Toko tidak ditemukan"), 404
    return jsonify(store=store_schema.dump(store))