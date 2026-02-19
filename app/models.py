from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    availability_text = Column(Text, nullable=False)
    generated_schedule = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())