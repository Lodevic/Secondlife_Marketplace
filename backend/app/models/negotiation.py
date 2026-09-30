import enum

from sqlalchemy import Enum, Index, UniqueConstraint, func, text

from app.extensions import db


class OfferStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    countered = "countered"
    expired = "expired"
    cancelled = "cancelled"


class Offer(db.Model):
    __tablename__ = "offers"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    parent_offer_id = db.Column(db.Integer, db.ForeignKey("offers.id"), nullable=True, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    message = db.Column(db.Text, nullable=True)
    status = db.Column(
        Enum(OfferStatus, values_callable=lambda values: [item.value for item in values], name="offer_status"),
        nullable=False,
        default=OfferStatus.pending,
    )
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    product = db.relationship("Product")
    buyer = db.relationship("User", foreign_keys=[buyer_id])
    seller = db.relationship("User", foreign_keys=[seller_id])
    parent_offer = db.relationship("Offer", remote_side=[id], back_populates="counter_offers")
    counter_offers = db.relationship("Offer", back_populates="parent_offer")


class Chat(db.Model):
    __tablename__ = "chats"
    __table_args__ = (
        UniqueConstraint("buyer_id", "seller_id", "product_id", name="uq_chats_buyer_seller_product"),
        Index(
            "uq_chats_without_product",
            "buyer_id",
            "seller_id",
            unique=True,
            postgresql_where=text("product_id IS NULL"),
            sqlite_where=text("product_id IS NULL"),
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    buyer = db.relationship("User", foreign_keys=[buyer_id])
    seller = db.relationship("User", foreign_keys=[seller_id])
    product = db.relationship("Product")
    messages = db.relationship(
        "ChatMessage",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at, ChatMessage.id",
    )


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(1000), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    chat = db.relationship("Chat", back_populates="messages")
    sender = db.relationship("User")