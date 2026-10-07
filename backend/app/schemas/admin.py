from marshmallow import Schema, fields, validate


PRODUCT_STATUSES = ["draft", "pending", "active", "sold", "archived", "rejected"]
USER_ROLES = ["buyer", "seller", "admin"]
USER_STATUSES = ["active", "suspended", "blocked"]


class SellerProductListQuerySchema(Schema):
    status = fields.String(validate=validate.OneOf(PRODUCT_STATUSES))
    search = fields.String(validate=validate.Length(max=180))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class AdminUserListQuerySchema(Schema):
    role = fields.String(validate=validate.OneOf(USER_ROLES))
    status = fields.String(validate=validate.OneOf(USER_STATUSES))
    search = fields.String(validate=validate.Length(max=255))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class AdminProductListQuerySchema(Schema):
    status = fields.String(validate=validate.OneOf(PRODUCT_STATUSES))
    search = fields.String(validate=validate.Length(max=180))
    store_id = fields.Integer(validate=validate.Range(min=1))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class AdminUserStatusUpdateSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(USER_STATUSES))


class AdminProductStatusUpdateSchema(Schema):
    status = fields.String(
        required=True,
        validate=validate.OneOf(["archived", "rejected", "active"]),
    )
