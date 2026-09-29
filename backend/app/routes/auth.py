from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required
from marshmallow import ValidationError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import User, UserRole, UserStatus
from app.schemas.auth import LoginSchema, RegisterSchema, UserSchema

auth_bp = Blueprint("auth", __name__)
register_schema = RegisterSchema()
login_schema = LoginSchema()
user_schema = UserSchema()


@auth_bp.post("/register")
def register():
    try:
        data = register_schema.load(request.get_json() or {})
    except ValidationError as error:
        raise error

    user = User(
        name=data["name"],
        email=data["email"].strip().lower(),
        password_hash=generate_password_hash(data["password"]),
        phone=data.get("phone"),
        role=UserRole(data["role"]),
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Email sudah terdaftar"), 409

    return jsonify(user=user_schema.dump(user)), 201


@auth_bp.post("/login")
def login():
    data = login_schema.load(request.get_json() or {})
    user = db.session.scalar(
        db.select(User).where(func.lower(User.email) == data["email"].strip().lower())
    )
    if (
        user is None
        or user.status != UserStatus.active
        or not check_password_hash(user.password_hash, data["password"])
    ):
        return jsonify(error="Email atau password salah"), 401

    identity = str(user.id)
    return jsonify(
        access_token=create_access_token(identity=identity),
        refresh_token=create_refresh_token(identity=identity),
        user=user_schema.dump(user),
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User tidak ditemukan"), 404
    return jsonify(user=user_schema.dump(user))