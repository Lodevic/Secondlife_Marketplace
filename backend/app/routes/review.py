from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    OrderItem,
    OrderStatus,
    Review,
    ReviewStatus,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.review import (
    ReviewCreateSchema,
    ReviewListQuerySchema,
    ReviewModerationSchema,
    ReviewSchema,
)

review_bp = Blueprint("reviews", __name__)
review_create_schema = ReviewCreateSchema()
review_list_query_schema = ReviewListQuerySchema()
review_moderation_schema = ReviewModerationSchema()
review_schema = ReviewSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


@review_bp.post("")
@jwt_required()
def create_review():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.buyer:
        return jsonify(error="Hanya buyer yang dapat membuat review"), 403

    data = review_create_schema.load(request.get_json() or {})
    order_item = db.session.get(OrderItem, data["order_item_id"])
    if order_item is None:
        return jsonify(error="Order item tidak ditemukan"), 404
    if order_item.order.buyer_id != user.id:
        return jsonify(error="Order item bukan milik user"), 403
    if order_item.order.status != OrderStatus.completed:
        return jsonify(error="Order harus completed untuk direview"), 409
    if order_item.seller_id == user.id:
        return jsonify(error="Buyer tidak dapat mereview order item dari toko sendiri"), 400
    if db.session.scalar(select(Review.id).where(Review.order_item_id == order_item.id)) is not None:
        return jsonify(error="Order item sudah memiliki review"), 409

    review = Review(
        order_item_id=order_item.id,
        buyer_id=user.id,
        seller_id=order_item.seller_id,
        product_id=order_item.product_id,
        product_rating=data["product_rating"],
        seller_rating=data["seller_rating"],
        shipping_rating=data["shipping_rating"],
        comment=data.get("comment"),
        status=ReviewStatus.published,
    )
    db.session.add(review)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Order item sudah memiliki review"), 409
    return jsonify(review=review_schema.dump(review)), 201


@review_bp.get("")
@jwt_required()
def list_reviews():
    user, error = _current_active_user()
    if error:
        return error

    filters = review_list_query_schema.load(request.args)
    review_filters = [Review.status == ReviewStatus.published]
    if filters.get("product_id") is not None:
        review_filters.append(Review.product_id == filters["product_id"])
    if filters.get("seller_id") is not None:
        review_filters.append(Review.seller_id == filters["seller_id"])

    reviews = db.session.scalars(
        select(Review)
        .where(*review_filters)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(filters["per_page"])
        .offset((filters["page"] - 1) * filters["per_page"])
    ).all()
    total = db.session.scalar(select(func.count(Review.id)).where(*review_filters)) or 0

    response = {
        "reviews": review_schema.dump(reviews, many=True),
        "pagination": {
            "page": filters["page"],
            "per_page": filters["per_page"],
            "total": total,
        },
    }
    rating_field = None
    if filters.get("product_id") is not None:
        rating_field = Review.product_rating
    elif filters.get("seller_id") is not None:
        rating_field = Review.seller_rating
    if rating_field is not None:
        average_rating = db.session.scalar(select(func.avg(rating_field)).where(*review_filters))
        response["average_rating"] = float(average_rating) if average_rating is not None else None
    return jsonify(response)


@review_bp.get("/<int:review_id>")
@jwt_required()
def get_review(review_id):
    user, error = _current_active_user()
    if error:
        return error
    review = db.session.get(Review, review_id)
    if review is None or review.status != ReviewStatus.published:
        return jsonify(error="Review tidak ditemukan"), 404
    return jsonify(review=review_schema.dump(review))


@review_bp.patch("/<int:review_id>")
@jwt_required()
def moderate_review(review_id):
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengubah status review"), 403

    review = db.session.get(Review, review_id)
    if review is None:
        return jsonify(error="Review tidak ditemukan"), 404
    data = review_moderation_schema.load(request.get_json() or {})
    review.status = ReviewStatus(data["status"])
    db.session.commit()
    return jsonify(review=review_schema.dump(review))