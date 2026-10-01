import enum

from sqlalchemy import Enum, Index, func

from app.extensions import db


class OrderStatus(enum.Enum):
    pending_payment = "pending_payment"
    paid = "paid"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    expired = "expired"
    refunded = "refunded"


class ShipmentStatus(enum.Enum):
    waiting = "waiting"
    picked_up = "picked_up"
    in_transit = "in_transit"
    delivered = "delivered"
    failed = "failed"


class Order(db.Model):
    __tablename__ = "orders"
    __table_args__ = (Index("ix_orders_buyer_id", "buyer_id"),)

    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(32), nullable=False, unique=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    address_id = db.Column(db.Integer, db.ForeignKey("addresses.id"), nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    shipping_cost = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    platform_fee = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    discount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    status = db.Column(
        Enum(OrderStatus, values_callable=lambda values: [item.value for item in values], name="order_status"),
        nullable=False,
        default=OrderStatus.pending_payment,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    buyer = db.relationship("User")
    address = db.relationship("Address")
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = db.relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    shipments = db.relationship("Shipment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(db.Model):
    __tablename__ = "order_items"
    __table_args__ = (
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_seller_id", "seller_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    offer_id = db.Column(db.Integer, db.ForeignKey("offers.id"), nullable=True)
    product_name_snapshot = db.Column(db.String(180), nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), nullable=False)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product")
    seller = db.relationship("User")
    offer = db.relationship("Offer")


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_method = db.Column(db.String(80), nullable=False)
    payment_reference = db.Column(db.String(80), nullable=False, unique=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(
        Enum(PaymentStatus, values_callable=lambda values: [item.value for item in values], name="payment_status"),
        nullable=False,
        default=PaymentStatus.pending,
    )
    paid_at = db.Column(db.DateTime(timezone=True), nullable=True)

    order = db.relationship("Order", back_populates="payments")


class Shipment(db.Model):
    __tablename__ = "shipments"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    courier = db.Column(db.String(100), nullable=False)
    tracking_number = db.Column(db.String(120), nullable=False)
    shipping_method = db.Column(db.String(100), nullable=False)
    status = db.Column(
        Enum(ShipmentStatus, values_callable=lambda values: [item.value for item in values], name="shipment_status"),
        nullable=False,
        default=ShipmentStatus.waiting,
    )
    shipped_at = db.Column(db.DateTime(timezone=True), nullable=True)
    delivered_at = db.Column(db.DateTime(timezone=True), nullable=True)

    order = db.relationship("Order", back_populates="shipments")