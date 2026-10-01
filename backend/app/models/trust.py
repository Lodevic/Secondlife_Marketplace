import enum

from sqlalchemy import Enum, Index, func

from app.extensions import db


class ReviewStatus(enum.Enum):
    published = "published"
    hidden = "hidden"


class ReportTargetType(enum.Enum):
    product = "product"
    seller = "seller"
    transaction = "transaction"
    user = "user"


class ReportStatus(enum.Enum):
    pending = "pending"
    investigating = "investigating"
    resolved = "resolved"
    rejected = "rejected"


class Review(db.Model):
    __tablename__ = "reviews"
    __table_args__ = (
        Index("ix_reviews_buyer_id", "buyer_id"),
        Index("ix_reviews_seller_id", "seller_id"),
        Index("ix_reviews_product_id", "product_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    order_item_id = db.Column(
        db.Integer,
        db.ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    buyer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    product_rating = db.Column(db.Integer, nullable=False)
    seller_rating = db.Column(db.Integer, nullable=False)
    shipping_rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    status = db.Column(
        Enum(ReviewStatus, values_callable=lambda values: [item.value for item in values], name="review_status"),
        nullable=False,
        default=ReviewStatus.published,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    order_item = db.relationship("OrderItem")
    buyer = db.relationship("User", foreign_keys=[buyer_id])
    seller = db.relationship("User", foreign_keys=[seller_id])
    product = db.relationship("Product")


class Report(db.Model):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_status", "status"),
        Index("ix_reports_target", "target_type", "target_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(
        Enum(
            ReportTargetType,
            values_callable=lambda values: [item.value for item in values],
            name="report_target_type",
        ),
        nullable=False,
    )
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        Enum(ReportStatus, values_callable=lambda values: [item.value for item in values], name="report_status"),
        nullable=False,
        default=ReportStatus.pending,
    )
    handled_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    handled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    resolution_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    handler = db.relationship("User", foreign_keys=[handled_by])