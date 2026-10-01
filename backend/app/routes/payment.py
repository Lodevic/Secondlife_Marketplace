from datetime import datetime, timezone

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select

from app.extensions import db
from app.models import Order, OrderStatus, Payment, PaymentStatus, User, UserRole, UserStatus
from app.routes.order import cancel_order_and_restore_stock
from app.schemas.payment import PaymentSchema

payment_bp = Blueprint("payments", __name__)
payment_schema = PaymentSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _payment_and_order_for_update(payment_id):
    payment_reference = db.session.get(Payment, payment_id)
    if payment_reference is None:
        return None, None
    order = db.session.scalar(
        select(Order).where(Order.id == payment_reference.order_id).with_for_update()
    )
    if order is None:
        return None, None
    payment = db.session.scalar(
        select(Payment).where(Payment.id == payment_id).with_for_update()
    )
    return payment, order


@payment_bp.get("/<int:payment_id>")
@jwt_required()
def get_payment(payment_id):
    user, error = _current_active_user()
    if error:
        return error
    payment = db.session.get(Payment, payment_id)
    if payment is None:
        return jsonify(error="Payment tidak ditemukan"), 404
    if user.role != UserRole.admin and payment.order.buyer_id != user.id:
        return jsonify(error="Payment bukan milik user"), 403
    return jsonify(payment=payment_schema.dump(payment))


@payment_bp.post("/<int:payment_id>/confirm")
@jwt_required()
def confirm_payment(payment_id):
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengonfirmasi payment"), 403

    payment, order = _payment_and_order_for_update(payment_id)
    if payment is None:
        return jsonify(error="Payment tidak ditemukan"), 404
    if payment.status != PaymentStatus.pending:
        return jsonify(error="Payment hanya dapat dikonfirmasi saat pending"), 409
    if order.status != OrderStatus.pending_payment:
        return jsonify(error="Order tidak lagi menunggu pembayaran"), 409

    try:
        payment.status = PaymentStatus.paid
        payment.paid_at = datetime.now(timezone.utc)
        order.status = OrderStatus.paid
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify(payment=payment_schema.dump(payment))


@payment_bp.post("/<int:payment_id>/fail")
@jwt_required()
def fail_payment(payment_id):
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat menandai payment gagal"), 403

    payment, order = _payment_and_order_for_update(payment_id)
    if payment is None:
        return jsonify(error="Payment tidak ditemukan"), 404
    if payment.status != PaymentStatus.pending:
        return jsonify(error="Payment hanya dapat ditandai gagal saat pending"), 409
    if order.status != OrderStatus.pending_payment:
        return jsonify(error="Order tidak lagi menunggu pembayaran"), 409

    try:
        payment.status = PaymentStatus.failed
        cancel_order_and_restore_stock(order)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify(payment=payment_schema.dump(payment), order_status=order.status.value)