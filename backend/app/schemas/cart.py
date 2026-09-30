from decimal import Decimal

from marshmallow import Schema, fields, validate


class CartItemCreateSchema(Schema):
    product_id = fields.Integer(required=True, validate=validate.Range(min=1))
    quantity = fields.Integer(required=True, validate=validate.Range(min=1))


class CartItemQuantitySchema(Schema):
    quantity = fields.Integer(required=True, validate=validate.Range(min=1))


class CartProductSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    stock = fields.Integer(dump_only=True)
    status = fields.Method("get_status", dump_only=True)

    @staticmethod
    def get_status(product):
        return product.status.value


class CartItemSchema(Schema):
    id = fields.Integer(dump_only=True)
    quantity = fields.Integer(dump_only=True)
    price_snapshot = fields.Decimal(as_string=True, dump_only=True)
    subtotal = fields.Method("get_subtotal", dump_only=True)
    product = fields.Nested(CartProductSchema, dump_only=True)

    @staticmethod
    def get_subtotal(item):
        return str(item.price_snapshot * item.quantity)


class CartSchema(Schema):
    id = fields.Integer(dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    items = fields.Nested(CartItemSchema, many=True, dump_only=True)
    total = fields.Method("get_total", dump_only=True)

    @staticmethod
    def get_status(cart):
        return cart.status.value

    @staticmethod
    def get_total(cart):
        return str(sum((item.price_snapshot * item.quantity for item in cart.items), Decimal("0.00")))