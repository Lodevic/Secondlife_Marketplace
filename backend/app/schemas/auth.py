from marshmallow import Schema, fields, validate


class RegisterSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=120))
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8))
    phone = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=30))
    role = fields.String(
        load_default="buyer",
        validate=validate.OneOf(["buyer", "seller"]),
    )


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)


class UserSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(dump_only=True)
    email = fields.Email(dump_only=True)
    phone = fields.String(dump_only=True, allow_none=True)
    role = fields.Method("get_role", dump_only=True)
    status = fields.Method("get_status", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    @staticmethod
    def get_role(user):
        return user.role.value

    @staticmethod
    def get_status(user):
        return user.status.value