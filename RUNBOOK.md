# Runbook

## Starting the local stack
```bash
docker compose up --build
```

## Stopping the local stack
```bash
docker compose down
```

## Deploying to AWS
Push to main branch — GitHub Actions handles the rest automatically.

## Shutting down AWS resources (cost saving)
Run this when you're not actively using the cloud environment:
```bash
cd infra
terraform destroy
```

Type `yes` to confirm. This will delete all AWS resources and stop all charges.

## Redeploying after destroy
```bash
cd infra
terraform apply
```

Then push a commit to trigger the CI/CD pipeline to redeploy your image.

## Checking logs
Go to AWS CloudWatch → Log groups → /ecs/shift-scheduler-ai

## Checking the live API
- Health check: http://107.23.142.250:8000/health
- API docs: http://107.23.142.250:8000/docs

## Monthly cost estimate
- ECS Fargate (0.25 vCPU, 0.5GB): ~$8/month
- ECR storage: ~$0.10/month
- CloudWatch logs: ~$0.50/month
- Total estimate: ~$9/month