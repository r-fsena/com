# Registro de Decisões de Arquitetura (ADRs) — Vanguard CRM

Documentação de decisões técnicas estratégicas tomadas no projeto.

---

## ADR-001: Estratégia de Isolamento Multi-tenant no Banco de Dados
- **Status:** Aprovado
- **Contexto:** Plataforma SaaS B2B imobiliária que atende dezenas de imobiliárias concorrentes. Vazamento de leads ou conversas entre empresas é inaceitável.
- **Decisão:** Adotar modelo de **Shared Database com Coluna Discriminadora `tenant_id` obrigatória e indexada em todas as tabelas**, complementada por validação estrita em código via helper `withTenant()` e claims verificadas do token JWT.
- **Consequências:**
  - *Positivas:* Menor custo operacional em relação a bancos separados por cliente; fácil execução de migrations globais com Drizzle ORM; escalabilidade horizontal eficiente.
  - *Mitigações:* Criação de suíte de testes automatizados (`tests/tenant-isolation.test.ts`) impedindo queries sem filtro de tenant.

---

## ADR-002: Desacoplamento da Ingestão de Webhooks Z-API com Amazon SQS
- **Status:** Aprovado
- **Contexto:** A Z-API dispara requisições HTTP para cada mensagem recebida, mudança de status de entrega ou leitura. O CRM precisa responder em milissegundos (&lt; 100ms) sob picos de tráfego sem derrubar conexões de banco.
- **Decisão:** A rota de Webhook (`/api/v1/webhooks/zapi/...`) apenas valida o token de segurança no cabeçalho, registra um evento e despacha o payload bruto para uma fila **Amazon SQS Inbound**. A resposta HTTP 200 OK é retornada imediatamente. Um worker Lambda processa a fila de forma assíncrona com Dead-Letter Queue (DLQ) para falhas após 3 tentativas.
- **Consequências:**
  - *Positivas:* Resiliência contra picos de tráfego, garantia de entrega (*at-least-once*) e zero timeout na Z-API.
  - *Mitigações:* Implementação de deduplicação por `idempotency_key` e `external_id` para evitar mensagens duplicadas.

---

## ADR-003: IA Copiloto no Modelo Human-in-the-Loop (Amazon Bedrock)
- **Status:** Aprovado
- **Contexto:** Utilização de Grandes Modelos de Linguagem (LLMs) para apoiar o atendimento de corretores de imóveis sem risco de alucinações comerciais (como prometer descontos ou inventar disponibilidades).
- **Decisão:** A IA atua estritamente como **Copiloto Consultivo**. Ela extrai dados comerciais (renda, entrada, intenção), resume o contexto e gera sugestões de resposta que exigem aprovação humana (botão "Inserir no Chat" / Editar) antes de serem transmitidas pelo WhatsApp.
- **Consequências:**
  - *Positivas:* Segurança jurídica total, conformidade LGPD e respeito ao processo consultivo do corretor humano.

---

## ADR-004: Upload de Anexos no S3 via Presigned URLs
- **Status:** Aprovado
- **Contexto:** Corretores enviam propostas pesadas (PDFs de 10MB+) e fotos de alta resolução. Fazer o tráfego passar diretamente pelos servidores de aplicação encarece o tráfego e consome memória dos Lambdas.
- **Decisão:** O frontend solicita uma URL pré-assinada (`/api/v1/uploads/presigned-url`) e faz o upload HTTP PUT direto para o bucket Amazon S3 com criptografia KMS.
- **Consequências:**
  - *Positivas:* Alta performance, menor latência para o usuário e menor consumo de computação serverless.
