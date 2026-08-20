# -------------------------------------------------------------
# INFRAESTRUTURA COMO CÓDIGO (TERRAFORM)
# CRM Imobiliário Multi-tenant AWS Serverless (Z-API & Bedrock)
# -------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "Vanguard-CRM"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "sa-east-1" # São Paulo
}

variable "environment" {
  type    = string
  default = "production"
}

# -------------------------------------------------------------
# 1. FILAS SQS & DEAD-LETTER QUEUES (RESILIÊNCIA Z-API)
# -------------------------------------------------------------
resource "aws_sqs_queue" "zapi_inbound_dlq" {
  name                      = "vanguard-crm-zapi-inbound-dlq"
  message_retention_seconds = 1209600 # 14 dias
}

resource "aws_sqs_queue" "zapi_inbound_queue" {
  name                      = "vanguard-crm-zapi-inbound-queue"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.zapi_inbound_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "zapi_outbound_dlq" {
  name                      = "vanguard-crm-zapi-outbound-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "zapi_outbound_queue" {
  name                      = "vanguard-crm-zapi-outbound-queue"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.zapi_outbound_dlq.arn
    maxReceiveCount     = 3
  })
}

# -------------------------------------------------------------
# 2. SECRETS MANAGER (CHAVES & TOKENS Z-API POR TENANT)
# -------------------------------------------------------------
resource "aws_secretsmanager_secret" "zapi_credentials" {
  name                    = "vanguard-crm/zapi-credentials"
  recovery_window_in_days = 0
}

# -------------------------------------------------------------
# 3. AURORA POSTGRESQL SERVERLESS V2 & RDS PROXY
# -------------------------------------------------------------
resource "aws_rds_cluster" "aurora_postgres" {
  cluster_identifier      = "vanguard-crm-aurora-cluster"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = "16.1"
  database_name           = "vanguard_crm"
  master_username         = "vanguard_admin"
  manage_master_user_password = true

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 8.0
  }

  skip_final_snapshot = true
}

resource "aws_rds_cluster_instance" "aurora_instance" {
  cluster_identifier = aws_rds_cluster.aurora_postgres.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora_postgres.engine
  engine_version     = aws_rds_cluster.aurora_postgres.engine_version
}

# -------------------------------------------------------------
# 4. API GATEWAY HTTP API
# -------------------------------------------------------------
resource "aws_apigatewayv2_api" "http_api" {
  name          = "vanguard-crm-http-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "Client-Token", "x-client-token"]
  }
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# -------------------------------------------------------------
# 5. IAM ROLES (LEAST-PRIVILEGE PARA BEDROCK & SQS)
# -------------------------------------------------------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "vanguard-crm-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "bedrock_and_sqs_policy" {
  name = "vanguard-crm-bedrock-sqs-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.zapi_inbound_queue.arn,
          aws_sqs_queue.zapi_outbound_queue.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.zapi_credentials.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.bedrock_and_sqs_policy.arn
}

output "api_gateway_url" {
  value = aws_apigatewayv2_stage.default_stage.invoke_url
}

output "sqs_inbound_queue_url" {
  value = aws_sqs_queue.zapi_inbound_queue.url
}
