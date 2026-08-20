# Runbooks Operacionais & Procedimentos de Suporte — Vanguard CRM

Guias práticos para operação contínua, resposta a incidentes e manutenção do sistema.

---

## 📘 Runbook 1: Instância Z-API Desconectada ou Falha de Conexão WhatsApp

### 1.1. Sintomas & Alarmes
- Indicador Z-API na barra lateral muda para `DISCONNECTED` ou `OFFLINE`.
- Alarme CloudWatch `ZApiInstanceDisconnectedAlarm` dispara notificação.

### 1.2. Procedimento de Recuperação
1. Acesse o menu **Configurações & Z-API** na plataforma.
2. Na aba **Instâncias Z-API**, localize a instância afetada e clique em **"Testar Conexão"**.
3. Se a instância exigir nova leitura de sessão:
   - Clique em **"Gerar QR Code"**.
   - No celular corporativo com o WhatsApp Business da imobiliária, abra **Aparelhos Conectados** e escaneie o código.
4. Verifique se o status retornou para `CONNECTED` e se mensagens na fila SQS Outbound começaram a ser despachadas.

---

## 📘 Runbook 2: Reprocessamento de Mensagens na Dead-Letter Queue (DLQ)

### 2.1. Sintomas
- Alarme `SQSInboundDLQMessagesVisible > 0` disparado no CloudWatch.
- Indica que 1 ou mais mensagens falharam após 3 tentativas de processamento pelo worker.

### 2.2. Procedimento de Diagnóstico e Reprocessamento
1. Acesse o console AWS SQS e inspecione as mensagens na fila `vanguard-crm-zapi-inbound-dlq`.
2. Analise o payload JSON e a mensagem de erro associada no CloudWatch Logs (`/aws/lambda/vanguard-crm-msg-worker`).
3. Se o erro foi causado por indisponibilidade transitória do banco ou rate-limit da Z-API:
   - Execute o comando de redrive da DLQ via AWS CLI:
   ```bash
   aws sqs start-message-move-task \
     --source-arn arn:aws:sqs:sa-east-1:123456789012:vanguard-crm-zapi-inbound-dlq \
     --destination-arn arn:aws:sqs:sa-east-1:123456789012:vanguard-crm-zapi-inbound-queue
   ```
4. Acompanhe o esvaziamento da fila e verifique se as mensagens foram integradas no chat correspondente.

---

## 📘 Runbook 3: Onboarding de Nova Imobiliária (Tenant)

1. **Criação do Tenant:** Acesse a tela de Onboarding ou execute o endpoint administrativo `POST /api/v1/admin/tenants`.
2. **Configuração da Z-API:**
   - Adicione a instância com `instanceId` e `token` fornecidos pela Z-API.
   - Copie a URL de webhook gerada e configure no painel oficial da Z-API na seção **Webhooks -> Ao Receber Mensagem**.
3. **Cadastro da Equipe:** Convide os corretores e gestores com seus respectivos e-mails para criação de credenciais no Cognito.
4. **Validação:** Envie uma mensagem de teste no WhatsApp e confirme a entrada no Kanban e Inbox.
