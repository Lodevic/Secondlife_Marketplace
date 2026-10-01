from marshmallow import Schema, fields, validate


class ReportCreateSchema(Schema):
    target_type = fields.String(
        required=True,
        validate=validate.OneOf(["product", "seller", "transaction", "user"]),
    )
    target_id = fields.Integer(required=True, validate=validate.Range(min=1))
    reason = fields.String(required=True, validate=validate.Length(min=1, max=255))
    description = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=5000))


class ReportListQuerySchema(Schema):
    status = fields.String(
        load_default=None,
        validate=validate.OneOf(["pending", "investigating", "resolved", "rejected"]),
    )
    target_type = fields.String(
        load_default=None,
        validate=validate.OneOf(["product", "seller", "transaction", "user"]),
    )
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class ReportUpdateSchema(Schema):
    status = fields.String(
        required=True,
        validate=validate.OneOf(["pending", "investigating", "resolved", "rejected"]),
    )
    resolution_note = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=5000))


class ReportSchema(Schema):
    id = fields.Integer(dump_only=True)
    reporter_id = fields.Integer(dump_only=True)
    target_type = fields.Method("get_target_type", dump_only=True)
    target_id = fields.Integer(dump_only=True)
    reason = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)
    status = fields.Method("get_status", dump_only=True)
    handled_by = fields.Integer(dump_only=True, allow_none=True)
    handled_at = fields.DateTime(dump_only=True, allow_none=True)
    resolution_note = fields.String(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)

    @staticmethod
    def get_target_type(report):
        return report.target_type.value

    @staticmethod
    def get_status(report):
        return report.status.value