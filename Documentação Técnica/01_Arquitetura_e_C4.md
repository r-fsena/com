# Arquitetura Técnica & Diagramas C4 — Vanguard CRM Imobiliário

Plataforma SaaS B2B Multiempresa de CRM Imobiliário integrada ao WhatsApp (Z-API) com IA Copiloto (Amazon Bedrock) e infraestrutura AWS Serverless.

---

## 1. Nível 1: Diagrama de Contexto de Sistema (System Context)

```mermaid
C4Context
    title Diagrama de Contexto de Sistema - Vanguard CRM Multi-tenant

    Person(corretor, "Corretor / Gestor", "Equipe comercial da imobiliária que opera leads e conversas.")
    Person(lead, "Lead / Comprador", "Cliente interessado em imóveis que conversa pelo WhatsApp.")
    Person(superadmin, "Superadmin", "Administrador geral da plataforma SaaS.")

    System(crm_system, "Vanguard CRM", "Plataforma multi-tenant de CRM imobiliário, inbox WhatsApp, Kanban e IA.")

    System_Ext(zapi, "Z-API Gateway", "API Oficial de mensageria WhatsApp.")
    System_Ext(cognito, "Amazon Cognito", "Autenticação, MFA e emissão de JWT com claims de tenant.")
    System_Ext(bedrock, "Amazon Bedrock", "LLM Claude 3.5 Sonnet para resumos e sugestão de respostas.")
    System_Ext(s3, "Amazon S3", "Armazenamento criptografado de propostas, fotos e contratos.")

    Rel(lead, zapi, "Envia e recebe mensagens")
    Rel(zapi, crm_system, "Dispara Webhooks HTTP", "HTTPS / JSON")
    Rel(crm_system, zapi, "Envia mensagens e mídias", "HTTPS / REST")
    Rel(corretor, crm_system, "Opera Inbox, Kanban e Perfil 360", "HTTPS / Next.js")
    Rel(superadmin, crm_system, "Gerencia planos e tenants", "HTTPS")
    Rel(crm_system, cognito, "Valida autenticação e roles", "OAuth2 / OIDC")
    Rel(crm_system, bedrock, "Solicita inferência semântica", "AWS SDK")
    Rel(crm_system, s3, "Armazena anexos com Presigned URLs", "HTTPS / KMS")
```

---

## 2. Nível 2: Diagrama de Contêineres AWS Serverless

```mermaid
flowchart TB
    subgraph Client ["Camada de Apresentação"]
        SPA["Frontend SPA / PWA<br/>(Next.js App Router, Tailwind CSS, Lucide)"]
    end

    subgraph Edge ["Borda AWS & Segurança"]
        CF["Amazon CloudFront CDN"]
        WAF["AWS WAF (Anti-DDoS / Rate Limit)"]
        APIGW["Amazon API Gateway HTTP API"]
    end

    subgraph Auth ["Identidade & Sessão"]
        COG["Amazon Cognito User Pool<br/>(Grupos: Admin, Manager, Broker, Viewer)"]
    end

    subgraph Compute ["Microsserviços / Lambdas"]
        WH_FN["Fast Webhook Ingest Handler<br/>(Valida token em &lt; 50ms)"]
        API_FN["Modular Core API Handler<br/>(Contatos, Negócios, Tarefas, Automações)"]
        MSG_WORKER["SQS Inbound Message Worker<br/>(Conciliação de Lead e Chat)"]
        OUT_WORKER["SQS Outbound Dispatch Worker<br/>(Rate Limit Z-API)"]
        AI_WORKER["Bedrock AI Worker<br/>(Extração Semântica & Copilot)"]
    end

    subgraph Queues ["Filas & Resiliência (Amazon SQS)"]
        SQS_IN["SQS Inbound Queue + DLQ"]
        SQS_OUT["SQS Outbound Queue + DLQ"]
        SQS_AI["SQS AI Processing Queue"]
    end

    subgraph Persistence ["Persistência & Segredos"]
        RDSPROXY["Amazon RDS Proxy"]
        DB[(Amazon Aurora PostgreSQL Serverless v2)]
        S3_BUCKET["Amazon S3 Bucket (Attachments)"]
        SECRETS["AWS Secrets Manager (Z-API Tokens)"]
    end

    SPA -->|HTTPS| CF
    CF --> WAF
    WAF --> APIGW
    SPA -->|Login / Refresh| COG
    APIGW -->|Webhook Callback| WH_FN
    APIGW --> API_FN

    WH_FN -->|Enfileira Evento Bruto| SQS_IN
    SQS_IN --> MSG_WORKER
    MSG_WORKER --> RDSPROXY
    MSG_WORKER --> SQS_AI

    SQS_AI --> AI_WORKER
    AI_WORKER --> RDSPROXY

    API_FN --> RDSPROXY
    API_FN --> SQS_OUT
    SQS_OUT --> OUT_WORKER
    OUT_WORKER --> SECRETS

    RDSPROXY --> DB
```

---

## 3. Nível 3: Diagrama de Componentes da Caixa de Entrada WhatsApp

```mermaid
flowchart LR
    subgraph InboxSystem ["Módulo de Inbox Z-API"]
        UI_CONV["Lista de Conversas<br/>(Filtros, Unread, SLAs)"]
        UI_CHAT["Janela de Mensagens<br/>(Texto, Áudio, Notas Amarelas)"]
        UI_LEAD["Drawer Perfil 360<br/>(Renda, Entrada, Funil, Tags)"]
        UI_COPILOT["Copilot Smart Box<br/>(Sugestão de Resposta com 1-Click)"]
    end

    subgraph Store ["CRM State Store (Multi-tenant Context)"]
        STATE["useCRM() Context"]
        DISPATCHER["Action Handlers (sendMessage, moveStage, saveAI)"]
    end

    subgraph BackendAdapters ["Adaptadores de Integração"]
        ZAPI_CLIENT["ZApiClient (src/lib/zapi-client.ts)"]
        BEDROCK_CLIENT["BedrockCopilotClient (src/lib/bedrock-client.ts)"]
        S3_CLIENT["S3StorageClient (src/lib/s3-client.ts)"]
    end

    UI_CONV --> STATE
    UI_CHAT --> DISPATCHER
    UI_COPILOT --> DISPATCHER
    UI_LEAD --> DISPATCHER
    DISPATCHER --> ZAPI_CLIENT
    DISPATCHER --> BEDROCK_CLIENT
    DISPATCHER --> S3_CLIENT
```
