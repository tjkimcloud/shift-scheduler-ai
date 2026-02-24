from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from openai import OpenAI
from dotenv import load_dotenv
import os
from app import models
from app.database import engine, get_db, init_db
from app.embeddings import chunk_text, get_embeddings
from app.google_drive import create_flow, get_drive_service, list_files, download_file

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Store tokens temporarily in memory
token_store = {}

@app.get("/")
def root():
    return {"message": "Shift Scheduler AI is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/auth/login")
def login():
    flow = create_flow()
    auth_url, state = flow.authorization_url(prompt='consent')
    token_store['state'] = state
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
def callback(code: str, state: str):
    flow = create_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    token_store['credentials'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret
    }
    return {"message": "Successfully connected to Google Drive"}

@app.get("/drive/files")
def get_files():
    if 'credentials' not in token_store:
        return {"error": "Not authenticated. Visit /auth/login first"}
    service = get_drive_service(token_store['credentials'])
    files = list_files(service)
    return {"files": files}

@app.post("/drive/ingest/{file_id}")
def ingest_drive_file(file_id: str, db: Session = Depends(get_db)):
    if 'credentials' not in token_store:
        return {"error": "Not authenticated. Visit /auth/login first"}
    
    service = get_drive_service(token_store['credentials'])
    files = list_files(service)
    file_info = next((f for f in files if f['id'] == file_id), None)
    
    if not file_info:
        return {"error": "File not found"}
    
    content = download_file(service, file_id, file_info['mimeType'])
    chunks = chunk_text(content)
    embeddings = get_embeddings(chunks)
    
    for chunk, embedding in zip(chunks, embeddings):
        db_chunk = models.DocumentChunk(
            content=chunk,
            embedding=embedding,
            source=file_info['name']
        )
        db.add(db_chunk)
    db.commit()
    
    return {"message": f"Ingested {len(chunks)} chunks from {file_info['name']}"}

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