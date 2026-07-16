# Technology Stack: Kiroman

## Core Framework
- React 19 with JSX
- Vite for build tooling and dev server
- Tailwind CSS for styling

## Infrastructure
- AWS Lambda (Node.js 22) for backend
- Amazon API Gateway (HTTP API) for REST endpoints
- Amazon DynamoDB for data storage (single-table design)
- Amazon S3 for file storage and frontend hosting
- Amazon CloudFront for CDN (to be configured)
- Amazon Cognito for authentication (to be configured)
- Amazon Bedrock for AI/LLM (if needed)
- Amazon SES for transactional email (if needed)
- Amazon SQS for async processing (if needed)
- Amazon EventBridge for scheduled events (if needed)
- Terraform for infrastructure as code

## AWS Configuration
- Region: us-east-1 (ONLY region allowed, enforced by SCP)
- Account ID: 468895763486
- AWS Profile: kiroman-terraform
- Terraform State: s3://kiroman-terraform-state
- Terraform Lock: kiroman-terraform-locks

## Organization Constraints (SCPs)

This account is part of the Lap 1 Labs AWS Organization (o-x2e8f9zdk4) with enforced SCPs:

1. Region Lock: All resources must be in us-east-1 (global services excepted)
2. Serverless Only: Only approved services allowed (Lambda, DynamoDB, S3, API Gateway, Cognito, Bedrock, SES, SQS, SNS, EventBridge, CloudFront, Route 53, etc.)
3. Blocked Services: EC2, RDS, ECS, EKS, SageMaker, Redshift, ElastiCache, Kafka, EMR, Neptune, DocumentDB, Kinesis, Firehose, Glue, Athena

Design serverless-first. If you think you need a blocked service, find a serverless alternative or request an org-level exception.

## Commands
- npm run dev        (Start dev server)
- npm run build      (Production build)
- npm run preview    (Preview production build)
- npm run lint       (Run ESLint)

## Deployment
- .\deploy.ps1       (Build and sync to S3)

## Terraform
- Set profile: $env:AWS_PROFILE="kiroman-terraform"
- Plan: C:\Terraform\terraform.exe plan
- Apply: C:\Terraform\terraform.exe apply
