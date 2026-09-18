"""add staff fields to users

Revision ID: b8e2f4a6c1d3
Revises: e91c58d3f742
Create Date: 2026-09-18 11:20:14.302915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e2f4a6c1d3'
down_revision: Union[str, Sequence[str], None] = 'e91c58d3f742'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Hepsi boş bırakılabilir: seed ile açılmış mevcut kullanıcılarda ad ve iletişim bilgisi yok.
    op.add_column('users', sa.Column('first_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('contact_email', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'created_at')
    op.drop_column('users', 'contact_email')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
