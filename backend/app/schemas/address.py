from marshmallow import Schema, fields, validate, pre_load


class AddressCreateSchema(Schema):
    label = fields.String(required=True, validate=validate.Length(min=1, max=50))
    recipient_name = fields.String(required=True, validate=validate.Length(min=1, max=120))
    phone = fields.String(required=True, validate=validate.Length(min=1, max=30))
    address = fields.String(required=True, validate=validate.Length(min=1))
    city = fields.String(required=True, validate=validate.Length(min=1, max=100))
    province = fields.String(required=True, validate=validate.Length(min=1, max=100))
    postal_code = fields.String(required=True, validate=validate.Length(min=1, max=20))
    is_default = fields.Boolean(load_default=False)

    @pre_load
    def strip_strings(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        return {k: v.strip() if isinstance(v, str) else v for k, v in data.items()}


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