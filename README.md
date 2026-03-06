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
- **RAG pipeline** — historical schedules and availability sheets indexed as vector embeddings, retrieved via cosine similarity search, scoped per location

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
- **Terraform** — all AWS infrastructure defined as code (Infrastructure as Code)

---

## Features

### Schedule Generation
- Connect Google Drive via OAuth 2.0
- Upload or point to availability sheets (spreadsheets, docs, images, PDFs)
- AI reads availability data and generates a full 7-day schedule
- Schedule rendered as an interactive calendar with color-coded shifts
- Employee limit enforced at generation time based on plan (prompt-level + shift-level safety net)

### Calendar & Editing
- Drag-and-drop shift editing — move employees between days and time slots
- Raw text view of the generated schedule
- Print-ready layout

### AI Chat Assistant
- Natural language schedule modifications ("Add Eric Kim Sunday 8am–10am")
- Backed by RAG — queries vector database of ingested documents, scoped to the active location
- Answers historical questions from indexed schedules and availability data
- Returns structured JSON for instant calendar updates without re-parsing

### RAG / Historical Queries
- Every ingested document is chunked and embedded via `text-embedding-ada-002`
- Chat endpoint performs cosine similarity search (pgvector `<=>` operator) to find relevant context
- All vector queries are scoped by `user_id` + `location_id` to prevent data bleed between locations
- Finalized schedules are saved as vector chunks for future historical queries
- Supports questions like "who worked last Thursday?" or "when did Daniel start?"

### Multi-Location Support
- Users create named locations; all ingested files and schedules are tagged with a `location_id`
- Switching locations clears the active schedule view — no stale data
- RAG queries are filtered by `location_id` so historical context never crosses location boundaries
- Free and Pro plans are hard-blocked at 1 location; Business plan allows unlimited locations
- Attempting to add a second location on Free/Pro returns a 403 with an upgrade prompt

### Auth & Billing
- Email/password auth via Supabase
- Google OAuth 2.0 for Drive integration
- Freemium model with three plan tiers:

| | **Free** | **Pro** | **Business** |
|---|---|---|---|
| Employees | 5 max | Unlimited | Unlimited |
| Locations | 1 | 1 | Unlimited |
| RAG history | Per location | Per location | Per location, isolated |
| Price | $0 | $X/mo | $XX/mo |

- Stripe Checkout and Customer Portal for subscription management
- Webhook handling for subscription lifecycle events (`checkout.session.completed`, `customer.subscription.deleted`)
- Plan limits (`max_employees`, `max_locations`) stored on the user record and updated automatically on upgrade/downgrade

### Monthly Reset
- Supabase `pg_cron` extension runs a daily job at midnight UTC
- Resets `schedules_this_month = 0` for any user whose 30-day window from `created_at` has elapsed
- No EventBridge or Lambda required — runs entirely inside PostgreSQL

---

## Infrastructure as Code

All AWS infrastructure is defined in `infra/main.tf`. Standing up the entire stack from scratch:

```bash
cd infra
terraform init
terraform apply
```

This provisions: VPC, subnets, internet gateway, security groups, ECR, ECS cluster, task definition, Fargate service, ALB, target group, HTTPS listener, ACM certificate reference, WAF web ACL, auto-scaling target and policy (1→4 tasks on CPU), CloudWatch log group, IAM roles, Secrets Manager references, and Route 53 alias record.

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
   source, user_id,
   location_id)           ← scoped per location
       │
  [on chat query]
       │
       ▼
  embed user question
       │
       ▼
  cosine similarity search
  ORDER BY embedding <=> :query_embedding
  WHERE user_id = :uid
    AND location_id = :lid   ← location-isolated
  LIMIT 5
       │
       ▼
  inject as context
  into gpt-4o-mini prompt
```

Finalized schedules are also embedded and stored in `document_chunks` so they become queryable history for future chat sessions.

---

## LLM Provider Abstraction

`app/llm_provider.py` wraps the completion call behind a simple interface. The active provider is controlled via an environment variable, making it straightforward to swap between OpenAI and AWS Bedrock without changing any calling code:

```python
# Switch provider via env var
LLM_PROVIDER=openai   # uses gpt-4o-mini
LLM_PROVIDER=bedrock  # uses Amazon Bedrock (Claude or Titan)
```

This keeps the backend cloud-agnostic at the LLM layer while the rest of the infrastructure remains on AWS.

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
│   ├── models.py         # SQLAlchemy models (User, Location, Schedule, DocumentChunk)
│   ├── database.py       # DB connection
│   ├── auth.py           # JWT + Supabase auth
│   ├── embeddings.py     # Chunking + OpenAI embeddings
│   ├── google_drive.py   # OAuth flow + file download
│   ├── llm_provider.py   # OpenAI / Bedrock completion wrapper
│   └── billing.py        # Stripe integration
├── frontend/
│   └── app/
│       ├── dashboard/    # Main scheduling interface (location selector, calendar, chat)
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

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | Supabase user ID |
| email | varchar | unique |
| is_pro | boolean | Pro or Business plan |
| schedules_this_month | integer | reset monthly by pg_cron |
| stripe_customer_id | varchar | nullable |
| google_credentials | text | OAuth token JSON |
| max_employees | integer | 5 (free), 9999 (pro/business) |
| max_locations | integer | 1 (free/pro), 9999 (business) |
| created_at | timestamptz | used for 30-day reset window |

### `locations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| user_id | varchar | FK → users.id |
| name | text | e.g. "Main Street", "Downtown" |
| created_at | timestamptz | |

### `document_chunks`
| Column | Type | Notes |
|--------|------|-------|
| id | integer | primary key |
| user_id | varchar | scoping |
| location_id | uuid | FK → locations.id, nullable |
| content | text | chunk text |
| embedding | vector(1536) | pgvector |
| source | varchar | original filename |
| created_at | timestamptz | |

### `schedules`
| Column | Type | Notes |
|--------|------|-------|
| id | integer | primary key |
| user_id | varchar | |
| location_id | uuid | FK → locations.id, nullable |
| availability_text | text | raw input context |
| generated_schedule | text | LLM output |
| created_at | timestamptz | |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/me` | Current user + plan limits |
| GET | `/drive/auth` | Get Google OAuth URL |
| GET | `/auth/callback` | Google OAuth callback |
| GET | `/drive/files` | List scheduling files from Drive |
| POST | `/drive/ingest/{file_id}` | Chunk, embed, and store a file (accepts `?location_id=`) |
| GET | `/locations` | List user's locations |
| POST | `/locations` | Create a location (enforces plan limit) |
| DELETE | `/locations/{location_id}` | Delete a location |
| POST | `/generate-schedule` | Generate weekly schedule (accepts `?location_id=`) |
| POST | `/finalize-schedule` | Embed and save the finalized schedule as history |
| POST | `/chat` | AI assistant with RAG context (location-scoped) |
| GET | `/schedules` | Retrieve saved schedules |
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/portal` | Open Stripe customer portal |
| POST | `/billing/webhook` | Handle Stripe subscription events |

---

## Environment Variables

### Backend
```
DATABASE_URL            PostgreSQL connection string (via Secrets Manager in prod)
SUPABASE_URL            Supabase project URL
SUPABASE_SECRET_KEY     Supabase service role key
OPENAI_API_KEY          OpenAI API key
GOOGLE_CLIENT_ID        Google OAuth client ID
GOOGLE_CLIENT_SECRET    Google OAuth client secret
STRIPE_SECRET_KEY       Stripe secret key
STRIPE_WEBHOOK_SECRET   Stripe webhook signing secret
LLM_PROVIDER            openai (default) or bedrock
```

### Frontend
```
NEXT_PUBLIC_API_URL     Backend API base URL
```

---

## Scaling Roadmap

The current stack is intentionally right-sized for an early-stage product. As load grows, the natural upgrade path is:

- **ECS → EKS** for more granular autoscaling and multi-region support
- **pgvector → Pinecone** for dedicated vector search at scale
- **In-process tasks → SQS + worker** for async ingestion jobs
- **Single ALB → multi-region ALB + Route 53 latency routing** for global low-latency
- **Supabase PostgreSQL → Aurora** for higher write throughput and read replicas
- **ElastiCache (Redis)** for session caching and rate limiting

---

## License

MIT