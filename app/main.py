from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
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

FREE_TIER_EMPLOYEE_LIMIT = 5
FREE_TIER_LOCATION_LIMIT = 1
PRO_TIER_LOCATION_LIMIT = 1

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
        db_user = models.User(
            id=user_id,
            email=request.email,
            max_employees=FREE_TIER_EMPLOYEE_LIMIT,
            max_locations=FREE_TIER_LOCATION_LIMIT
        )
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
    return RedirectResponse("https://schedio.cloud/dashboard?connected=google")

@app.get("/drive/files")
def get_files(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    import json
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user or not db_user.google_credentials:
        return {"error": "Not connected to Google Drive. Visit /drive/auth first"}
    creds = json.loads(db_user.google_credentials)
    service = get_drive_service(creds)
    files = list_files(service)
    
    allowed_types = [
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.google-apps.document',
        'application/pdf',
        'image/jpeg',
        'image/png',
    ]
    filtered = [f for f in files if f.get('mimeType') in allowed_types]
    return {"files": filtered}

@app.post("/drive/ingest/{file_id}")
def ingest_drive_file(file_id: str, location_id: str = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
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
            source=file_info['name'],
            location_id=location_id
        )
        db.add(db_chunk)
    db.commit()
    return {"message": f"Ingested {len(chunks)} chunks from {file_info['name']}"}

# --- Location endpoints ---

class LocationRequest(BaseModel):
    name: str

@app.get("/locations")
def get_locations(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    locations = db.query(models.Location).filter(
        models.Location.user_id == current_user.id
    ).all()
    return {"locations": [{"id": str(loc.id), "name": loc.name, "created_at": str(loc.created_at)} for loc in locations]}

@app.post("/locations")
def create_location(request: LocationRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()

    existing_locations = db.query(models.Location).filter(
        models.Location.user_id == current_user.id
    ).count()

    max_locations = db_user.max_locations or FREE_TIER_LOCATION_LIMIT

    if existing_locations >= max_locations:
        plan = "Pro" if db_user.is_pro else "Free"
        raise HTTPException(
            status_code=403,
            detail=f"Location limit reached. Your {plan} plan allows {max_locations} location(s). Upgrade to Business for multiple locations."
        )

    location = models.Location(
        user_id=current_user.id,
        name=request.name
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {"id": str(location.id), "name": location.name}

@app.delete("/locations/{location_id}")
def delete_location(location_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    location = db.query(models.Location).filter(
        models.Location.id == location_id,
        models.Location.user_id == current_user.id
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(location)
    db.commit()
    return {"message": "Location deleted"}

# --- Schedule endpoints ---

@app.post("/generate-schedule")
def generate_schedule(location_id: str = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from datetime import datetime, timedelta
    from openai import OpenAI
    import json
    
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch availability chunks scoped by location if provided
    chunks_query = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.user_id == current_user.id
    )
    if location_id:
        chunks_query = chunks_query.filter(models.DocumentChunk.location_id == location_id)
    chunks = chunks_query.limit(10).all()
    
    if not chunks:
        raise HTTPException(status_code=400, detail="No availability data found. Please ingest files first.")
    
    availability = "\n\n".join([chunk.content for chunk in chunks])

    # Enforce free tier employee limit
    max_employees = db_user.max_employees or FREE_TIER_EMPLOYEE_LIMIT
    employee_limit_instruction = ""
    if not db_user.is_pro:
        employee_limit_instruction = f"\n\nIMPORTANT: This is a free tier account. Only schedule a maximum of {max_employees} employees. If more employees are in the availability data, pick the first {max_employees} and ignore the rest."

    # Generate week dates starting from Monday
    today = datetime.now()
    day_of_week = today.weekday()
    monday = today - timedelta(days=day_of_week)
    week_dates = [(monday + timedelta(days=i)).strftime('%A, %m/%d/%Y') for i in range(7)]
    week_str = "\n".join(week_dates)
    
    schedule = generate_completion(
        prompt=f"Here is the employee availability:\n\n{availability}\n\nPlease create a weekly schedule for the following week:\n{week_str}\n\nLabel each day with its full date (e.g. 'Monday, 03/02/2026'). Business hours are 9am to 10pm.{employee_limit_instruction}",
        system="You are a scheduling assistant for small businesses. Create a fair weekly schedule based on employee availability. Always include the full date with each day."
    )
    
    # Convert to structured JSON for the calendar
    client = OpenAI()
    json_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": 'Convert the schedule to JSON. Return ONLY valid JSON, no markdown, no backticks, no explanation. Format: {"shifts": [{"employee": "Name", "day": "Monday", "startHour": 9, "endHour": 17}]}'},
            {"role": "user", "content": schedule}
        ]
    )
    
    try:
        schedule_json = json.loads(json_response.choices[0].message.content)
    except:
        schedule_json = {"shifts": []}

    total_employees = len(set(s["employee"] for s in schedule_json.get("shifts", [])))
    employee_limit_hit = not db_user.is_pro and total_employees > max_employees

    # Save schedule to DB
    db_schedule = models.Schedule(
        user_id=current_user.id,
        availability_text=availability,
        generated_schedule=schedule,
        location_id=location_id
    )
    db.add(db_schedule)
    db_user.schedules_this_month += 1
    db.commit()

    return {
        "shifts": schedule_json.get("shifts", []),
        "schedule": schedule,
        "employee_limit_hit": employee_limit_hit,
        "total_employees": total_employees,
        "max_employees": max_employees
    }

class FinalizeRequest(BaseModel):
    schedule: str
    location_id: str = None

class FinalizeRequest(BaseModel):
    schedule: str
    location_id: str = None
    week_start: str = None  # ISO date string from frontend e.g. "2026-03-02"


@app.post("/finalize-schedule")
def finalize_schedule(request: FinalizeRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from openai import OpenAI
    from datetime import datetime, timedelta, date
    import json

    client = OpenAI()

    # Use frontend-provided week_start (user's local date) or fall back to server
    if request.week_start:
        monday = date.fromisoformat(request.week_start)
    else:
        today = datetime.now().date()
        monday = today - timedelta(days=today.weekday())

    week_dates = [(monday + timedelta(days=i)) for i in range(7)]
    week_label = f"Week of {monday.strftime('%m/%d/%Y')}"

    # Parse the schedule into per-employee chunks using GPT
    parse_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Parse this schedule into a JSON array of employees with their shifts.
Return ONLY valid JSON, no markdown, no backticks.
Format: {"employees": [{"name": "Tony Kim", "shifts": [{"day": "Monday", "startHour": 16, "endHour": 22}, ...]}]}"""},
            {"role": "user", "content": request.schedule}
        ]
    )

    try:
        parsed = json.loads(parse_response.choices[0].message.content)
        employees = parsed.get("employees", [])
    except:
        employees = []

    # Map day names to actual dates
    day_to_date = {
        week_dates[0].strftime('%A'): week_dates[0],
        week_dates[1].strftime('%A'): week_dates[1],
        week_dates[2].strftime('%A'): week_dates[2],
        week_dates[3].strftime('%A'): week_dates[3],
        week_dates[4].strftime('%A'): week_dates[4],
        week_dates[5].strftime('%A'): week_dates[5],
        week_dates[6].strftime('%A'): week_dates[6],
    }

    # Delete any existing schedule history for this week/location to prevent duplicates
    db.execute(
        text("""
            DELETE FROM document_chunks
            WHERE user_id = :user_id
              AND location_id IS NOT DISTINCT FROM :location_id
              AND chunk_type = 'schedule_history'
              AND week_start = :week_start
        """),
        {
            "user_id": current_user.id,
            "location_id": request.location_id,
            "week_start": monday.isoformat()
        }
    )
    db.commit()

    # Save one chunk per employee with real dates
    chunks_saved = 0
    for emp in employees:
        name = emp.get("name", "Unknown")
        shifts = emp.get("shifts", [])
        if not shifts:
            continue

        # Build human-readable content with real dates
        shift_lines = []
        for shift in shifts:
            day_name = shift.get("day", "")
            actual_date = day_to_date.get(day_name)
            if actual_date:
                date_str = actual_date.strftime('%A %m/%d/%Y')
            else:
                date_str = day_name

            start = shift.get("startHour", 0)
            end = shift.get("endHour", 0)
            start_str = f"{start - 12 if start > 12 else start}{'pm' if start >= 12 else 'am'}"
            end_str = f"{end - 12 if end > 12 else end}{'pm' if end >= 12 else 'am'}"
            shift_lines.append(f"  {date_str}: {start_str} – {end_str}")

        content = f"{name} — {week_label}\n" + "\n".join(shift_lines)

        embedding = get_embeddings([content])[0]
        chunk = models.DocumentChunk(
            user_id=current_user.id,
            content=content,
            embedding=embedding,
            source=f"Schedule History — {name} — {week_label}",
            location_id=request.location_id,
            chunk_type="schedule_history",
            week_start=monday
        )
        db.add(chunk)
        chunks_saved += 1

    db.commit()
    return {"message": f"Schedule finalized and saved. {chunks_saved} employee records stored."}


class ChatRequest(BaseModel):
    message: str
    schedule: str
    location_id: str = None
    client_date: str = None  # ISO date string from frontend e.g. "2026-03-05"


@app.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from openai import OpenAI
    from datetime import datetime, timedelta, date
    from sqlalchemy import text
    import json

    client = OpenAI()

    # Resolve client date
    if request.client_date:
        today = date.fromisoformat(request.client_date)
    else:
        today = datetime.now().date()

    # Calculate useful date references to inject into the query
    last_monday = today - timedelta(days=today.weekday() + 7)
    this_monday = today - timedelta(days=today.weekday())
    last_thursday = last_monday + timedelta(days=3)
    last_sunday = last_monday + timedelta(days=6)

    date_context = f"""Today is {today.strftime('%A, %m/%d/%Y')}.
This week starts: {this_monday.strftime('%m/%d/%Y')}
Last week: {last_monday.strftime('%m/%d/%Y')} through {last_sunday.strftime('%m/%d/%Y')}
Last Monday: {last_monday.strftime('%m/%d/%Y')}
Last Tuesday: {(last_monday + timedelta(days=1)).strftime('%m/%d/%Y')}
Last Wednesday: {(last_monday + timedelta(days=2)).strftime('%m/%d/%Y')}
Last Thursday: {last_thursday.strftime('%m/%d/%Y')}
Last Friday: {(last_monday + timedelta(days=4)).strftime('%m/%d/%Y')}
Last Saturday: {(last_monday + timedelta(days=5)).strftime('%m/%d/%Y')}
Last Sunday: {last_sunday.strftime('%m/%d/%Y')}"""

    # Detect if this is a history question or a scheduling question
    intent_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Classify the user's message as either 'history' (asking about past shifts, who worked when, hours worked) or 'scheduling' (making changes to the current schedule, adding/removing shifts). Reply with only one word: history or scheduling."},
            {"role": "user", "content": request.message}
        ]
    )
    intent = intent_response.choices[0].message.content.strip().lower()
    chunk_type_filter = "schedule_history" if intent == "history" else "availability"

    # Augment the query with resolved dates for better vector search
    augmented_query = f"{request.message} {today.strftime('%m/%d/%Y')}"
    question_embedding = get_embeddings([augmented_query])[0]

    # Search only the relevant chunk type
    if request.location_id:
        relevant_chunks = db.execute(
            text("""
            SELECT content, source,
                   1 - (embedding <=> :embedding) as similarity
            FROM document_chunks
            WHERE user_id = :user_id
              AND location_id = :location_id
              AND chunk_type = :chunk_type
            ORDER BY embedding <=> :embedding
            LIMIT 5
            """),
            {
                "embedding": str(question_embedding),
                "user_id": current_user.id,
                "location_id": request.location_id,
                "chunk_type": chunk_type_filter
            }
        ).fetchall()
    else:
        relevant_chunks = db.execute(
            text("""
            SELECT content, source,
                   1 - (embedding <=> :embedding) as similarity
            FROM document_chunks
            WHERE user_id = :user_id
              AND chunk_type = :chunk_type
            ORDER BY embedding <=> :embedding
            LIMIT 5
            """),
            {
                "embedding": str(question_embedding),
                "user_id": current_user.id,
                "chunk_type": chunk_type_filter
            }
        ).fetchall()

    historical_context = "\n\n".join([
        f"[Source: {chunk.source}]\n{chunk.content}"
        for chunk in relevant_chunks
    ]) if relevant_chunks else ""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"""You are a friendly scheduling assistant.

{date_context}

Current schedule:
{request.schedule}

Relevant context ({chunk_type_filter.replace('_', ' ')}):
{historical_context}

You can freely add new employees, remove employees, adjust shifts, and make any scheduling changes. Never ask for qualifications or availability before making changes — just do it.

When making schedule changes, respond in exactly this format:
CONFIRM: [1 sentence confirmation]
SCHEDULE:
[full updated schedule]

For history questions, answer directly and confidently using the context above. Reference exact dates in your answer (e.g. "Yes, Tony worked on Thursday 2/27/2026 from 4pm to 10pm").
For questions unrelated to scheduling, politely redirect."""},
            {"role": "user", "content": request.message}
        ]
    )

    full_response = response.choices[0].message.content
    confirm = full_response
    schedule_text = ""
    shifts = []

    if "SCHEDULE:" in full_response:
        parts = full_response.split("SCHEDULE:", 1)
        confirm = parts[0].replace("CONFIRM:", "").strip()
        schedule_text = parts[1].strip()

        json_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Convert the schedule to JSON. Return ONLY valid JSON, no markdown, no backticks. Format: {\"shifts\": [{\"employee\": \"Name\", \"day\": \"Monday\", \"startHour\": 9, \"endHour\": 17}]}"},
                {"role": "user", "content": schedule_text}
            ]
        )
        try:
            shifts = json.loads(json_response.choices[0].message.content).get("shifts", [])
        except:
            shifts = []

    return {"response": confirm, "schedule": schedule_text, "shifts": shifts}

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
        "schedules_remaining": "unlimited" if db_user.is_pro else "unlimited",
        "max_employees": db_user.max_employees or FREE_TIER_EMPLOYEE_LIMIT,
        "max_locations": db_user.max_locations or FREE_TIER_LOCATION_LIMIT
    }

class CheckoutRequest(BaseModel):
    plan: str = "pro"

@app.post("/billing/checkout")
def checkout(request: CheckoutRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    checkout_url = create_checkout_session(
        user_id=current_user.id,
        email=db_user.email,
        plan=request.plan
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
        price_id = session.get("metadata", {}).get("price_id", "")
        
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if db_user:
            db_user.is_pro = True
            db_user.stripe_customer_id = customer_id
            # Business plan gets unlimited locations
            if "business" in price_id.lower():
                db_user.max_employees = 9999
                db_user.max_locations = 9999
            else:
                # Pro plan: unlimited employees, still 1 location
                db_user.max_employees = 9999
                db_user.max_locations = PRO_TIER_LOCATION_LIMIT
            db.commit()
    
    elif event["type"] == "customer.subscription.deleted":
        customer_id = event["data"]["object"]["customer"]
        db_user = db.query(models.User).filter(
            models.User.stripe_customer_id == customer_id
        ).first()
        if db_user:
            db_user.is_pro = False
            db_user.max_employees = FREE_TIER_EMPLOYEE_LIMIT
            db_user.max_locations = FREE_TIER_LOCATION_LIMIT
            db.commit()
    
    return JSONResponse(content={"status": "success"})