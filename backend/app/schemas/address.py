from marshmallow import Schema, fields, validate


class AddressCreateSchema(Schema):
    label = fields.String(required=True, validate=validate.Length(min=1, max=50), trim=True)
    recipient_name = fields.String(required=True, validate=validate.Length(min=1, max=120), trim=True)
    phone = fields.String(required=True, validate=validate.Length(min=1, max=30), trim=True)
    address = fields.String(required=True, validate=validate.Length(min=1), trim=True)
    city = fields.String(required=True, validate=validate.Length(min=1, max=100), trim=True)
    province = fields.String(required=True, validate=validate.Length(min=1, max=100), trim=True)
    postal_code = fields.String(required=True, validate=validate.Length(min=1, max=20), trim=True)
    is_default = fields.Boolean(load_default=False)


class AddressSchema(Schema):
    id = fields.Integer(dump_only=True)
    label = fields.String(dump_only=True)
    recipient_name = fields.String(dump_only=True)
    phone = fields.String(dump_only=True)
    address = fields.String(dump_only=True)
    city = fields.String(dump_only=True)
    province = fields.String(dump_only=True)
    postal_code = fields.String(dump_only=True)
    is_default = fields.Boolean(dump_only=True)
