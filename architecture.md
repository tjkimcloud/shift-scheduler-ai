# Architecture Diagram

## System Overview
```
                        ┌─────────────────────────────────────┐
                        │           GitHub Actions            │
                        │         CI/CD Pipeline              │
                        └──────────────┬──────────────────────┘
                                       │ push to main
                                       ▼
┌──────────────┐         ┌─────────────────────────┐
│   Developer  │───────▶│      Amazon ECR         │
│   Local Dev  │         │   (Docker Registry)     │
└──────────────┘         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │      Amazon ECS         │
                         │     (Fargate)           │
                         │                         │
                         │  ┌───────────────────┐  │
                         │  │   FastAPI App     │  │
                         │  │   Port 8000       │  │
                         │  └────────┬──────────┘  │
                         └───────────┼─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                 ▼
             ┌──────────┐   ┌──────────────┐   ┌──────────────┐
             │ PostgreSQL│  │   OpenAI     │   │  CloudWatch  │
             │ pgvector  │  │   API        │   │    Logs      │
             │(Embeddings│  │  (GPT-3.5 +  │   │              │
             │& Schedules│  │  Embeddings) │   │              │
             └──────────┘   └──────────────┘   └──────────────┘

## Request Flow

1. Restaurant owner POSTs availability data to /ingest
2. App chunks text and calls OpenAI Embeddings API
3. Embeddings stored in PostgreSQL pgvector
4. Owner POSTs to /generate-schedule
5. App retrieves relevant chunks from pgvector
6. App sends chunks + prompt to OpenAI GPT
7. GPT returns completed weekly schedule
8. Schedule saved to database and returned to user

## Infrastructure

- VPC with public subnets in us-east-1a and us-east-1b
- ECS Fargate task: 0.25 vCPU, 0.5GB memory
- Security group: inbound port 8000, outbound all
- IAM role: AmazonECSTaskExecutionRolePolicy
- CloudWatch log retention: 7 days