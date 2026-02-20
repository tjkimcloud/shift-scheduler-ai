from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base
from pgvector.sqlalchemy import Vector

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    availability_text = Column(Text, nullable=False)
    generated_schedule = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    source = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())