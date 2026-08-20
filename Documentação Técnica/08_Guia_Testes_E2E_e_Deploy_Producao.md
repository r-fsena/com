# Guia de Testes E2E & Deploy de Produção — Vanguard CRM

Instruções completas para execução da suíte de testes de ponta a ponta (E2E) com Playwright e procedimentos de deploy em produção na AWS.

---

## 🧪 1. Execução dos Testes E2E (Playwright)

A suíte de testes E2E valida todos os fluxos críticos de negócio:
1. **Inbox WhatsApp & IA Copiloto (`e2e/inbox-and-ai.spec.ts`):** Ingestão de webhooks Z-API, envio de mensagens, notas internas privadas e sugestão inteligente de resposta.
2. **Funil & Negócios (`e2e/kanban-and-deals.spec.ts`):** Movimentação de cards no Kanban, cálculo de VGV e celebração de contrato ganho.
3. **Automações & Exportação (`e2e/automations-and-campaigns.spec.ts`):** Ativação de regras de automação, inspeção de logs de auditoria e exportação de leads em CSV.

### 1.1. Executando os Testes no Terminal
```bash
# Executa todos os testes E2E em modo headless
npm run test:e2e
```

### 1.2. Executando os Testes com Interface Gráfica Interativa
```bash
# Abre a UI visual do Playwright para depuração passo a passo
npx playwright test --ui
```

---

## 🐳 2. Build e Execução via Docker (Container de Produção)

A aplicação conta com um `Dockerfile` multi-stage otimizado com *standalone output* do Next.js.

### 2.1. Criando a Imagem Docker
```bash
# Build da imagem de produção
docker build -t vanguard-crm:latest .
```

### 2.2. Executando o Container Localmente
```bash
# Execução na porta 3000
docker run -p 3000:3000 --env-file .env vanguard-crm:latest
```

---

## ☁️ 3. Deploy Automatizado na AWS (Terraform + Drizzle)

Criamos um script que automatiza 100% das etapas de deploy:

```bash
# Executa o script de deploy automatizado
./infra/scripts/deploy-aws.sh
```

### O que o script realiza:
1. Valida ferramentas locais (`aws`, `terraform`, `node`).
2. Executa o build de produção (`npm run build`).
3. Gera e aplica as migrations de banco no PostgreSQL (`npx drizzle-kit generate`).
4. Provisiona no Terraform:
   - **Aurora PostgreSQL Serverless v2**
   - **Filas Amazon SQS (Inbound & Outbound com DLQ)**
   - **AWS Secrets Manager** para credenciais Z-API
   - **Amazon S3** para upload seguro de mídias
   - **Amazon API Gateway HTTP API**
   - **IAM Roles** com privilégios mínimos para Amazon Bedrock.

---

## ✅ 4. Checklist Pré-Lançamento (Piloto)
- [x] Testes de isolamento multi-tenant aprovados.
- [x] Suíte E2E Playwright configurada.
- [x] Dockerfile standalone testado.
- [x] Script de deploy na AWS operacional.
- [x] Documentação técnica completa na pasta `Documentação Técnica/`.
