# Vanguard CRM — CRM Imobiliário Multi-tenant Integrado ao WhatsApp (Z-API)

Plataforma SaaS B2B Multiempresa de CRM Imobiliário de Alto Padrão, integrada nativamente ao WhatsApp via **Z-API** com inteligência artificial copiloto (**Amazon Bedrock**), funis de conversão Kanban, perfil 360º de leads e isolamento rígido por tenant.

---

## 🚀 Tecnologias e Arquitetura

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide React, Framer Motion, Recharts, Canvas Confetti.
- **Backend / Cloud (AWS Serverless):**
  - **API Gateway & Lambda:** Ingestão de webhooks em tempo real e endpoints modulares.
  - **Filas & Resiliência:** Amazon SQS com DLQ e idempotência ponta a ponta.
  - **Banco de Dados:** Aurora PostgreSQL Serverless v2 / RDS PostgreSQL com RDS Proxy.
  - **Autenticação:** Amazon Cognito User Pools + RBAC Multi-tenant granular.
  - **Inteligência Artificial:** Amazon Bedrock (Claude 3.5 Sonnet) como copiloto com aprovação humana obrigatória no MVP.
  - **WhatsApp Gateway:** Adaptador Z-API desacoplado com rate limiting e gerenciamento seguro de instâncias.

---

## 🏢 Funcionalidades Principais

1. **Multi-tenancy Rígido**:
   - Isolamento de dados, configurações, instâncias Z-API e usuários por `tenant_id`.
   - Seletor de empresas no header com alternância instantânea.

2. **Caixa de Entrada Omnichannel (WhatsApp Z-API)**:
   - Layout operacional em 3 colunas (Filtros/Conversas, Chat Ativo, Perfil 360º).
   - Confirmações de entrega e leitura (Checkmarks duplos).
   - Notas internas da equipe invisíveis para o cliente.
   - Respostas rápidas e modelos personalizáveis.

3. **IA Copiloto de Atendimento (Human-in-the-Loop)**:
   - Resumo automático da conversa e intenção do lead.
   - Extração estruturada de dados comerciais (renda, entrada, orçamento máximo, região de interesse).
   - Sugestão de respostas contextuais com inserção em 1 clique e registro de feedback da equipe.

4. **Funil & Kanban Imobiliário**:
   - Etapas do ciclo de vida imobiliário (Novo Lead, Qualificação, Visita Agendada, Proposta, Fechamento).
   - Totalizadores de VGV (Valor Geral de Vendas) por etapa.
   - SLAs configuráveis com alertas de inatividade.
   - Celebração com confetti ao fechar contrato.

5. **Leads & Perfil 360º**:
   - Qualificação financeira imobiliária (renda individual/familiar, entrada, simulação de crédito).
   - Gestão de consentimento e conformidade LGPD (Opt-in / Opt-out).
   - Histórico completo de interações, tags e corretor responsável.

6. **Tarefas & Visitas**:
   - Controle de visitas presenciais a decorados, ligações e follow-ups.
   - Alertas visuais para prazos de SLA estourados.

7. **Campanhas & Disparos em Lote**:
   - Disparos segmentados com taxa controlada (*rate-limited*) para proteção do número.
   - Supressão automática de contatos em opt-out.
   - Métricas de entrega, leitura e resposta em tempo real.

8. **Dashboard Executivo**:
   - VGV ativo no funil, tempo médio de primeiro atendimento vs SLA, distribuição de leads por canal e produtividade por corretor.

---

## 💻 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ (recomendado 20.x LTS)
- npm ou yarn

### Instalação e Execução
```bash
# 1. Instalar dependências
npm install

# 2. Executar em modo de desenvolvimento
npm run dev

# A aplicação estará disponível em: http://localhost:3000
```

### Build de Produção
```bash
npm run build
npm start
```

---

## 🧪 Simulador Z-API Integrado
Para testar a ingestão de webhooks em tempo real sem precisar de uma instância real da Z-API no primeiro momento:
1. Clique no botão **"Simular Entrada Z-API"** no topo da página ou na barra lateral.
2. Escolha um dos cenários pré-configurados (Ex: *Médica Alta Renda Jardins*, *Investidor Studios Faria Lima*).
3. Clique em **"Simular Recebimento"**.
4. O sistema irá:
   - Criar ou atualizar o lead na base de dados.
   - Inserir a mensagem na Inbox em tempo real.
   - Executar o copiloto de IA com extração de dados e sugestão de resposta.
