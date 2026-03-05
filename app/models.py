from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from pgvector.sqlalchemy import Vector
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Supabase user ID
    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    is_pro = Column(Boolean, default=False)
    schedules_this_month = Column(Integer, default=0)
    stripe_customer_id = Column(String, nullable=True)
    google_credentials = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    max_employees = Column(Integer, default=5)
    max_locations = Column(Integer, default=1)

    locations = relationship("Location", back_populates="user", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="locations")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    availability_text = Column(Text, nullable=False)
    generated_schedule = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)