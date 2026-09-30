from marshmallow import Schema, fields


class WishlistProductSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    price = fields.Decimal(as_string=True, dump_only=True)
    stock = fields.Integer(dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    main_image = fields.Method("get_main_image", dump_only=True, allow_none=True)

    @staticmethod
    def get_status(product):
        return product.status.value

    @staticmethod
    def get_main_image(product):
        image = next((image for image in product.images if image.image_type.value == "main"), None)
        return image.image_url if image is not None else None


class WishlistSchema(Schema):
    id = fields.Integer(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    product = fields.Nested(WishlistProductSchema, dump_only=True)