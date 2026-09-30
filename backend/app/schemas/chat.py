from marshmallow import Schema, fields, validate


class ChatCreateSchema(Schema):
    seller_id = fields.Integer(required=True, validate=validate.Range(min=1))
    product_id = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=1))


class ChatMessageCreateSchema(Schema):
    message = fields.String(required=True, validate=validate.Length(min=1, max=5000))
    attachment_url = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=1000))


class ChatMessageSchema(Schema):
    id = fields.Integer(dump_only=True)
    chat_id = fields.Integer(dump_only=True)
    sender_id = fields.Integer(dump_only=True)
    message = fields.String(dump_only=True)
    attachment_url = fields.String(dump_only=True, allow_none=True)
    is_read = fields.Boolean(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class ChatSummarySchema(Schema):
    id = fields.Integer(dump_only=True)
    buyer_id = fields.Integer(dump_only=True)
    seller_id = fields.Integer(dump_only=True)
    product_id = fields.Integer(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    last_message = fields.Nested(ChatMessageSchema, allow_none=True, dump_only=True)
    unread_count = fields.Integer(dump_only=True)