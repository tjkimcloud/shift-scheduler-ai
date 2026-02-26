from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base
from pgvector.sqlalchemy import Vector

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Supabase user ID
    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    is_pro = Column(Boolean, default=False)
    schedules_this_month = Column(Integer, default=0)
    stripe_customer_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stripe_customer_id = Column(String, nullable=True)

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False)  # Links to Supabase user
    availability_text = Column(Text, nullable=False)
    generated_schedule = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False)  # Links to Supabase user
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())