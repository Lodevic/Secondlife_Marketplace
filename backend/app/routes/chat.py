from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Chat, ChatMessage, Product, User, UserRole, UserStatus
from app.schemas.chat import ChatCreateSchema, ChatMessageCreateSchema, ChatMessageSchema, ChatSummarySchema

chat_bp = Blueprint("chats", __name__)
chat_create_schema = ChatCreateSchema()
chat_message_create_schema = ChatMessageCreateSchema()
chat_message_schema = ChatMessageSchema()
chat_summary_schema = ChatSummarySchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _find_chat(buyer_id, seller_id, product_id):
    query = select(Chat).where(Chat.buyer_id == buyer_id, Chat.seller_id == seller_id)
    if product_id is None:
        query = query.where(Chat.product_id.is_(None))
    else:
        query = query.where(Chat.product_id == product_id)
    return db.session.scalar(query)


def _chat_summary(chat, user_id):
    unread_count = db.session.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.chat_id == chat.id,
            ChatMessage.sender_id != user_id,
            ChatMessage.is_read.is_(False),
        )
    )
    return chat_summary_schema.dump({
        "id": chat.id,
        "buyer_id": chat.buyer_id,
        "seller_id": chat.seller_id,
        "product_id": chat.product_id,
        "created_at": chat.created_at,
        "last_message": chat.messages[-1] if chat.messages else None,
        "unread_count": unread_count or 0,
    })


def _participant_chat(chat_id, user):
    chat = db.session.get(Chat, chat_id)
    if chat is None:
        return None, (jsonify(error="Chat tidak ditemukan"), 404)
    if user.id not in (chat.buyer_id, chat.seller_id):
        return None, (jsonify(error="Chat bukan milik user"), 403)
    return chat, None


@chat_bp.post("")
@jwt_required()
def create_chat():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.buyer:
        return jsonify(error="Hanya buyer yang dapat memulai chat"), 403

    data = chat_create_schema.load(request.get_json() or {})
    seller_id = data["seller_id"]
    if seller_id == user.id:
        return jsonify(error="Tidak dapat membuat chat dengan diri sendiri"), 400
    seller = db.session.get(User, seller_id)
    if seller is None:
        return jsonify(error="Seller tidak ditemukan"), 404
    if seller.role != UserRole.seller:
        return jsonify(error="seller_id bukan akun seller"), 400

    product_id = data.get("product_id")
    if product_id is not None:
        product = db.session.get(Product, product_id)
        if product is None:
            return jsonify(error="Produk tidak ditemukan"), 404
        if product.store.seller_id != seller.id:
            return jsonify(error="Produk bukan milik seller tersebut"), 400

    chat = _find_chat(user.id, seller.id, product_id)
    if chat is not None:
        return jsonify(chat=_chat_summary(chat, user.id))

    chat = Chat(buyer_id=user.id, seller_id=seller.id, product_id=product_id)
    db.session.add(chat)
    created = True
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        chat = _find_chat(user.id, seller.id, product_id)
        if chat is None:
            raise
        created = False
    return jsonify(chat=_chat_summary(chat, user.id)), 201 if created else 200


@chat_bp.get("")
@jwt_required()
def list_chats():
    user, error = _current_active_user()
    if error:
        return error

    latest_message_at = (
        select(func.max(ChatMessage.created_at))
        .where(ChatMessage.chat_id == Chat.id)
        .correlate(Chat)
        .scalar_subquery()
    )
    chats = db.session.scalars(
        select(Chat)
        .where(or_(Chat.buyer_id == user.id, Chat.seller_id == user.id))
        .order_by(func.coalesce(latest_message_at, Chat.created_at).desc(), Chat.id.desc())
    ).all()
    if not chats:
        return jsonify(chats=[])

    chat_ids = [chat.id for chat in chats]
    unread_rows = db.session.execute(
        select(ChatMessage.chat_id, func.count(ChatMessage.id))
        .where(
            ChatMessage.chat_id.in_(chat_ids),
            ChatMessage.sender_id != user.id,
            ChatMessage.is_read.is_(False),
        )
        .group_by(ChatMessage.chat_id)
    ).all()
    unread_counts = dict(unread_rows)

    messages = db.session.scalars(
        select(ChatMessage)
        .where(ChatMessage.chat_id.in_(chat_ids))
        .order_by(ChatMessage.chat_id, ChatMessage.created_at.desc(), ChatMessage.id.desc())
    ).all()
    latest_messages = {}
    for message in messages:
        latest_messages.setdefault(message.chat_id, message)

    chat_data = [
        {
            "id": chat.id,
            "buyer_id": chat.buyer_id,
            "seller_id": chat.seller_id,
            "product_id": chat.product_id,
            "created_at": chat.created_at,
            "last_message": latest_messages.get(chat.id),
            "unread_count": unread_counts.get(chat.id, 0),
        }
        for chat in chats
    ]
    return jsonify(chats=chat_summary_schema.dump(chat_data, many=True))


@chat_bp.get("/<int:chat_id>/messages")
@jwt_required()
def list_chat_messages(chat_id):
    user, error = _current_active_user()
    if error:
        return error
    chat, error = _participant_chat(chat_id, user)
    if error:
        return error

    db.session.execute(
        update(ChatMessage)
        .where(
            ChatMessage.chat_id == chat.id,
            ChatMessage.sender_id != user.id,
            ChatMessage.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.session.commit()
    messages = db.session.scalars(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at, ChatMessage.id)
    ).all()
    return jsonify(messages=chat_message_schema.dump(messages, many=True))


@chat_bp.post("/<int:chat_id>/messages")
@jwt_required()
def create_chat_message(chat_id):
    user, error = _current_active_user()
    if error:
        return error
    chat, error = _participant_chat(chat_id, user)
    if error:
        return error

    data = chat_message_create_schema.load(request.get_json() or {})
    message = ChatMessage(
        chat_id=chat.id,
        sender_id=user.id,
        message=data["message"],
        attachment_url=data.get("attachment_url"),
    )
    db.session.add(message)
    db.session.commit()
    return jsonify(message=chat_message_schema.dump(message)), 201