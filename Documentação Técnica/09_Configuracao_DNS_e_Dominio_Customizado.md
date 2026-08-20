# Configuração de Domínio & DNS — crm.faithhubs.com

Guia para apontamento do subdomínio `crm.faithhubs.com` para a infraestrutura de produção na AWS / Vercel / CloudFront.

---

## 🌐 1. Configuração do Registro DNS (Painel do Domínio `faithhubs.com`)

No provedor onde o domínio `faithhubs.com` está registrado (ex: Cloudflare, Registro.br, GoDaddy, Route 53):

| Tipo de Registro | Nome / Host | Destino / Valor | TTL | Proxy / SSL |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `crm` | *(URL do CloudFront, Vercel ou API Gateway gerada no deploy)* | Automático / 300s | Ativo (Full Strict) |

### Exemplo de Apontamento:
- **Host:** `crm.faithhubs.com`
- **Tipo:** `CNAME`
- **Valor:** `d123456abcdef8.cloudfront.net` (ou `cname.vercel-dns.com`)

---

## 🔒 2. Certificado SSL / HTTPS (AWS Certificate Manager - ACM)

Para emitir o certificado gratuito e com renovação automática na AWS:

1. Acesse o **AWS Certificate Manager (ACM)** na região `us-east-1` (N. Virginia para CloudFront) ou `sa-east-1` (São Paulo).
2. Solicite um certificado público para:
   - `crm.faithhubs.com`
   - `*.faithhubs.com` (opcional)
3. Escolha **Validação por DNS**.
4. Copie o registro `CNAME` de validação gerado pelo ACM e adicione na zona de DNS do `faithhubs.com`.
5. Em poucos minutos o status mudará para **Emitido (Issued)**.

---

## 🚀 3. Endpoints Oficiais de Produção

Após o apontamento, todos os serviços e webhooks estarão operacionais sob a URL oficial:

- **Plataforma Web (CRM):** `https://crm.faithhubs.com`
- **Webhook Z-API WhatsApp:** `https://crm.faithhubs.com/api/v1/webhooks/zapi/{tenantId}/{instanceId}`
- **API de Contatos:** `https://crm.faithhubs.com/api/v1/contacts`
- **API de Mensagens:** `https://crm.faithhubs.com/api/v1/conversations/{id}/messages`
- **Upload Seguro S3:** `https://crm.faithhubs.com/api/v1/uploads/presigned-url`
- **IA Copiloto Bedrock:** `https://crm.faithhubs.com/api/v1/ai/copilot`
