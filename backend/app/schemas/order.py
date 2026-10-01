from marshmallow import Schema, fields, validate


class CheckoutSchema(Schema):
    address_id = fields.Integer(required=True, validate=validate.Range(min=1))
    payment_method = fields.String(required=True, validate=validate.Length(min=1, max=80))
    offer_id = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=1))


class OrderListQuerySchema(Schema):
    role = fields.String(load_default="buyer", validate=validate.OneOf(["buyer", "seller", "admin"]))
    status = fields.String(
        load_default=None,
        validate=validate.OneOf(
            ["pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled"]
        ),
    )
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class ShipOrderSchema(Schema):
    courier = fields.String(required=True, validate=validate.Length(min=1, max=100))
    tracking_number = fields.String(required=True, validate=validate.Length(min=1, max=120))
    shipping_method = fields.String(required=True, validate=validate.Length(min=1, max=100))


class ShipmentStatusSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(["picked_up", "in_transit", "failed"]))


class OrderItemSchema(Schema):
    id = fields.Integer(dump_only=True)
    product_id = fields.Integer(dump_only=True)
    seller_id = fields.Integer(dump_only=True)
    offer_id = fields.Integer(dump_only=True, allow_none=True)
    product_name_snapshot = fields.String(dump_only=True)
    price = fields.Decimal(as_string=True, dump_only=True)
    quantity = fields.Integer(dump_only=True)
    subtotal = fields.Decimal(as_string=True, dump_only=True)


class ShipmentSchema(Schema):
    id = fields.Integer(dump_only=True)
    courier = fields.String(dump_only=True)
    tracking_number = fields.String(dump_only=True)
    shipping_method = fields.String(dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    shipped_at = fields.DateTime(dump_only=True, allow_none=True)
    delivered_at = fields.DateTime(dump_only=True, allow_none=True)

    @staticmethod
    def get_status(shipment):
        return shipment.status.value


class OrderSchema(Schema):
    id = fields.Integer(dump_only=True)
    order_number = fields.String(dump_only=True)
    buyer_id = fields.Integer(dump_only=True)
    address_id = fields.Integer(dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    subtotal = fields.Decimal(as_string=True, dump_only=True)
    shipping_cost = fields.Decimal(as_string=True, dump_only=True)
    platform_fee = fields.Decimal(as_string=True, dump_only=True)
    discount = fields.Decimal(as_string=True, dump_only=True)
    total_amount = fields.Decimal(as_string=True, dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    items = fields.Nested(OrderItemSchema, many=True, dump_only=True)
    payment = fields.Method("get_payment", dump_only=True)
    shipment = fields.Method("get_shipment", dump_only=True)

    @staticmethod
    def get_status(order):
        return order.status.value

    @staticmethod
    def get_payment(order):
        if not order.payments:
            return None
        from app.schemas.payment import PaymentSchema

        return PaymentSchema().dump(max(order.payments, key=lambda payment: payment.id))

    @staticmethod
    def get_shipment(order):
        if not order.shipments:
            return None
        return ShipmentSchema().dump(max(order.shipments, key=lambda shipment: shipment.id))