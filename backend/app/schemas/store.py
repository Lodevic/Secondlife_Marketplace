from marshmallow import Schema, fields, validate


class StoreCreateSchema(Schema):
    store_name = fields.String(required=True, validate=validate.Length(min=1, max=120))
    description = fields.String(load_default=None, allow_none=True)
    logo = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=500))


class StoreSchema(Schema):
    id = fields.Integer(dump_only=True)
    seller_id = fields.Integer(dump_only=True)
    store_name = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)
    logo = fields.String(dump_only=True, allow_none=True)
    status = fields.Method("get_status", dump_only=True)
    rating_avg = fields.Decimal(as_string=True, dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    @staticmethod
    def get_status(store):
        return store.status.value