from marshmallow import Schema, fields, validate


class SalesTrendQuerySchema(Schema):
    period = fields.String(load_default="day", validate=validate.OneOf(["day", "month"]))
    start_date = fields.Date(load_default=None, allow_none=True)
    end_date = fields.Date(load_default=None, allow_none=True)


class TopListQuerySchema(Schema):
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=50))


class LowStockQuerySchema(Schema):
    threshold = fields.Integer(load_default=3, validate=validate.Range(min=0))