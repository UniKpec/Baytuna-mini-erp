"""add deleted_at to users

Revision ID: d3a7c9e2f105
Revises: b8e2f4a6c1d3
Create Date: 2026-09-18 14:05:37.518204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3a7c9e2f105'
down_revision: Union[str, Sequence[str], None] = 'b8e2f4a6c1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Boş = aktif hesap. Mevcut kullanıcıların hepsi aktif kalır.
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'deleted_at')
