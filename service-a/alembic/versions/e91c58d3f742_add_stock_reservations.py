"""add stock_reservations

Revision ID: e91c58d3f742
Revises: c4a2b7e1d905
Create Date: 2026-09-06 14:38:02.517903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e91c58d3f742'
down_revision: Union[str, Sequence[str], None] = 'c4a2b7e1d905'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('stock_reservations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('reservation_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    # Idempotency buradan geliyor: aynı sipariş ikinci kez rezervasyon yapamaz.
    sa.UniqueConstraint('reservation_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('stock_reservations')
