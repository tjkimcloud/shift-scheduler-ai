from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from app import models
from app.database import engine, get_db, init_db
from app.embeddings import chunk_text, get_embeddings
from app.google_drive import create_flow, get_drive_service, list_files, download_file
from app.auth import get_current_user, get_supabase
from app.llm_provider import generate_completion
from app.billing import create_checkout_session, create_portal_session, handle_webhook
from fastapi import Request
from fastapi.responses import JSONResponse

class AuthRequest(BaseModel):
    email: str
    password: str

load_dotenv()

init_db()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedio API", description="AI-powered scheduling for small businesses")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FREE_TIER_LIMIT = 3

@app.get("/")
def root():
    return {"message": "Schedio API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/auth/register")
def register(request: AuthRequest, db: Session = Depends(get_db)):
    supabase = get_supabase()
    try:
        response = supabase.auth.sign_up({"email": request.email, "password": request.password})
        user_id = response.user.id
        db_user = models.User(id=user_id, email=request.email)
        db.add(db_user)
        db.commit()
        return {"message": "User created successfully", "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
def login(request: AuthRequest):
    supabase = get_supabase()
    try:
        response = supabase.auth.sign_in_with_password({"email": request.email, "password": request.password})
        return {
            "access_token": response.session.access_token,
            "user_id": response.user.id
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/drive/auth")
def drive_auth(current_user=Depends(get_current_user)):
    flow = create_flow()
    auth_url, state = flow.authorization_url(prompt='consent')
    return {"auth_url": auth_url}

@app.get("/auth/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    flow = create_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    creds_dict = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret
    }
    service = get_drive_service(creds_dict)
    about = service.about().get(fields='user').execute()
    google_email = about['user']['emailAddress']
    db_user = db.query(models.User).filter(models.User.email == google_email).first()
    if db_user:
        import json
        db_user.google_credentials = json.dumps(creds_dict)
        db.commit()
    return RedirectResponse("https://schedio.cloud/dashboard")

@app.get("/drive/files")
def get_files(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    import json
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user or not db_user.google_credentials:
        return {"error": "Not connected to Google Drive. Visit /drive/auth first"}
    creds = json.loads(db_user.google_credentials)
    service = get_drive_service(creds)
    files = list_files(service)
    return {"files": files}

@app.post("/drive/ingest/{file_id}")
def ingest_drive_file(file_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    import json
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user or not db_user.google_credentials:
        return {"error": "Not connected to Google Drive. Visit /drive/auth first"}
    creds = json.loads(db_user.google_credentials)
    service = get_drive_service(creds)
    files = list_files(service)
    file_info = next((f for f in files if f['id'] == file_id), None)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    content = download_file(service, file_id, file_info['mimeType'])
    chunks = chunk_text(content)
    embeddings = get_embeddings(chunks)
    for chunk, embedding in zip(chunks, embeddings):
        db_chunk = models.DocumentChunk(
            user_id=current_user.id,
            content=chunk,
            embedding=embedding,
            source=file_info['name']
        )
        db.add(db_chunk)
    db.commit()
    return {"message": f"Ingested {len(chunks)} chunks from {file_info['name']}"}

@app.post("/generate-schedule")
def generate_schedule(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not db_user.is_pro and db_user.schedules_this_month >= FREE_TIER_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free tier limit reached ({FREE_TIER_LIMIT} schedules/month). Upgrade to Pro for unlimited schedules."
        )
    
    chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.user_id == current_user.id
    ).limit(10).all()
    
    if not chunks:
        raise HTTPException(status_code=400, detail="No availability data found. Please ingest files first.")
    
    availability = "\n\n".join([chunk.content for chunk in chunks])
    
    schedule = generate_completion(
        prompt=f"Here is the employee availability:\n\n{availability}\n\nPlease create a weekly schedule for a business that is open 7 days a week, 9am to 10pm.",
        system="You are a scheduling assistant for small businesses. Create a fair weekly schedule based on employee availability."
    )
    
    db_schedule = models.Schedule(
        user_id=current_user.id,
        availability_text=availability,
        generated_schedule=schedule
    )
    db.add(db_schedule)
    db.commit()
    
    db_user.schedules_this_month += 1
    db.commit()
    
    return {"schedule": schedule}

@app.get("/schedules")
def get_schedules(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    schedules = db.query(models.Schedule).filter(
        models.Schedule.user_id == current_user.id
    ).all()
    return {"schedules": schedules}

@app.get("/me")
def get_me(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    return {
        "email": db_user.email,
        "is_pro": db_user.is_pro,
        "schedules_this_month": db_user.schedules_this_month,
        "schedules_remaining": "unlimited" if db_user.is_pro else max(0, FREE_TIER_LIMIT - db_user.schedules_this_month)
    }

@app.post("/billing/checkout")
def checkout(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    checkout_url = create_checkout_session(
        user_id=current_user.id,
        email=db_user.email
    )
    return {"checkout_url": checkout_url}

@app.post("/billing/portal")
def billing_portal(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user or not db_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")
    
    portal_url = create_portal_session(db_user.stripe_customer_id)
    return {"portal_url": portal_url}

@app.post("/billing/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = handle_webhook(payload, sig_header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        customer_id = session["customer"]
        
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if db_user:
            db_user.is_pro = True
            db_user.stripe_customer_id = customer_id
            db.commit()
    
    elif event["type"] == "customer.subscription.deleted":
        customer_id = event["data"]["object"]["customer"]
        db_user = db.query(models.User).filter(
            models.User.stripe_customer_id == customer_id
        ).first()
        if db_user:
            db_user.is_pro = False
            db.commit()
    
    return JSONResponse(content={"status": "success"})