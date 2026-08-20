# Guia de Deploy AWS & Configuração de Variáveis — Vanguard CRM

Instruções passo a passo para deploy da infraestrutura na AWS e configuração das integrações de produção.

---

## 1. Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz do projeto com base no modelo abaixo:

```bash
# -------------------------------------------------------------
# BANCO DE DADOS (PostgreSQL / Aurora Serverless v2)
# -------------------------------------------------------------
DATABASE_URL="postgresql://vanguard_admin:SENHA_AQUI@vanguard-crm-aurora-cluster.cluster-sa-east-1.rds.amazonaws.com:5432/vanguard_crm?sslmode=require"

# -------------------------------------------------------------
# AUTENTICAÇÃO (Amazon Cognito)
# -------------------------------------------------------------
NEXT_PUBLIC_COGNITO_USER_POOL_ID="sa-east-1_xxxxxxxxx"
NEXT_PUBLIC_COGNITO_CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_COGNITO_REGION="sa-east-1"

# -------------------------------------------------------------
# Z-API GATEWAY (WhatsApp Oficial)
# -------------------------------------------------------------
ZAPI_BASE_URL="https://api.z-api.io/instances"
ZAPI_WEBHOOK_SECRET="seu-token-secreto-definido-aqui"

# -------------------------------------------------------------
# AMAZON BEDROCK (Inteligência Artificial)
# -------------------------------------------------------------
AWS_BEDROCK_REGION="us-east-1"
AWS_BEDROCK_MODEL_ID="anthropic.claude-3-5-sonnet-20241022-v2:0"

# -------------------------------------------------------------
# AMAZON S3 (Anexos e Documentos)
# -------------------------------------------------------------
AWS_S3_BUCKET_NAME="vanguard-crm-attachments"
AWS_S3_REGION="sa-east-1"
```

---

## 2. Passo a Passo para Deploy da Infraestrutura via Terraform

### 2.1. Pré-requisitos
- Conta ativa na AWS com permissões de Administrador.
- AWS CLI instalado e configurado (`aws configure`).
- Terraform 1.5+ instalado (`terraform version`).

### 2.2. Executando o Provisionamento
```bash
# 1. Acesse o diretório de infraestrutura
cd infra/terraform

# 2. Inicialize os providers do Terraform
terraform init

# 3. Valide o plano de execução
terraform plan

# 4. Aplique a criação de todos os recursos serverless na AWS
terraform apply -auto-approve
```

Após a conclusão, o Terraform exibirá a **URL do API Gateway** e os **ARNs das filas SQS**.

---

## 3. Configurando a Z-API para Produção

1. Acesse o painel da [Z-API](https://z-api.io) e abra a sua instância WhatsApp ativa.
2. Na aba **Webhooks**, selecione a opção **Ao Receber Mensagem (on-message-received)**.
3. Cole a URL de Webhook fornecida pelo API Gateway:
   ```
   https://crm.faithhubs.com/api/v1/webhooks/zapi/{tenantId}/{instanceId}
   ```
4. No campo **Client-Token (Segurança)**, insira o mesmo token configurado em `ZAPI_WEBHOOK_SECRET`.
5. Envie uma mensagem de teste no WhatsApp e valide a criação automática do lead no CRM.
