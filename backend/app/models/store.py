import enum

from sqlalchemy import Enum, func

from app.extensions import db


class StoreStatus(enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    rejected = "rejected"


class Store(db.Model):
    __tablename__ = "stores"

    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    store_name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    logo = db.Column(db.String(500))
    status = db.Column(
        Enum(StoreStatus, values_callable=lambda values: [item.value for item in values], name="store_status"),
        nullable=False,
        default=StoreStatus.pending,
    )
    rating_avg = db.Column(db.Numeric(3, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    seller = db.relationship("User", back_populates="store")