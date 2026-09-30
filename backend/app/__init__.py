import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from marshmallow import ValidationError
from sqlalchemy import text
from werkzeug.exceptions import HTTPException

from app.extensions import db, jwt, ma, migrate


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

    CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    ma.init_app(app)

    from app import models  # noqa: F401
    from app.routes.auth import auth_bp
    from app.routes.catalog import categories_bp, conditions_bp, products_bp
    from app.routes.cart import cart_bp
    from app.routes.chat import chat_bp
    from app.routes.checkout import checkout_bp
    from app.routes.offer import offer_bp
    from app.routes.stores import stores_bp
    from app.routes.wishlist import wishlist_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")
    app.register_blueprint(conditions_bp, url_prefix="/api/conditions")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(cart_bp, url_prefix="/api/cart")
    app.register_blueprint(chat_bp, url_prefix="/api/chats")
    app.register_blueprint(checkout_bp, url_prefix="/api/checkout")
    app.register_blueprint(offer_bp, url_prefix="/api/offers")
    app.register_blueprint(stores_bp, url_prefix="/api/stores")
    app.register_blueprint(wishlist_bp, url_prefix="/api/wishlist")

    @app.route("/api/health")
    def health():
        db.session.execute(text("SELECT 1"))
        return jsonify(status="ok", database="connected")

    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        message = next(iter(error.messages.values()))
        if isinstance(message, list):
            message = message[0]
        return jsonify(error=str(message)), 400

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify(error=error.description), error.code

    @jwt.unauthorized_loader
    def handle_missing_token(_reason):
        return jsonify(error="Token autentikasi diperlukan"), 401

    @jwt.invalid_token_loader
    def handle_invalid_token(_reason):
        return jsonify(error="Token tidak valid"), 401

    @jwt.expired_token_loader
    def handle_expired_token(_jwt_header, _jwt_payload):
        return jsonify(error="Token sudah kedaluwarsa"), 401

    return app