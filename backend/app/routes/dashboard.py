from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import distinct, func, select

from app.extensions import db
from app.models import (
    Offer,
    OfferStatus,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
    Product,
    ProductStatus,
    Report,
    ReportStatus,
    Review,
    ReviewStatus,
    Store,
    StoreStatus,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.dashboard import LowStockQuerySchema, SalesTrendQuerySchema, TopListQuerySchema

dashboard_bp = Blueprint("dashboard", __name__)
sales_trend_query_schema = SalesTrendQuerySchema()
top_list_query_schema = TopListQuerySchema()
low_stock_query_schema = LowStockQuerySchema()

ZERO_MONEY = Decimal("0.00")
CENT = Decimal("0.01")


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _money(value):
    return str((value or ZERO_MONEY).quantize(CENT, rounding=ROUND_HALF_UP))


def _enum_counts(rows, enum_type):
    counts = {item.value: 0 for item in enum_type}
    for status, count in rows:
        counts[status.value] = count
    return counts


def _date_range(filters):
    end_date = filters["end_date"] or datetime.now(timezone.utc).date()
    start_date = filters["start_date"] or end_date - timedelta(days=29)
    if start_date > end_date:
        return None, None, (jsonify(error="start_date tidak boleh setelah end_date"), 400)
    return start_date, end_date, None


def _bucket_date(value):
    return value.date() if isinstance(value, datetime) else value


def _next_bucket(value, period):
    if period == "day":
        return value + timedelta(days=1)
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _bucket_range(start_date, end_date, period):
    current = start_date if period == "day" else start_date.replace(day=1)
    last = end_date if period == "day" else end_date.replace(day=1)
    buckets = []
    while current <= last:
        buckets.append(current)
        current = _next_bucket(current, period)
    return buckets


def _trend_filters(start_date, end_date):
    start_at = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_at = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return Order.created_at >= start_at, Order.created_at < end_at


def _seller_store(user):
    if user.role != UserRole.seller:
        return None, (jsonify(error="Hanya seller yang dapat mengakses dashboard seller"), 403)
    store = db.session.scalar(select(Store).where(Store.seller_id == user.id))
    if store is None:
        return None, (jsonify(error="Toko seller tidak ditemukan"), 404)
    return store, None


@dashboard_bp.get("/seller/summary")
@jwt_required()
def seller_summary():
    user, error = _current_active_user()
    if error:
        return error
    store, error = _seller_store(user)
    if error:
        return error

    revenue = db.session.scalar(
        select(func.sum(OrderItem.subtotal))
        .join(Order, Order.id == OrderItem.order_id)
        .where(OrderItem.seller_id == user.id, Order.status == OrderStatus.completed)
    )
    order_rows = db.session.execute(
        select(Order.status, func.count(distinct(Order.id)))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.seller_id == user.id)
        .group_by(Order.status)
    ).all()
    product_rows = db.session.execute(
        select(Product.status, func.count(Product.id))
        .where(Product.store_id == store.id)
        .group_by(Product.status)
    ).all()
    review_row = db.session.execute(
        select(
            func.avg(Review.product_rating),
            func.avg(Review.seller_rating),
            func.avg(Review.shipping_rating),
            func.count(Review.id),
        ).where(Review.seller_id == user.id, Review.status == ReviewStatus.published)
    ).one()
    pending_offers = db.session.scalar(
        select(func.count(Offer.id)).where(
            Offer.seller_id == user.id,
            Offer.status == OfferStatus.pending,
        )
    ) or 0
    action_rows = db.session.execute(
        select(Order.status, func.count(distinct(Order.id)))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            OrderItem.seller_id == user.id,
            Order.status.in_([OrderStatus.paid, OrderStatus.processing]),
        )
        .group_by(Order.status)
    ).all()
    needs_action = {OrderStatus.paid.value: 0, OrderStatus.processing.value: 0}
    needs_action.update({status.value: count for status, count in action_rows})

    return jsonify(
        total_revenue=_money(revenue),
        orders_by_status=_enum_counts(order_rows, OrderStatus),
        products_by_status=_enum_counts(product_rows, ProductStatus),
        reviews={
            "average_product_rating": float(review_row[0] or 0),
            "average_seller_rating": float(review_row[1] or 0),
            "average_shipping_rating": float(review_row[2] or 0),
            "count": review_row[3],
        },
        pending_offers=pending_offers,
        needs_action=needs_action,
    )


@dashboard_bp.get("/seller/sales-trend")
@jwt_required()
def seller_sales_trend():
    user, error = _current_active_user()
    if error:
        return error
    _, error = _seller_store(user)
    if error:
        return error
    filters = sales_trend_query_schema.load(request.args)
    start_date, end_date, error = _date_range(filters)
    if error:
        return error

    period = filters["period"]
    bucket = func.date_trunc(period, func.timezone("UTC", Order.created_at))
    range_filters = _trend_filters(start_date, end_date)
    rows = db.session.execute(
        select(
            bucket,
            func.sum(OrderItem.subtotal),
            func.count(distinct(Order.id)),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            OrderItem.seller_id == user.id,
            Order.status == OrderStatus.completed,
            *range_filters,
        )
        .group_by(bucket)
    ).all()
    values = {
        _bucket_date(row[0]): {"revenue": _money(row[1]), "orders": row[2]}
        for row in rows
    }
    data = [
        {"date": current.isoformat(), **values.get(current, {"revenue": "0.00", "orders": 0})}
        for current in _bucket_range(start_date, end_date, period)
    ]
    return jsonify(
        period=period,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        data=data,
    )


@dashboard_bp.get("/seller/top-products")
@jwt_required()
def seller_top_products():
    user, error = _current_active_user()
    if error:
        return error
    _, error = _seller_store(user)
    if error:
        return error
    filters = top_list_query_schema.load(request.args)
    rows = db.session.execute(
        select(
            Product.id,
            Product.name,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.subtotal),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(OrderItem.seller_id == user.id, Order.status == OrderStatus.completed)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc(), Product.id.asc())
        .limit(filters["limit"])
    ).all()
    return jsonify(
        products=[
            {
                "product_id": product_id,
                "name": name,
                "total_quantity": quantity,
                "total_revenue": _money(revenue),
            }
            for product_id, name, quantity, revenue in rows
        ]
    )


@dashboard_bp.get("/seller/low-stock")
@jwt_required()
def seller_low_stock():
    user, error = _current_active_user()
    if error:
        return error
    store, error = _seller_store(user)
    if error:
        return error
    filters = low_stock_query_schema.load(request.args)
    products = db.session.scalars(
        select(Product)
        .where(
            Product.store_id == store.id,
            Product.status == ProductStatus.active,
            Product.stock <= filters["threshold"],
        )
        .order_by(Product.stock.asc(), Product.id.asc())
    ).all()
    return jsonify(
        threshold=filters["threshold"],
        products=[
            {"product_id": product.id, "name": product.name, "stock": product.stock}
            for product in products
        ],
    )


@dashboard_bp.get("/admin/summary")
@jwt_required()
def admin_summary():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengakses dashboard admin"), 403

    user_role_rows = db.session.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    ).all()
    user_status_rows = db.session.execute(
        select(User.status, func.count(User.id)).group_by(User.status)
    ).all()
    store_rows = db.session.execute(select(Store.status, func.count(Store.id)).group_by(Store.status)).all()
    product_rows = db.session.execute(
        select(Product.status, func.count(Product.id)).group_by(Product.status)
    ).all()
    order_rows = db.session.execute(select(Order.status, func.count(Order.id)).group_by(Order.status)).all()
    completed_totals = db.session.execute(
        select(
            func.sum(Order.total_amount),
            func.sum(Order.platform_fee),
            func.count(Order.id),
        ).where(Order.status == OrderStatus.completed)
    ).one()
    return jsonify(
        users={
            "by_role": _enum_counts(user_role_rows, UserRole),
            "by_status": _enum_counts(user_status_rows, UserStatus),
        },
        stores_by_status=_enum_counts(store_rows, StoreStatus),
        products_by_status=_enum_counts(product_rows, ProductStatus),
        orders_by_status=_enum_counts(order_rows, OrderStatus),
        gmv=_money(completed_totals[0]),
        platform_revenue=_money(completed_totals[1]),
        total_completed_orders=completed_totals[2],
    )


@dashboard_bp.get("/admin/sales-trend")
@jwt_required()
def admin_sales_trend():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengakses dashboard admin"), 403
    filters = sales_trend_query_schema.load(request.args)
    start_date, end_date, error = _date_range(filters)
    if error:
        return error

    period = filters["period"]
    bucket = func.date_trunc(period, func.timezone("UTC", Order.created_at))
    range_filters = _trend_filters(start_date, end_date)
    rows = db.session.execute(
        select(
            bucket,
            func.sum(Order.total_amount),
            func.sum(Order.platform_fee),
            func.count(Order.id),
        )
        .where(Order.status == OrderStatus.completed, *range_filters)
        .group_by(bucket)
    ).all()
    values = {
        _bucket_date(row[0]): {
            "gmv": _money(row[1]),
            "platform_fee": _money(row[2]),
            "orders": row[3],
        }
        for row in rows
    }
    data = [
        {
            "date": current.isoformat(),
            **values.get(current, {"gmv": "0.00", "platform_fee": "0.00", "orders": 0}),
        }
        for current in _bucket_range(start_date, end_date, period)
    ]
    return jsonify(
        period=period,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        data=data,
    )


@dashboard_bp.get("/admin/moderation-queue")
@jwt_required()
def admin_moderation_queue():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengakses dashboard admin"), 403

    pending_payment_count = db.session.scalar(
        select(func.count(Payment.id)).where(Payment.status == PaymentStatus.pending)
    ) or 0
    pending_payments = db.session.execute(
        select(Payment, Order)
        .join(Order, Order.id == Payment.order_id)
        .where(Payment.status == PaymentStatus.pending)
        .order_by(Order.created_at.desc(), Payment.id.desc())
        .limit(10)
    ).all()
    report_counts = db.session.execute(
        select(Report.status, func.count(Report.id))
        .where(Report.status.in_([ReportStatus.pending, ReportStatus.investigating]))
        .group_by(Report.status)
    ).all()
    report_count_map = {status: count for status, count in report_counts}
    reports = db.session.scalars(
        select(Report)
        .where(Report.status.in_([ReportStatus.pending, ReportStatus.investigating]))
        .order_by(Report.created_at.desc(), Report.id.desc())
        .limit(10)
    ).all()
    pending_store_count = db.session.scalar(
        select(func.count(Store.id)).where(Store.status == StoreStatus.pending)
    ) or 0
    pending_stores = db.session.execute(
        select(Store, User.name)
        .join(User, User.id == Store.seller_id)
        .where(Store.status == StoreStatus.pending)
        .order_by(Store.created_at.desc(), Store.id.desc())
        .limit(10)
    ).all()
    hidden_review_count = db.session.scalar(
        select(func.count(Review.id)).where(Review.status == ReviewStatus.hidden)
    ) or 0

    return jsonify(
        payments={
            "pending_count": pending_payment_count,
            "items": [
                {
                    "payment_id": payment.id,
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "amount": _money(payment.amount),
                    "payment_method": payment.payment_method,
                    "order_created_at": order.created_at.isoformat(),
                }
                for payment, order in pending_payments
            ],
        },
        reports={
            "pending_count": report_count_map.get(ReportStatus.pending, 0),
            "investigating_count": report_count_map.get(ReportStatus.investigating, 0),
            "items": [
                {
                    "report_id": report.id,
                    "target_type": report.target_type.value,
                    "target_id": report.target_id,
                    "reason": report.reason,
                    "status": report.status.value,
                    "created_at": report.created_at.isoformat(),
                }
                for report in reports
            ],
        },
        stores={
            "pending_count": pending_store_count,
            "items": [
                {
                    "store_id": store.id,
                    "store_name": store.store_name,
                    "seller_id": store.seller_id,
                    "seller_name": seller_name,
                    "created_at": store.created_at.isoformat(),
                }
                for store, seller_name in pending_stores
            ],
        },
        hidden_reviews_count=hidden_review_count,
    )


@dashboard_bp.get("/admin/top-sellers")
@jwt_required()
def admin_top_sellers():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengakses dashboard admin"), 403
    filters = top_list_query_schema.load(request.args)
    rows = db.session.execute(
        select(
            User.id,
            Store.store_name,
            func.sum(OrderItem.subtotal),
            func.count(distinct(Order.id)),
        )
        .join(OrderItem, OrderItem.seller_id == User.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Store, Store.seller_id == User.id)
        .where(User.role == UserRole.seller, Order.status == OrderStatus.completed)
        .group_by(User.id, Store.store_name)
        .order_by(func.sum(OrderItem.subtotal).desc(), User.id.asc())
        .limit(filters["limit"])
    ).all()
    return jsonify(
        sellers=[
            {
                "seller_id": seller_id,
                "store_name": store_name,
                "total_revenue": _money(revenue),
                "orders": orders,
            }
            for seller_id, store_name, revenue, orders in rows
        ]
    )


@dashboard_bp.get("/admin/top-products")
@jwt_required()
def admin_top_products():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengakses dashboard admin"), 403
    filters = top_list_query_schema.load(request.args)
    rows = db.session.execute(
        select(
            Product.id,
            Product.name,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.subtotal),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == OrderStatus.completed)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc(), Product.id.asc())
        .limit(filters["limit"])
    ).all()
    return jsonify(
        products=[
            {
                "product_id": product_id,
                "name": name,
                "total_quantity": quantity,
                "total_revenue": _money(revenue),
            }
            for product_id, name, quantity, revenue in rows
        ]
    )