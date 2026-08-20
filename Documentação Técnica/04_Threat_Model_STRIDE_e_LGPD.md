# Modelagem de Ameaças (STRIDE) & Matriz LGPD — Vanguard CRM

Avaliação de segurança da informação, privacidade de dados e conformidade legal.

---

## 1. Modelagem de Ameaças STRIDE

| Categoria | Ameaça Potencial | Mitigação Implementada |
| :--- | :--- | :--- |
| **Spoofing (Falsificação)** | Atacante forja chamadas de webhook fingindo ser a Z-API. | Validação obrigatória do cabeçalho `Client-Token` configurado no AWS Secrets Manager e IP allowlist. |
| **Tampering (Adulteração)** | Usuário de um tenant tenta alterar o `tenant_id` no payload HTTP. | O `tenant_id` é sempre derivado e validado contra os claims criptográficos do token JWT do Cognito. |
| **Repudiation (Repúdio)** | Corretor alega não ter enviado mensagem ou alterado proposta. | Registro imutável de trilha de auditoria (`audit_logs`) com IP, timestamp UTC e ID do autor. |
| **Information Disclosure (Vazamento)** | Leads de uma imobiliária vazam em listagens de outra. | Índices compostos por `tenant_id` + testes de isolamento automatizados no CI. CPFs criptografados. |
| **Denial of Service (DoS)** | Disparo em massa de webhooks derruba banco de dados. | Webhooks respondem rápido (&lt; 50ms) e enfileiram em SQS com taxa controlada de consumo no RDS Proxy. |
| **Elevation of Privilege** | Corretor tenta acessar relatórios financeiros de gestores. | Verificação de RBAC (Admin, Manager, Broker, Viewer) nas rotas de API e no cliente frontend. |

---

## 2. Matriz de Dados Pessoais & Privacidade (LGPD)

| Categoria de Dado | Exemplos | Finalidade | Base Legal (LGPD) | Tempo de Retenção |
| :--- | :--- | :--- | :--- | :--- |
| **Cadastrais Básicos** | Nome, Telefone WhatsApp, E-mail | Identificação e contato comercial | Execução de Contrato / Consentimento | 5 anos pós-negociação |
| **Financeiros & Qualificação** | Renda mensal, entrada, simulação | Qualificar perfil para compra de imóvel | Consentimento Específico | 2 anos ou até opt-out |
| **Comunicação & Mensagens** | Histórico de conversas WhatsApp | Registro das negociações | Execução de Contrato / Legítimo Interesse | 5 anos |
| **Metadados de Navegação** | IP, User Agent, Horários | Segurança e auditoria | Obrigação Legal (Marco Civil) | 6 meses |

### 2.1. Direitos do Titular (LGPD)
- **Direito de Opt-Out:** Quando o cliente solicitar interrupção de contato, o campo `has_opted_out` é marcado como `true`, bloqueando qualquer envio automático ou manual pela Z-API.
- **Direito de Anonimização:** Endpoint de expurgo que remove nome, telefone e CPF, mantendo apenas métricas anônimas de conversão para o histórico financeiro do tenant.
