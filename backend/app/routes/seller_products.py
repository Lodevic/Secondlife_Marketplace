from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import Product, ProductImageType, ProductStatus, Store, User, UserRole, UserStatus
from app.schemas.admin import SellerProductListQuerySchema

seller_products_bp = Blueprint("seller_products", __name__)
seller_product_list_query_schema = SellerProductListQuerySchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


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
        "category": {"id": product.category.id, "name": product.category.name},
        "condition": {"id": product.condition.id, "name": product.condition.name},
        "main_image": main_image,
        "created_at": product.created_at.isoformat(),
    }


@seller_products_bp.get("/products")
@jwt_required()
def list_seller_products():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.seller:
        return jsonify(error="Hanya seller yang dapat mengakses produk toko"), 403

    store = db.session.scalar(select(Store).where(Store.seller_id == user.id))
    if store is None:
        return jsonify(error="Toko seller tidak ditemukan"), 404

    filters = seller_product_list_query_schema.load(request.args)
    query = (
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.condition),
        )
        .where(Product.store_id == store.id)
    )
    if filters.get("status"):
        query = query.where(Product.status == ProductStatus(filters["status"]))
    if filters.get("search", "").strip():
        query = query.where(Product.name.ilike(f"%{filters['search'].strip()}%"))
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
