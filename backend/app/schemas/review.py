from marshmallow import Schema, fields, validate


class ReviewCreateSchema(Schema):
    order_item_id = fields.Integer(required=True, validate=validate.Range(min=1))
    product_rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    seller_rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    shipping_rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    comment = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=5000))


class ReviewListQuerySchema(Schema):
    product_id = fields.Integer(load_default=None, validate=validate.Range(min=1))
    seller_id = fields.Integer(load_default=None, validate=validate.Range(min=1))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class ReviewModerationSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(["published", "hidden"]))


class ReviewSchema(Schema):
    id = fields.Integer(dump_only=True)
    order_item_id = fields.Integer(dump_only=True)
    buyer_id = fields.Integer(dump_only=True)
    seller_id = fields.Integer(dump_only=True)
    product_id = fields.Integer(dump_only=True)
    product_rating = fields.Integer(dump_only=True)
    seller_rating = fields.Integer(dump_only=True)
    shipping_rating = fields.Integer(dump_only=True)
    comment = fields.String(dump_only=True, allow_none=True)
    status = fields.Method("get_status", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    @staticmethod
    def get_status(review):
        return review.status.value