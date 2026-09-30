"""create catalog tables

Revision ID: 73b1c6a42d8f
Revises: 05e8ac154262
Create Date: 2026-09-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "73b1c6a42d8f"
down_revision = "05e8ac154262"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "inactive", name="category_status"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"], unique=False)

    op.create_table(
        "conditions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("condition_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("year_used", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(length=160), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "pending", "active", "sold", "archived", "rejected", name="product_status"),
            nullable=False,
        ),
        sa.Column("view_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["condition_id"], ["conditions.id"]),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_store_id", "products", ["store_id"], unique=False)
    op.create_index("ix_products_category_id", "products", ["category_id"], unique=False)
    op.create_index("ix_products_condition_id", "products", ["condition_id"], unique=False)
    op.create_index("ix_products_status", "products", ["status"], unique=False)

    op.create_table(
        "product_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=1000), nullable=False),
        sa.Column(
            "image_type",
            sa.Enum("main", "gallery", name="product_image_type"),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_images_product_id", "product_images", ["product_id"], unique=False)

    conditions = sa.table(
        "conditions",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String(length=80)),
        sa.column("description", sa.Text()),
    )
    op.bulk_insert(
        conditions,
        [
            {"id": 1, "name": "Baru", "description": None},
            {"id": 2, "name": "Seperti Baru", "description": None},
            {"id": 3, "name": "Bekas Bagus", "description": None},
            {"id": 4, "name": "Bekas Layak", "description": None},
        ],
    )


def downgrade():
    op.drop_index("ix_product_images_product_id", table_name="product_images")
    op.drop_table("product_images")
    op.drop_index("ix_products_status", table_name="products")
    op.drop_index("ix_products_condition_id", table_name="products")
    op.drop_index("ix_products_category_id", table_name="products")
    op.drop_index("ix_products_store_id", table_name="products")
    op.drop_table("products")
    op.drop_table("conditions")
    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_table("categories")