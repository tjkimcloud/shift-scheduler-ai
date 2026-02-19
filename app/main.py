from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Shift Scheduler AI is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}