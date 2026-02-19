from fastapi import FastAPI
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.get("/")
def root():
    return {"message": "Shift Scheduler AI is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/generate-schedule")
def generate_schedule():
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
    return {"schedule": schedule}