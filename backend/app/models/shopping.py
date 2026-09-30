import enum

from sqlalchemy import CheckConstraint, Enum, Index, UniqueConstraint, func, text

from app.extensions import db


class CartStatus(enum.Enum):
    active = "active"
    checked_out = "checked_out"
    abandoned = "abandoned"


class Wishlist(db.Model):
    __tablename__ = "wishlists"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_wishlists_user_product"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    product = db.relationship("Product")


class Cart(db.Model):
    __tablename__ = "carts"
    __table_args__ = (
        Index(
            "uq_carts_active_user_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    status = db.Column(
        Enum(CartStatus, values_callable=lambda values: [item.value for item in values], name="cart_status"),
        nullable=False,
        default=CartStatus.active,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    items = db.relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(db.Model):
    __tablename__ = "cart_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_cart_items_quantity_positive"),
        UniqueConstraint("cart_id", "product_id", name="uq_cart_items_cart_product"),
    )

    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False)
    price_snapshot = db.Column(db.Numeric(12, 2), nullable=False)

    cart = db.relationship("Cart", back_populates="items")
    product = db.relationship("Product")