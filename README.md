# Shift Scheduler AI

An AI-powered restaurant shift scheduling system built with FastAPI, PostgreSQL, pgvector, and OpenAI. Uses RAG (Retrieval-Augmented Generation) to intelligently process employee availability and generate optimized weekly schedules.

## The Problem

Restaurant owners spend hours every week manually building schedules — cross-referencing availability sheets, tracking part-time vs full-time hours, accounting for call-offs, and ensuring coverage during peak hours. This system automates that process.

## How It Works

1. Employee availability is submitted and ingested into the system
2. Text is chunked and converted into vector embeddings using OpenAI
3. Embeddings are stored in PostgreSQL with pgvector for semantic search
4. Owner requests a schedule — the system retrieves relevant availability data and sends it to an LLM
5. A complete weekly schedule is generated and saved to the database

## Architecture
```
FastAPI (API Layer)
    ↓
OpenAI Embeddings → pgvector (Vector Store)
    ↓
OpenAI GPT (Schedule Generation)
    ↓
PostgreSQL (Schedule History)
```

## Tech Stack

- **API**: FastAPI + Uvicorn
- **Database**: PostgreSQL + pgvector
- **AI**: OpenAI GPT-3.5 + OpenAI Embeddings
- **RAG Framework**: LangChain
- **Containerization**: Docker + Docker Compose
- **Language**: Python 3.10

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root health check |
| GET | `/health` | Service health status |
| POST | `/ingest` | Ingest availability data into vector store |
| POST | `/generate-schedule` | Generate AI schedule from availability |
| GET | `/schedules` | Retrieve all past schedules |

## Running Locally

### Prerequisites
- Docker Desktop
- OpenAI API key

### Setup

1. Clone the repo
```bash
git clone https://github.com/tjkimcloud/shift-scheduler-ai.git
cd shift-scheduler-ai
```

2. Create `.env` file
```bash
OPENAI_API_KEY=your_key_here
```

3. Start the stack
```bash
docker compose up --build
```

4. Visit `http://localhost:8000/docs` for the interactive API docs

## Project Structure
```
shift-scheduler-ai/
├── app/
│   ├── main.py          # FastAPI routes
│   ├── database.py      # Database connection
│   ├── models.py        # SQLAlchemy models
│   └── embeddings.py    # RAG pipeline
├── sample_data/
│   └── availability.txt # Sample employee availability
├── infra/               # AWS infrastructure (Terraform) - coming soon
├── worker/              # Background worker service - coming soon
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Roadmap

- [x] FastAPI with health endpoints
- [x] PostgreSQL + pgvector integration
- [x] RAG pipeline with OpenAI embeddings
- [x] Schedule generation with GPT
- [ ] Google Drive OAuth integration
- [ ] AWS deployment with ECS Fargate
- [ ] CI/CD with GitHub Actions
- [ ] CloudWatch monitoring and alerting
```

Save it then run:
```
git add .
git commit -m "add project README"
git push