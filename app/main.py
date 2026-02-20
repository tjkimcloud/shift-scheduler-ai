from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from openai import OpenAI
from dotenv import load_dotenv
import os
from app import models
from app.database import engine, get_db, init_db
from app.embeddings import chunk_text, get_embeddings

load_dotenv()

init_db()
models.Base.metadata.create_all(bind=engine)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.get("/")
def root():
    return {"message": "Shift Scheduler AI is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/ingest")
def ingest_availability(db: Session = Depends(get_db)):
    with open("sample_data/availability.txt", "r") as f:
        text_content = f.read()

    chunks = chunk_text(text_content)
    embeddings = get_embeddings(chunks)

    for chunk, embedding in zip(chunks, embeddings):
        db_chunk = models.DocumentChunk(
            content=chunk,
            embedding=embedding,
            source="availability.txt"
        )
        db.add(db_chunk)
    db.commit()

    return {"message": f"Ingested {len(chunks)} chunks"}

@app.post("/generate-schedule")
def generate_schedule(db: Session = Depends(get_db)):
    with open("sample_data/availability.txt", "r") as f:
        availability = f.read()

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {
                "role": "system",
                "content": "You are a restaurant scheduling assistant. Create a fair weekly schedule based on employee availability."
            },
            {
                "role": "user",
                "content": f"Here is the employee availability:\n\n{availability}\n\nPlease create a weekly schedule for a restaurant that is open 7 days a week, 9am to 10pm."
            }
        ]
    )

    schedule = response.choices[0].message.content

    db_schedule = models.Schedule(
        availability_text=availability,
        generated_schedule=schedule
    )
    db.add(db_schedule)
    db.commit()

    return {"schedule": schedule}

@app.get("/schedules")
def get_schedules(db: Session = Depends(get_db)):
    schedules = db.query(models.Schedule).all()
    return {"schedules": schedules}