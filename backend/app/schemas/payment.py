from marshmallow import Schema, fields


class PaymentSchema(Schema):
    id = fields.Integer(dump_only=True)
    order_id = fields.Integer(dump_only=True)
    payment_method = fields.String(dump_only=True)
    payment_reference = fields.String(dump_only=True)
    amount = fields.Decimal(as_string=True, dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    paid_at = fields.DateTime(dump_only=True, allow_none=True)

    @staticmethod
    def get_status(payment):
        return payment.status.value