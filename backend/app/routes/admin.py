from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import Product, ProductImageType, ProductStatus, User, UserRole, UserStatus
from app.schemas.admin import (
    AdminProductListQuerySchema,
    AdminProductStatusUpdateSchema,
    AdminUserListQuerySchema,
    AdminUserStatusUpdateSchema,
)

admin_bp = Blueprint("admin", __name__)
admin_user_list_query_schema = AdminUserListQuerySchema()
admin_product_list_query_schema = AdminProductListQuerySchema()
admin_user_status_update_schema = AdminUserStatusUpdateSchema()
admin_product_status_update_schema = AdminProductStatusUpdateSchema()


def _current_admin():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    if user.role != UserRole.admin:
        return None, (jsonify(error="Hanya admin yang dapat mengakses endpoint ini"), 403)
    return user, None


def _user_item(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "status": user.status.value,
        "created_at": user.created_at.isoformat(),
    }


def _product_item(product):
    main_image = next(
        (image.image_url for image in product.images if image.image_type == ProductImageType.main),
        None,
    )
    return {
        "id": product.id,
        "name": product.name,
        "price": str(product.price),
        "stock": product.stock,
        "status": product.status.value,
        "store_id": product.store_id,
        "store_name": product.store.store_name,
        "category": {"id": product.category.id, "name": product.category.name},
        "condition": {"id": product.condition.id, "name": product.condition.name},
        "main_image": main_image,
        "created_at": product.created_at.isoformat(),
    }


@admin_bp.get("/users")
@jwt_required()
def list_users():
    _, error = _current_admin()
    if error:
        return error

    filters = admin_user_list_query_schema.load(request.args)
    query = select(User)
    if filters.get("role"):
        query = query.where(User.role == UserRole(filters["role"]))
    if filters.get("status"):
        query = query.where(User.status == UserStatus(filters["status"]))
    search = filters.get("search", "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
    query = query.order_by(User.created_at.desc(), User.id.desc())

    pagination = db.paginate(
        query,
        page=filters["page"],
        per_page=filters["per_page"],
        error_out=False,
    )
    return jsonify(
        users=[_user_item(user) for user in pagination.items],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
        pages=pagination.pages,
    )


@admin_bp.patch("/users/<int:user_id>")
@jwt_required()
def update_user_status(user_id):
    admin, error = _current_admin()
    if error:
        return error

    data = admin_user_status_update_schema.load(request.get_json() or {})
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error="User tidak ditemukan"), 404
    if user.id == admin.id:
        return jsonify(error="Admin tidak dapat mengubah status akunnya sendiri"), 400
    if user.role == UserRole.admin:
        return jsonify(error="Status akun admin lain tidak dapat diubah"), 403

    user.status = UserStatus(data["status"])
    db.session.commit()
    return jsonify(user=_user_item(user))


@admin_bp.get("/products")
@jwt_required()
def list_products():
    _, error = _current_admin()
    if error:
        return error

    filters = admin_product_list_query_schema.load(request.args)
    query = (
        select(Product)
        .options(
            selectinload(Product.store),
            selectinload(Product.category),
            selectinload(Product.condition),
            selectinload(Product.images),
        )
    )
    if filters.get("status"):
        query = query.where(Product.status == ProductStatus(filters["status"]))
    if filters.get("store_id") is not None:
        query = query.where(Product.store_id == filters["store_id"])
    search = filters.get("search", "").strip()
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    query = query.order_by(Product.created_at.desc(), Product.id.desc())

    pagination = db.paginate(
        query,
        page=filters["page"],
        per_page=filters["per_page"],
        error_out=False,
    )
    return jsonify(
        products=[_product_item(product) for product in pagination.items],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
        pages=pagination.pages,
    )


@admin_bp.patch("/products/<int:product_id>/status")
@jwt_required()
def update_product_status(product_id):
    _, error = _current_admin()
    if error:
        return error

    data = admin_product_status_update_schema.load(request.get_json() or {})
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if product.status == ProductStatus.sold:
        return jsonify(error="Produk yang sudah terjual tidak dapat diubah statusnya"), 409
    if data["status"] == ProductStatus.active.value and product.stock <= 0:
        return jsonify(error="Produk dengan stok 0 tidak dapat diaktifkan"), 400

    product.status = ProductStatus(data["status"])
    db.session.commit()
    db.session.refresh(product)
    return jsonify(product=_product_item(product))
