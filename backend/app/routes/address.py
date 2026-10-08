from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import update

from app.extensions import db
from app.models import Address, User, UserStatus
from app.schemas.address import AddressCreateSchema, AddressSchema

address_bp = Blueprint("addresses", __name__)
address_create_schema = AddressCreateSchema()
address_schema = AddressSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


@address_bp.get("")
@jwt_required()
def list_addresses():
    user, error = _current_active_user()
    if error:
        return error

    addresses = db.session.scalars(
        db.select(Address)
        .where(Address.user_id == user.id)
        .order_by(Address.is_default.desc(), Address.id.desc())
    ).all()
    return jsonify(addresses=address_schema.dump(addresses, many=True))


@address_bp.post("")
@jwt_required()
def create_address():
    user, error = _current_active_user()
    if error:
        return error

    data = address_create_schema.load(request.get_json() or {})
    if data["is_default"]:
        db.session.execute(
            update(Address)
            .where(Address.user_id == user.id, Address.is_default.is_(True))
            .values(is_default=False)
        )

    address = Address(user_id=user.id, **data)
    db.session.add(address)
    db.session.commit()
    return jsonify(address=address_schema.dump(address)), 201
