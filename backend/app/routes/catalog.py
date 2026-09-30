import re
import unicodedata

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy import func, or_, update
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Category,
    CategoryStatus,
    Condition,
    Product,
    ProductImage,
    ProductImageType,
    ProductStatus,
    Store,
    User,
    UserRole,
)
from app.schemas.catalog import (
    CategoryCreateSchema,
    CategorySchema,
    ConditionSchema,
    ProductCreateSchema,
    ProductImageCreateSchema,
    ProductImageSchema,
    ProductListQuerySchema,
    ProductSchema,
    ProductUpdateSchema,
)

categories_bp = Blueprint("categories", __name__)
conditions_bp = Blueprint("conditions", __name__)
products_bp = Blueprint("products", __name__)

category_create_schema = CategoryCreateSchema()
category_schema = CategorySchema()
condition_schema = ConditionSchema()
product_create_schema = ProductCreateSchema()
product_image_create_schema = ProductImageCreateSchema()
product_image_schema = ProductImageSchema()
product_list_query_schema = ProductListQuerySchema()
product_schema = ProductSchema()
product_update_schema = ProductUpdateSchema()


def _current_user(optional=False):
    verify_jwt_in_request(optional=optional)
    identity = get_jwt_identity()
    return db.session.get(User, int(identity)) if identity is not None else None


def _slugify(value):
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "category"


def _validate_product_references(data):
    if "category_id" in data:
        category = db.session.get(Category, data["category_id"])
        if category is None or category.status != CategoryStatus.active:
            return "Kategori tidak ditemukan atau tidak aktif"
    if "condition_id" in data and db.session.get(Condition, data["condition_id"]) is None:
        return "Kondisi barang tidak ditemukan"
    return None


def _product_is_visible(product, user):
    if product.status == ProductStatus.active:
        return True
    return user is not None and (
        user.role == UserRole.admin or product.store.seller_id == user.id
    )


def _set_product_images(product, images):
    for index, image in enumerate(images):
        image_type = image.get("image_type")
        if image_type is None:
            image_type = "main" if index == 0 and not product.images else "gallery"
        sort_order = image.get("sort_order")
        if sort_order is None:
            sort_order = len(product.images)
        product.images.append(
            ProductImage(
                image_url=image["image_url"],
                image_type=ProductImageType(image_type),
                sort_order=sort_order,
            )
        )


@categories_bp.get("")
def list_categories():
    categories = db.session.scalars(db.select(Category).order_by(Category.name)).all()
    return jsonify(categories=category_schema.dump(categories, many=True))


@categories_bp.post("")
@jwt_required()
def create_category():
    user = _current_user()
    if user is None or user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat membuat kategori"), 403

    data = category_create_schema.load(request.get_json() or {})
    if data["parent_id"] is not None and db.session.get(Category, data["parent_id"]) is None:
        return jsonify(error="Kategori induk tidak ditemukan"), 404

    category = Category(
        name=data["name"].strip(),
        slug=(data["slug"] or _slugify(data["name"])).strip().lower(),
        parent_id=data["parent_id"],
        status=CategoryStatus(data["status"]),
    )
    db.session.add(category)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Slug kategori sudah digunakan"), 409
    return jsonify(category=category_schema.dump(category)), 201


@conditions_bp.get("")
def list_conditions():
    conditions = db.session.scalars(db.select(Condition).order_by(Condition.id)).all()
    return jsonify(conditions=condition_schema.dump(conditions, many=True))


@products_bp.post("")
@jwt_required()
def create_product():
    user = _current_user()
    if user is None:
        return jsonify(error="User tidak ditemukan"), 404
    if user.role != UserRole.seller:
        return jsonify(error="Hanya seller yang dapat membuat produk"), 403
    if user.store is None:
        return jsonify(error="Seller harus memiliki toko terlebih dahulu"), 409

    data = product_create_schema.load(request.get_json() or {})
    reference_error = _validate_product_references(data)
    if reference_error:
        return jsonify(error=reference_error), 400

    images = data.pop("images")
    status = ProductStatus(data.pop("status"))
    product = Product(
        store_id=user.store.id,
        status=status,
        **data,
    )
    _set_product_images(product, images)
    db.session.add(product)
    db.session.commit()
    return jsonify(product=product_schema.dump(product)), 201


@products_bp.get("")
def list_products():
    user = _current_user(optional=True)
    filters = product_list_query_schema.load(request.args)
    min_price = filters.get("min_price")
    max_price = filters.get("max_price")
    if min_price is not None and max_price is not None and min_price > max_price:
        return jsonify(error="min_price tidak boleh melebihi max_price"), 400

    query = db.select(Product)
    if user is None:
        query = query.where(Product.status == ProductStatus.active)
    elif user.role == UserRole.admin:
        pass
    else:
        query = query.where(
            or_(
                Product.status == ProductStatus.active,
                Product.store.has(Store.seller_id == user.id),
            )
        )

    query = query.where(Product.status == ProductStatus(filters.get("status", "active")))
    if "category_id" in filters:
        query = query.where(Product.category_id == filters["category_id"])
    if "condition_id" in filters:
        query = query.where(Product.condition_id == filters["condition_id"])
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    if filters.get("search"):
        search = f"%{filters['search'].strip()}%"
        query = query.where(or_(Product.name.ilike(search), Product.description.ilike(search)))

    query = query.order_by(Product.created_at.desc(), Product.id.desc())
    pagination = db.paginate(
        query,
        page=filters["page"],
        per_page=filters["per_page"],
        error_out=False,
    )
    return jsonify(
        products=product_schema.dump(pagination.items, many=True),
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
        pages=pagination.pages,
    )


@products_bp.get("/<int:product_id>")
def get_product(product_id):
    user = _current_user(optional=True)
    product = db.session.get(Product, product_id)
    if product is None or not _product_is_visible(product, user):
        return jsonify(error="Produk tidak ditemukan"), 404

    db.session.execute(
        update(Product)
        .where(Product.id == product.id)
        .values(view_count=Product.view_count + 1)
    )
    db.session.commit()
    db.session.refresh(product)
    return jsonify(product=product_schema.dump(product))


@products_bp.put("/<int:product_id>")
@jwt_required()
def update_product(product_id):
    user = _current_user()
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if user is None or user.role != UserRole.seller or product.store.seller_id != user.id:
        return jsonify(error="Hanya pemilik produk yang dapat mengubah produk"), 403

    data = product_update_schema.load(request.get_json() or {})
    if product.status == ProductStatus.sold and data.get("status", "sold") != "sold":
        return jsonify(error="Status produk yang sudah terjual tidak dapat diubah"), 409
    reference_error = _validate_product_references(data)
    if reference_error:
        return jsonify(error=reference_error), 400

    for key, value in data.items():
        if key == "status":
            value = ProductStatus(value)
        setattr(product, key, value)
    db.session.commit()
    return jsonify(product=product_schema.dump(product))


@products_bp.delete("/<int:product_id>")
@jwt_required()
def archive_product(product_id):
    user = _current_user()
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if user is None or user.role != UserRole.seller or product.store.seller_id != user.id:
        return jsonify(error="Hanya pemilik produk yang dapat mengarsipkan produk"), 403
    if product.status == ProductStatus.sold:
        return jsonify(error="Produk yang sudah terjual tidak dapat diarsipkan"), 409

    product.status = ProductStatus.archived
    db.session.commit()
    return jsonify(product=product_schema.dump(product))


@products_bp.post("/<int:product_id>/images")
@jwt_required()
def add_product_image(product_id):
    user = _current_user()
    product = db.session.get(Product, product_id)
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if user is None or user.role != UserRole.seller or product.store.seller_id != user.id:
        return jsonify(error="Hanya pemilik produk yang dapat menambah gambar"), 403

    data = product_image_create_schema.load(request.get_json() or {})
    sort_order = data.pop("sort_order")
    if sort_order is None:
        sort_order = len(product.images)
    image = ProductImage(
        product_id=product.id,
        image_url=data["image_url"],
        image_type=ProductImageType(data["image_type"]),
        sort_order=sort_order,
    )
    db.session.add(image)
    db.session.commit()
    return jsonify(image=product_image_schema.dump(image)), 201