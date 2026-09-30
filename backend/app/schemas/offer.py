from marshmallow import Schema, fields, validate


class OfferCreateSchema(Schema):
    product_id = fields.Integer(required=True, validate=validate.Range(min=1))
    amount = fields.Decimal(required=True, as_string=True, validate=validate.Range(min=0, min_inclusive=False))
    message = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=2000))


class OfferRespondSchema(Schema):
    action = fields.String(required=True, validate=validate.OneOf(["accept", "reject", "counter"]))
    amount = fields.Decimal(as_string=True, validate=validate.Range(min=0, min_inclusive=False))


class OfferListQuerySchema(Schema):
    role = fields.String(load_default="buyer", validate=validate.OneOf(["buyer", "seller"]))


class OfferProductSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    price = fields.Decimal(as_string=True, dump_only=True)
    main_image = fields.Method("get_main_image", dump_only=True)

    @staticmethod
    def get_main_image(product):
        for image in product.images:
            if image.image_type.value == "main":
                return image.image_url
        return None


class OfferSchema(Schema):
    id = fields.Integer(dump_only=True)
    product_id = fields.Integer(dump_only=True)
    buyer_id = fields.Integer(dump_only=True)
    seller_id = fields.Integer(dump_only=True)
    parent_offer_id = fields.Integer(dump_only=True, allow_none=True)
    amount = fields.Decimal(as_string=True, dump_only=True)
    message = fields.String(dump_only=True, allow_none=True)
    status = fields.Method("get_status", dump_only=True)
    expires_at = fields.DateTime(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    product = fields.Nested(OfferProductSchema, dump_only=True)

    @staticmethod
    def get_status(offer):
        return offer.status.value