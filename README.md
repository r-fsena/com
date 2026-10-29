# Brokiva CRM — operação e conexões

CRM imobiliário em Next.js 14, React, TypeScript e PostgreSQL. Há dois caminhos de entrada de mensagens:

- **Extensão Brokiva:** WhatsApp Web → worker da extensão → `/api/v1/sync/extension-history` → PostgreSQL. A ponte avisa somente as abas com a mesma origem e imobiliária. A extensão não substitui uma conexão Z-API para envio pelo CRM.
- **Z-API:** instância vinculada à imobiliária no banco → webhook autenticado por token próprio da instância → PostgreSQL → consulta de eventos pelo CRM.

## Executar e verificar

Use Node.js 20 ou superior. Configure `.env.local` a partir de `.env.example` e execute:

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm test` inclui testes de autenticação, isolamento, integrações com respostas controladas e transações concorrentes em PostgreSQL embarcado (PGlite). Não envia mensagens, cobra clientes nem chama serviços externos. Os testes antigos em `tests/*.test.ts` não integram essa suíte. Os cenários visuais legados ficam em `e2e/`.

## Implantação desta correção

1. Faça backup do banco e dos arquivos `data/crm-state.json` usados pela instalação anterior.
2. Configure `DATABASE_URL`, `SESSION_SECRET` aleatório de pelo menos 32 caracteres, `NEXT_PUBLIC_APP_URL` e `ZAPI_WEBHOOK_SECRET`. Não reutilize segredos que estavam no código da versão anterior. Não há senha mestre nem autenticação por nome ou cabeçalhos.
3. Antes de publicar o backend, execute `npm run db:migrate:state`. Isso aplica `database/03_durable_crm_state.sql` e copia contatos, conversas, mensagens e oportunidades das tabelas existentes para o estado operacional de cada imobiliária. Para incluir um arquivo legado, execute `npm run db:migrate:state -- /caminho/crm-state.json`. Registros sem `tenantId` não são transferidos automaticamente. Snapshots existentes são preservados.
4. Publique o backend e confira o login com uma conta cujo hash/salt e vínculo ativo estejam cadastrados no PostgreSQL. Esta migração não cadastra usuários nem redefine senhas. Identificadores Cognito enviados pelo cliente não são aceitos como autenticação.
5. Cadastre ou confira as conexões em `/api/v1/zapi/instances` com uma sessão ADMIN ou SUPERADMIN. Os tokens ficam no servidor; leituras retornam apenas dados públicos da conexão. Use a ação de configurar webhooks depois da publicação: ela registra uma URL HTTPS com token por instância. As URLs antigas sem token deixam de ser aceitas.
6. Atualize a extensão para **1.0.52**, faça login novamente no CRM e clique em **Entrar e parear no CRM** no popup. As sessões antigas são invalidadas. Trocar de imobiliária requer novo pareamento explícito. A sessão da extensão dura até 15 minutos e é renovada pela aba autenticada do CRM.

Publique o backend antes de distribuir a nova extensão. A correção de código não executa migrações nem altera credenciais de produção automaticamente.

## Fonte de dados e sincronização

`crm_tenant_state` é a fonte operacional de contatos, conversas, mensagens, oportunidades e respostas rápidas. Cada imobiliária tem sua própria linha; as alterações usam transação e bloqueio de linha. Falhas no banco impedem confirmação de sucesso. O banco é obrigatório em produção. O armazenamento JSON anterior serve somente ao desenvolvimento local e à importação explícita de dados legados.

`crm_sync_jobs` guarda progresso e bloqueios dos trabalhos de importação. O CRM avança uma página por requisição autenticada; cada página é gravada antes da próxima. A execução não depende de tarefas soltas após a resposta HTTP. Ao reabrir o CRM, o trabalho ativo é recuperado. Uma execução interrompida pode ser retomada depois do vencimento do bloqueio de dois minutos. A importação exige uma aba aberta para continuar avançando; não é uma fila SQS autônoma.

Os artefatos legados de infraestrutura e documentação descrevem também recursos planejados. Eles não substituem o fluxo efetivamente implementado acima.

## WhatsApp com o CRM fechado e recuperação do histórico

| Situação | Comportamento esperado |
| --- | --- |
| CRM e navegador fechados, Z-API ativa e conectada | O provedor entrega recebidas e enviadas pelo corretor diretamente ao webhook. O servidor confirma somente depois de gravar no PostgreSQL. |
| CRM em segundo plano ou sem internet | A consulta da tela pausa; o servidor continua recebendo se a Z-API estiver operacional. Ao voltar à aba ou à rede, a tela consulta o estado persistido. |
| Somente extensão Brokiva | A importação exige WhatsApp Web aberto, sessão válida e acionamento da sincronização. Não captura com o navegador fechado. A renovação da sessão depende da aba autenticada do CRM. |
| Provedor desconectado ou assinatura inativa | Não há garantia de entrega ao CRM. Reabrir a tela não recupera mensagens que nunca chegaram ao servidor. |

O cursor acompanha o recebimento/alteração no servidor, não a data original da mensagem no WhatsApp. Ele pertence ao mesmo snapshot retornado pela consulta; um commit posterior fica para a próxima consulta. Falhas não avançam o cursor. Ao abrir ou retomar a tela, o snapshot completo é reconciliado, sem janela fixa de três minutos e sem reconstruir IDs ou remetentes no navegador. Mensagens distintas com o mesmo texto continuam distintas.

Reentregas com o mesmo ID são idempotentes; atualizações de não lidas e resumos usam a mesma transação da mensagem. Mensagens atrasadas entram no histórico sem regredir o resumo mais recente. Os status avançam de enviado para entregue/lido, mesmo com callbacks concorrentes.

Na configuração do provedor, confira **também** `update-webhook-received-delivery` e `notifySentByMe: true`. A [URL de recebidas e enviadas pelo próprio número](https://developer.z-api.io/webhooks/on-message-received-and-delivery) tem prioridade sobre a URL comum de recebimento. O histórico anterior disponível depende do WhatsApp Web e dos recursos do provedor; não há garantia de recuperar toda lacuna antiga. As mídias recebidas continuam apontando para o provedor, que informa [expiração em 30 dias](https://developer.z-api.io/webhooks/on-message-received); ainda não há arquivamento automático desses arquivos no S3.

### Revisão operacional de 29/10/2026

- **Ambiente Teste Rafael Sena:** Z-API `CANCELED`, status recusado por necessidade de assinatura; URLs ainda diferentes das esperadas. Mantida a decisão de operar com a extensão, sem renovar a assinatura.
- **Amábile Barbarotti:** instância desconectada; URLs, inclusive recebidas/enviadas, corretas e notificação de enviadas habilitada. O provedor informa `PAYMENT_RETRY`.
- A revisão posterior da importação inclui a extensão 1.0.52 e o protocolo de recibos 2 descrito abaixo; confira a versão publicada antes de distribuir a extensão.

`npm test` cobre recebidas e enviadas sem navegador, reinício da execução HTTP, mensagens antigas recebidas depois, concorrência, reentrega, falha de banco, avanço do cursor e isolamento entre imobiliárias. São eventos sintéticos em banco de teste. A validação real com o navegador fechado depende de uma instância operacional: enviar e receber pelo celular, reabrir o CRM e conferir ambas as mensagens sem usar a importação da extensão.

## Importação verificada pela extensão (1.0.52)

O coletor percorre a lista aberta e o histórico com sobreposição entre páginas, confere a identidade da conversa durante a leitura e informa limites/pendências. Não usa somente o nome para identificar conversas, não inventa telefones e não transforma a prévia da lista em mensagem. Somente mensagens com ID e data verificáveis são enviadas. O cache do WhatsApp complementa a leitura, sem comprovar cobertura integral. Na tela do CRM, contatos e conversas mantêm os IDs do servidor; textos iguais não são fundidos, prévias não viram balões e o cache legado do navegador não é republicado automaticamente sobre o snapshot confirmado. Quando o servidor está indisponível, a leitura local continua servindo como fallback.

Os lotes são persistidos antes da transmissão na fila da extensão, limitados a 150 mensagens/384 KiB e 6 MiB no total da fila. A API exige autenticação e grava cada lote em uma transação com os webhooks. Preserva texto, status de leitura, vínculo da instância, não lidas e o resumo mais recente. Reenvios reconciliam IDs do WhatsApp em vez de duplicar a mensagem. O recibo contém `protocol: 2`, `batchId`, `tenantId` e os IDs efetivamente processados; só é emitido após o commit. Estruturas inválidas rejeitam o lote inteiro.

**Ordem de publicação:** backend primeiro; confira `X-Brokiva-Import-Protocol: 2` em `OPTIONS /api/v1/sync/extension-history`. Depois distribua/recarregue a extensão 1.0.52 e recarregue o WhatsApp Web. O popup mostra envios pendentes e o relatório da última importação; o botão **Retomar envios** reenvia os lotes preservados. Se um backend antigo responder HTTP 200 sem recibo completo, a extensão retém o lote e informa a incompatibilidade.

A fila retoma envios após falha/reinício, dentro da mesma conta e com sessão válida. A leitura interrompida precisa ser reiniciada. Arquivadas, filtros, datas não disponibilizadas e arquivos de mídia ausentes ficam explícitos como pendência, sem declaração de importação integral. Instruções completas em `../brokiva-chrome-extension/README.md`.

## Integrações externas

- **Asaas:** chamadas reais para cliente, cobrança e QR Code. O ambiente padrão é `sandbox`; a produção exige `ASAAS_ENVIRONMENT=production`. A chave vem do tenant no banco, sem reutilizar a chave master como fallback para outra empresa. A requisição exige `externalReference`, reutilizada nas tentativas de recuperação; em caso de timeout, consulte a referência antes de repetir. Não há resposta de cobrança simulada.
- **S3:** configure `AWS_S3_BUCKET_NAME`, `AWS_S3_REGION` e a função IAM/credenciais do servidor. As URLs são assinadas pelo SDK, limitadas ao tenant e expiram em 15 minutos. Configure o CORS do bucket para a origem do CRM, métodos PUT/GET e Content-Type. A requisição exige tamanho e tipo do arquivo. A política de criptografia e acesso deve ser configurada no bucket.
- **IA:** Gemini e OpenAI usam as chaves do servidor ou a configuração permitida do provedor. Bedrock usa `AWS_BEDROCK_MODEL_ID`, `AWS_BEDROCK_REGION` e permissões IAM para Converse. O teste de conexão faz uma chamada real. Sem provedor disponível, a análise heurística local não é apresentada pelo teste como conexão com IA externa.

Referências de implementação: [Asaas Pix](https://docs.asaas.com/docs/cobrancas-via-pix), [AWS S3 SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html), [Bedrock Converse](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/ConverseCommand/).

## Extensão oficial e distribuição

A fonte oficial está em `../brokiva-chrome-extension`, repositório `r-fsena/brokiva-chrome-extension`, branch `main`. Valide lá com `npm test` e `npm run check`, depois faça o commit e push conforme o AGENTS.md.

Para atualizar o ZIP, o espelho histórico e os metadados de versão no CRM:

```sh
python3 scripts/package-extension.py
```

A API de download usa uma única versão declarada em `public/downloads/brokiva-extension-release.json` e verifica o SHA-256 do pacote. Ela não distribui versões anteriores como fallback.
