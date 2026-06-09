"""add google oauth fields

Revision ID: add_google_oauth
Revises: 
Create Date: 2026-06-07 11:56:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_google_oauth'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('oauth_provider', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('oauth_subject', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'oauth_provider')
    op.drop_column('users', 'oauth_subject')
