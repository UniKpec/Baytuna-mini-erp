"""add stock_movements and product cost/price fields

Revision ID: c4a2b7e1d905
Revises: 27df53a7197b
Create Date: 2026-09-06 10:12:41.108224

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a2b7e1d905'
down_revision: Union[str, Sequence[str], None] = '27df53a7197b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('products', sa.Column('sku', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('margin_percent', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('products', sa.Column('avg_cost', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False))
    op.add_column('products', sa.Column('sale_price', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False))
    op.add_column('products', sa.Column('stock_quantity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('products', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    op.add_column('products', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    op.alter_column('products', 'name', existing_type=sa.String(), type_=sa.String(length=255), existing_nullable=True)
    op.create_unique_constraint('uq_products_sku', 'products', ['sku'])
    # Satış fiyatı artık elle girilmiyor, ortalama maliyet + marj ile hesaplanıyor.
    op.drop_column('products', 'price')
    op.create_table('stock_movements',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('stock_movements')
    op.add_column('products', sa.Column('price', sa.Float(), nullable=True))
    op.drop_constraint('uq_products_sku', 'products', type_='unique')
    op.alter_column('products', 'name', existing_type=sa.String(length=255), type_=sa.String(), existing_nullable=True)
    op.drop_column('products', 'updated_at')
    op.drop_column('products', 'created_at')
    op.drop_column('products', 'stock_quantity')
    op.drop_column('products', 'sale_price')
    op.drop_column('products', 'avg_cost')
    op.drop_column('products', 'margin_percent')
    op.drop_column('products', 'sku')
