from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select

from app.extensions import db
from app.models import Offer, OfferStatus, Product, ProductStatus, User, UserRole, UserStatus
from app.schemas.offer import OfferCreateSchema, OfferListQuerySchema, OfferRespondSchema, OfferSchema

offer_bp = Blueprint("offers", __name__)
offer_create_schema = OfferCreateSchema()
offer_list_query_schema = OfferListQuerySchema()
offer_respond_schema = OfferRespondSchema()
offer_schema = OfferSchema()


def _current_active_user():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return None, (jsonify(error="User tidak ditemukan"), 404)
    if user.status != UserStatus.active:
        return None, (jsonify(error="Akun tidak aktif"), 403)
    return user, None


def _offer_history(offer):
    root = offer
    while root.parent_offer_id is not None:
        parent = db.session.get(Offer, root.parent_offer_id)
        if parent is None:
            break
        root = parent

    history = [root]
    frontier = [root.id]
    while frontier:
        children = db.session.scalars(
            select(Offer)
            .where(Offer.parent_offer_id.in_(frontier))
            .order_by(Offer.created_at, Offer.id)
        ).all()
        history.extend(children)
        frontier = [child.id for child in children]
    return sorted(history, key=lambda item: (item.created_at, item.id))


@offer_bp.post("")
@jwt_required()
def create_offer():
    user, error = _current_active_user()
    if error:
        return error
    if user.role != UserRole.buyer:
        return jsonify(error="Hanya buyer yang dapat mengajukan penawaran"), 403

    data = offer_create_schema.load(request.get_json() or {})
    product = db.session.get(Product, data["product_id"])
    if product is None:
        return jsonify(error="Produk tidak ditemukan"), 404
    if product.status != ProductStatus.active:
        return jsonify(error="Penawaran hanya dapat dibuat untuk produk aktif"), 400
    if product.store.seller_id == user.id:
        return jsonify(error="Tidak dapat mengajukan penawaran pada produk toko sendiri"), 400

    offer = Offer(
        product_id=product.id,
        buyer_id=user.id,
        seller_id=product.store.seller_id,
        amount=data["amount"],
        message=data.get("message"),
        status=OfferStatus.pending,
    )
    db.session.add(offer)
    db.session.commit()
    return jsonify(offer=offer_schema.dump(offer)), 201


@offer_bp.post("/<int:offer_id>/respond")
@jwt_required()
def respond_to_offer(offer_id):
    user, error = _current_active_user()
    if error:
        return error
    data = offer_respond_schema.load(request.get_json() or {})
    offer = db.session.get(Offer, offer_id)
    if offer is None:
        return jsonify(error="Penawaran tidak ditemukan"), 404
    if user.role != UserRole.seller or offer.seller_id != user.id:
        return jsonify(error="Hanya seller pemilik penawaran yang dapat merespons"), 403
    if offer.status != OfferStatus.pending:
        return jsonify(error="Penawaran sudah tidak berstatus pending"), 409

    action = data["action"]
    if action == "counter":
        if data.get("amount") is None:
            return jsonify(error="amount wajib diisi untuk counter-offer"), 400
        offer.status = OfferStatus.countered
        counter_offer = Offer(
            product_id=offer.product_id,
            buyer_id=offer.buyer_id,
            seller_id=offer.seller_id,
            parent_offer_id=offer.id,
            amount=data["amount"],
            status=OfferStatus.pending,
        )
        db.session.add(counter_offer)
        db.session.commit()
        return jsonify(
            offer=offer_schema.dump(offer),
            counter_offer=offer_schema.dump(counter_offer),
        ), 201

    offer.status = OfferStatus.accepted if action == "accept" else OfferStatus.rejected
    db.session.commit()
    return jsonify(offer=offer_schema.dump(offer))


@offer_bp.get("")
@jwt_required()
def list_offers():
    user, error = _current_active_user()
    if error:
        return error
    filters = offer_list_query_schema.load(request.args)
    participant_column = Offer.buyer_id if filters["role"] == "buyer" else Offer.seller_id
    offers = db.session.scalars(
        select(Offer)
        .where(participant_column == user.id)
        .order_by(Offer.created_at.desc(), Offer.id.desc())
    ).all()
    return jsonify(offers=offer_schema.dump(offers, many=True))


@offer_bp.get("/<int:offer_id>")
@jwt_required()
def get_offer(offer_id):
    user, error = _current_active_user()
    if error:
        return error
    offer = db.session.get(Offer, offer_id)
    if offer is None:
        return jsonify(error="Penawaran tidak ditemukan"), 404
    if user.id not in (offer.buyer_id, offer.seller_id):
        return jsonify(error="Penawaran bukan milik user"), 403
    return jsonify(
        offer=offer_schema.dump(offer),
        history=offer_schema.dump(_offer_history(offer), many=True),
    )