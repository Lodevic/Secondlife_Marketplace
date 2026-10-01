from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select

from app.extensions import db
from app.models import (
    Order,
    Product,
    Report,
    ReportStatus,
    ReportTargetType,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.report import (
    ReportCreateSchema,
    ReportListQuerySchema,
    ReportSchema,
    ReportUpdateSchema,
)

report_bp = Blueprint("reports", __name__)
report_create_schema = ReportCreateSchema()
report_list_query_schema = ReportListQuerySchema()
report_update_schema = ReportUpdateSchema()
report_schema = ReportSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _target_exists(target_type, target_id):
    if target_type == ReportTargetType.product:
        return db.session.get(Product, target_id) is not None
    if target_type == ReportTargetType.seller:
        return db.session.scalar(
            select(User.id).where(User.id == target_id, User.role == UserRole.seller)
        ) is not None
    if target_type == ReportTargetType.transaction:
        return db.session.get(Order, target_id) is not None
    return db.session.get(User, target_id) is not None


@report_bp.post("")
@jwt_required()
def create_report():
    user, error = _current_active_user()
    if error:
        return error

    data = report_create_schema.load(request.get_json() or {})
    data["reason"] = data["reason"].strip()
    if not data["reason"]:
        return jsonify(error="Reason laporan tidak boleh kosong"), 400
    target_type = ReportTargetType(data["target_type"])
    if not _target_exists(target_type, data["target_id"]):
        return jsonify(error="Target laporan tidak ditemukan"), 404

    report = Report(
        reporter_id=user.id,
        target_type=target_type,
        target_id=data["target_id"],
        reason=data["reason"],
        description=data.get("description"),
        status=ReportStatus.pending,
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(report=report_schema.dump(report)), 201


@report_bp.get("")
@jwt_required()
def list_reports():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat melihat daftar laporan"), 403

    filters = report_list_query_schema.load(request.args)
    query = select(Report)
    count_query = select(func.count(Report.id))
    if filters.get("status") is not None:
        status = ReportStatus(filters["status"])
        query = query.where(Report.status == status)
        count_query = count_query.where(Report.status == status)
    if filters.get("target_type") is not None:
        target_type = ReportTargetType(filters["target_type"])
        query = query.where(Report.target_type == target_type)
        count_query = count_query.where(Report.target_type == target_type)

    reports = db.session.scalars(
        query.order_by(Report.created_at.desc(), Report.id.desc())
        .limit(filters["per_page"])
        .offset((filters["page"] - 1) * filters["per_page"])
    ).all()
    total = db.session.scalar(count_query) or 0
    return jsonify(
        reports=report_schema.dump(reports, many=True),
        pagination={"page": filters["page"], "per_page": filters["per_page"], "total": total},
    )


@report_bp.get("/<int:report_id>")
@jwt_required()
def get_report(report_id):
    user, error = _current_active_user()
    if error:
        return error
    report = db.session.get(Report, report_id)
    if report is None:
        return jsonify(error="Laporan tidak ditemukan"), 404
    if user.role != UserRole.admin and report.reporter_id != user.id:
        return jsonify(error="Laporan bukan milik user"), 403
    return jsonify(report=report_schema.dump(report))


@report_bp.patch("/<int:report_id>")
@jwt_required()
def update_report(report_id):
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.admin:
        return jsonify(error="Hanya admin yang dapat mengubah status laporan"), 403

    report = db.session.get(Report, report_id)
    if report is None:
        return jsonify(error="Laporan tidak ditemukan"), 404
    data = report_update_schema.load(request.get_json() or {})
    report.status = ReportStatus(data["status"])
    report.resolution_note = data.get("resolution_note")
    report.handled_by = user.id
    report.handled_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(report=report_schema.dump(report))