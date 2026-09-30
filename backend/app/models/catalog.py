import enum

from sqlalchemy import Enum, func

from app.extensions import db


class CategoryStatus(enum.Enum):
    active = "active"
    inactive = "inactive"


class ProductStatus(enum.Enum):
    draft = "draft"
    pending = "pending"
    active = "active"
    sold = "sold"
    archived = "archived"
    rejected = "rejected"


class ProductImageType(enum.Enum):
    main = "main"
    gallery = "gallery"


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(140), nullable=False, unique=True)
    status = db.Column(
        Enum(CategoryStatus, values_callable=lambda values: [item.value for item in values], name="category_status"),
        nullable=False,
        default=CategoryStatus.active,
    )

    parent = db.relationship("Category", remote_side=[id], back_populates="children")
    children = db.relationship("Category", back_populates="parent")
    products = db.relationship("Product", back_populates="category")


class Condition(db.Model):
    __tablename__ = "conditions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, nullable=True)

    products = db.relationship("Product", back_populates="condition")


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey("stores.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True)
    condition_id = db.Column(db.Integer, db.ForeignKey("conditions.id"), nullable=False, index=True)
    name = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    year_used = db.Column(db.Integer, nullable=True)
    location = db.Column(db.String(160), nullable=False)
    status = db.Column(
        Enum(ProductStatus, values_callable=lambda values: [item.value for item in values], name="product_status"),
        nullable=False,
        default=ProductStatus.draft,
        index=True,
    )
    view_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    store = db.relationship("Store", back_populates="products")
    category = db.relationship("Category", back_populates="products")
    condition = db.relationship("Condition", back_populates="products")
    images = db.relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order, ProductImage.id",
    )


class ProductImage(db.Model):
    __tablename__ = "product_images"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = db.Column(db.String(1000), nullable=False)
    image_type = db.Column(
        Enum(
            ProductImageType,
            values_callable=lambda values: [item.value for item in values],
            name="product_image_type",
        ),
        nullable=False,
        default=ProductImageType.gallery,
    )
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    product = db.relationship("Product", back_populates="images")