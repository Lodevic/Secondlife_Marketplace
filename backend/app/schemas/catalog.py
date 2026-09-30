from marshmallow import Schema, fields, validate


class CategoryCreateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=120))
    slug = fields.String(load_default=None, allow_none=True, validate=validate.Length(min=1, max=140))
    parent_id = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=1))
    status = fields.String(load_default="active", validate=validate.OneOf(["active", "inactive"]))


class CategorySchema(Schema):
    id = fields.Integer(dump_only=True)
    parent_id = fields.Integer(dump_only=True, allow_none=True)
    name = fields.String(dump_only=True)
    slug = fields.String(dump_only=True)
    status = fields.Method("get_status", dump_only=True)

    @staticmethod
    def get_status(category):
        return category.status.value


class ConditionSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)


class ProductImageInputSchema(Schema):
    image_url = fields.Url(required=True, schemes=["http", "https"], validate=validate.Length(max=1000))
    image_type = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.OneOf(["main", "gallery"]),
    )
    sort_order = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=0))


class ProductCreateSchema(Schema):
    category_id = fields.Integer(required=True, validate=validate.Range(min=1))
    condition_id = fields.Integer(required=True, validate=validate.Range(min=1))
    name = fields.String(required=True, validate=validate.Length(min=1, max=180))
    description = fields.String(required=True, validate=validate.Length(min=1))
    price = fields.Decimal(required=True, as_string=True, validate=validate.Range(min=0, min_inclusive=False))
    stock = fields.Integer(required=True, validate=validate.Range(min=0))
    year_used = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=0))
    location = fields.String(required=True, validate=validate.Length(min=1, max=160))
    status = fields.String(load_default="draft", validate=validate.OneOf(
        ["draft", "pending", "active", "sold", "archived", "rejected"]
    ))
    images = fields.List(
        fields.Nested(ProductImageInputSchema),
        required=True,
        validate=validate.Length(min=1),
    )


class ProductUpdateSchema(Schema):
    category_id = fields.Integer(validate=validate.Range(min=1))
    condition_id = fields.Integer(validate=validate.Range(min=1))
    name = fields.String(validate=validate.Length(min=1, max=180))
    description = fields.String(validate=validate.Length(min=1))
    price = fields.Decimal(as_string=True, validate=validate.Range(min=0, min_inclusive=False))
    stock = fields.Integer(validate=validate.Range(min=0))
    year_used = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    location = fields.String(validate=validate.Length(min=1, max=160))
    status = fields.String(validate=validate.OneOf(
        ["draft", "pending", "active", "sold", "archived", "rejected"]
    ))


class ProductImageCreateSchema(Schema):
    image_url = fields.Url(required=True, schemes=["http", "https"], validate=validate.Length(max=1000))
    image_type = fields.String(load_default="gallery", validate=validate.OneOf(["main", "gallery"]))
    sort_order = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=0))


class ProductImageSchema(Schema):
    id = fields.Integer(dump_only=True)
    image_url = fields.String(dump_only=True)
    image_type = fields.Method("get_image_type", dump_only=True)
    sort_order = fields.Integer(dump_only=True)

    @staticmethod
    def get_image_type(image):
        return image.image_type.value


class ProductSchema(Schema):
    id = fields.Integer(dump_only=True)
    store_id = fields.Integer(dump_only=True)
    category_id = fields.Integer(dump_only=True)
    condition_id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True)
    price = fields.Decimal(as_string=True, dump_only=True)
    stock = fields.Integer(dump_only=True)
    year_used = fields.Integer(dump_only=True, allow_none=True)
    location = fields.String(dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    view_count = fields.Integer(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    images = fields.List(fields.Nested(ProductImageSchema), dump_only=True)

    @staticmethod
    def get_status(product):
        return product.status.value


class ProductListQuerySchema(Schema):
    category_id = fields.Integer(validate=validate.Range(min=1))
    condition_id = fields.Integer(validate=validate.Range(min=1))
    min_price = fields.Decimal(as_string=True, validate=validate.Range(min=0))
    max_price = fields.Decimal(as_string=True, validate=validate.Range(min=0))
    status = fields.String(validate=validate.OneOf(
        ["draft", "pending", "active", "sold", "archived", "rejected"]
    ))
    search = fields.String(validate=validate.Length(max=180))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))