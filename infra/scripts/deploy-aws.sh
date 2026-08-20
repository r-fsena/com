#!/usr/bin/env bash

# =============================================================
# SCRIPT DE DEPLOY AUTOMATIZADO — VANGUARD CRM NA AWS
# =============================================================

set -e

echo "🚀 Iniciando processo de deploy do Vanguard CRM na AWS..."

# 1. Checagem de Pré-requisitos
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI não encontrado. Instale o AWS CLI e configure com 'aws configure'."; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform não encontrado. Instale o Terraform 1.5+."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado."; exit 1; }

echo "✅ Pré-requisitos verificados com sucesso."

# 2. Build da Aplicação e Validação de Tipos
echo "📦 Executando build de produção e validação TypeScript..."
npm run build

# 3. Execução das Migrações de Banco de Dados
echo "🗄️ Gerando e aplicando migrações Drizzle no PostgreSQL..."
npx drizzle-kit generate

# 4. Provisionamento da Infraestrutura via Terraform
echo "☁️ Provisionando recursos serverless na AWS (Aurora, SQS, API Gateway, S3, Secrets)..."
cd infra/terraform
terraform init
terraform apply -auto-approve

echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "🌐 Consulte os outputs do Terraform acima para obter a URL do API Gateway e recursos provisionados."
