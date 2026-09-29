import enum

from sqlalchemy import Enum, func

from app.extensions import db


class UserRole(enum.Enum):
    buyer = "buyer"
    seller = "seller"
    admin = "admin"


class UserStatus(enum.Enum):
    active = "active"
    suspended = "suspended"
    blocked = "blocked"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30))
    role = db.Column(
        Enum(UserRole, values_callable=lambda values: [item.value for item in values], name="user_role"),
        nullable=False,
        default=UserRole.buyer,
    )
    status = db.Column(
        Enum(UserStatus, values_callable=lambda values: [item.value for item in values], name="user_status"),
        nullable=False,
        default=UserStatus.active,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    addresses = db.relationship("Address", back_populates="user", cascade="all, delete-orphan")
    store = db.relationship("Store", back_populates="seller", uselist=False)