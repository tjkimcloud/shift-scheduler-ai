# Schedio

**AI-powered staff scheduling for small businesses.**

Schedio connects to your Google Drive, reads employee availability, and generates a full weekly schedule using AI. Managers can adjust shifts via drag-and-drop or by chatting with an AI assistant. Historical schedules and availability data are indexed in a vector database, enabling natural language queries like "who worked last Thursday?" or "when did Daniel start?"

Live: [schedio.cloud](https://schedio.cloud)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         schedio.cloud                           │
│                    Next.js 14 (Vercel CDN)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS (us-east-1)                            │
│                                                                 │
│   ┌─────────────┐     ┌──────────────────────────────────┐     │
│   │   AWS WAF   │────▶│   Application Load Balancer       │     │
│   │ (Web ACL)   │     │   (HTTPS, TLS 1.3, ACM cert)     │     │
│   └─────────────┘     └──────────────┬───────────────────┘     │
│                                      │                          │
│                        ┌─────────────▼──────────────┐          │
│                        │      ECS Fargate Cluster    │          │
│                        │   ┌──────────┐ ┌─────────┐ │          │
│                        │   │ Task 1   │ │ Task 2  │ │          │
│                        │   │FastAPI   │ │FastAPI  │ │          │
│                        │   └──────────┘ └─────────┘ │          │
│                        │   Auto-scales 1→4 on CPU   │          │
│                        └─────────────┬──────────────┘          │
│                                      │                          │
│          ┌───────────────────────────┼───────────────┐         │
│          │                           │               │         │
│   ┌──────▼──────┐          ┌─────────▼──────┐  ┌────▼──────┐  │
│   │  Supabase   │          │  AWS Secrets   │  │    ECR    │  │
│   │  PostgreSQL │          │    Manager     │  │  (Docker) │  │
│   │  + pgvector │          │  (API keys,    │  │           │  │
│   │             │          │   DB creds)    │  └───────────┘  │
│   └─────────────┘          └────────────────┘                  │
│                                                                 │
│   Route 53 ──▶ ALB (auto-updates on infra changes)             │
└─────────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   OpenAI API    │
                    │  gpt-4o-mini    │
                    │  embeddings     │
                    └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Google Drive   │
                    │  OAuth 2.0      │
                    └─────────────────┘
```

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router) — React framework with server components
- **Tailwind CSS** — utility-first styling
- **Vercel** — deployment and CDN

### Backend
- **FastAPI** (Python) — async REST API
- **SQLAlchemy** — ORM for PostgreSQL
- **Supabase** — PostgreSQL database + auth (JWT)
- **pgvector** — vector similarity search for RAG

### AI / ML
- **OpenAI gpt-4o-mini** — schedule generation and chat assistant
- **text-embedding-ada-002** — document chunk embeddings
- **RAG pipeline** — historical schedules and availability sheets indexed as vector embeddings, retrieved via cosine similarity search

### Infrastructure (AWS)
- **ECS Fargate** — serverless container hosting
- **ECR** — Docker image registry
- **Application Load Balancer** — HTTPS termination, health checks
- **AWS WAF** — managed rule sets for common threats and known bad inputs
- **AWS Secrets Manager** — encrypted storage for all API keys and credentials
- **Route 53** — DNS with alias records pointing to ALB
- **ACM** — TLS certificate (auto-renewing)
- **CloudWatch** — container logs and metrics
- **App Auto Scaling** — ECS scales from 1 to 4 tasks based on CPU utilization

### CI/CD
- **GitHub Actions** — build, push to ECR, deploy to ECS on every push to `main`
- **Terraform** — all AWS infrastructure defined as code

---

## Features

### Schedule Generation
- Connect Google Drive via OAuth 2.0
- Upload or point to availability sheets (spreadsheets, docs, images, PDFs)
- AI reads availability data and generates a full 7-day schedule
- Schedule rendered as an interactive calendar with color-coded shifts

### Calendar & Editing
- Drag-and-drop shift editing — move employees between days and time slots
- Raw text view of the generated schedule
- Print-ready layout

### AI Chat Assistant
- Natural language schedule modifications ("Add Eric Kim Sunday 8am–10am")
- Backed by RAG — queries vector database of ingested documents
- Answers historical questions from indexed schedules and availability data
- Returns structured JSON for instant calendar updates without re-parsing

### RAG / Historical Queries
- Every ingested document is chunked and embedded via `text-embedding-ada-002`
- Chat endpoint performs cosine similarity search (pgvector `<=>` operator) to find relevant context
- Supports questions like "who worked last Thursday?" or "when did Daniel start?"
- Generated schedules are also saved as vector chunks for future reference

### Auth & Billing
- Email/password auth via Supabase
- Google OAuth 2.0 for Drive integration
- Freemium model — 3 schedules/month free, unlimited on Pro
- Stripe Checkout and Customer Portal for subscription management
- Webhook handling for subscription lifecycle events

---

## Infrastructure as Code

All AWS infrastructure is defined in `infra/main.tf`. Standing up the entire stack from scratch:

```bash
cd infra
terraform init
terraform apply
```

This provisions: VPC, subnets, internet gateway, security groups, ECR, ECS cluster, task definition, Fargate service, ALB, target group, HTTPS listener, ACM certificate reference, WAF web ACL, auto-scaling target and policy, CloudWatch log group, IAM roles, Secrets Manager references, and Route 53 alias record.

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles building the Docker image and deploying to ECS on every push to `main`.

---

## RAG Pipeline

```
Google Drive file
       │
       ▼
  download_file()         ← handles Sheets, Docs, PDFs, images
       │
       ▼
   chunk_text()           ← splits into ~500 token chunks
       │
       ▼
  get_embeddings()        ← OpenAI text-embedding-ada-002
       │
       ▼
  document_chunks table   ← PostgreSQL + pgvector
  (content, embedding,
   source, user_id)
       │
  [on chat query]
       │
       ▼
  embed user question
       │
       ▼
  cosine similarity search
  ORDER BY embedding <=> :query_embedding
  LIMIT 5
       │
       ▼
  inject as context
  into gpt-4o-mini prompt
```

---

## Local Development

### Backend

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env
cp .env.example .env
# Fill in: DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY,
#          OPENAI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

---

## Project Structure

```
schedio/
├── app/
│   ├── main.py           # FastAPI routes
│   ├── models.py         # SQLAlchemy models
│   ├── database.py       # DB connection
│   ├── auth.py           # JWT + Supabase auth
│   ├── embeddings.py     # Chunking + OpenAI embeddings
│   ├── google_drive.py   # OAuth flow + file download
│   ├── llm_provider.py   # OpenAI completion wrapper
│   └── billing.py        # Stripe integration
├── frontend/
│   └── app/
│       ├── dashboard/    # Main scheduling interface
│       ├── login/        # Auth pages
│       ├── register/
│       └── upgrade/      # Stripe checkout
├── infra/
│   └── main.tf           # All AWS infrastructure
├── .github/
│   └── workflows/
│       └── deploy.yml    # CI/CD pipeline
└── Dockerfile
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/me` | Current user + usage stats |
| GET | `/drive/auth` | Get Google OAuth URL |
| GET | `/drive/files` | List scheduling files from Drive |
| POST | `/drive/ingest/{file_id}` | Chunk, embed, and store a file |
| POST | `/generate-schedule` | Generate weekly schedule from ingested data |
| POST | `/chat` | AI assistant with RAG context |
| GET | `/schedules` | Retrieve saved schedules |
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/portal` | Open Stripe customer portal |
| POST | `/billing/webhook` | Handle Stripe subscription events |

---

## Environment Variables

### Backend
```
DATABASE_URL          PostgreSQL connection string (via Secrets Manager in prod)
SUPABASE_URL          Supabase project URL
SUPABASE_SECRET_KEY   Supabase service role key
OPENAI_API_KEY        OpenAI API key
GOOGLE_CLIENT_ID      Google OAuth client ID
GOOGLE_CLIENT_SECRET  Google OAuth client secret
STRIPE_SECRET_KEY     Stripe secret key
STRIPE_WEBHOOK_SECRET Stripe webhook signing secret
```

### Frontend
```
NEXT_PUBLIC_API_URL   Backend API base URL
```

---

## License

MIT