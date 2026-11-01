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
6. Atualize a extensão para **1.0.60**, faça login novamente no CRM e clique em **Entrar e parear no CRM** no popup. As sessões antigas são invalidadas. Trocar de imobiliária requer novo pareamento explícito. A sessão da extensão dura até 15 minutos e é renovada pela aba autenticada do CRM.

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
- A revisão posterior da importação inclui a extensão 1.0.60 e o protocolo de recibos 2 descrito abaixo; confira a versão publicada antes de distribuir a extensão.

`npm test` cobre recebidas e enviadas sem navegador, reinício da execução HTTP, mensagens antigas recebidas depois, concorrência, reentrega, falha de banco, avanço do cursor e isolamento entre imobiliárias. São eventos sintéticos em banco de teste. A validação real com o navegador fechado depende de uma instância operacional: enviar e receber pelo celular, reabrir o CRM e conferir ambas as mensagens sem usar a importação da extensão.

## Importação verificada pela extensão (1.0.60)

O coletor percorre a lista aberta e o histórico com sobreposição entre páginas, confere a identidade da conversa durante a leitura e informa limites/pendências. Não usa somente o nome para identificar conversas, não inventa telefones e não transforma a prévia da lista em mensagem. Somente mensagens com ID e data verificáveis são enviadas. O cache do WhatsApp complementa a leitura, sem comprovar cobertura integral. Quando a rolagem não confirma o início, a extensão busca páginas anteriores pelo mecanismo nativo e pode pedir dados ao dispositivo vinculado uma vez, somente se o próprio WhatsApp disponibilizar essa operação. Mantém checkpoints por página, limite de consultas, orçamento de tempo e isolamento do chat. Resposta vazia, timeout, recusa ou pedido sem entrega continuam parciais; não significam que o histórico no celular acabou. A ponte usa as instâncias atuais de `WAWebCollections`, aceita os formatos de WID atuais e verifica o mapeamento local entre LID e telefone. Pendências de autoria/conteúdo são retiradas apenas para os IDs recuperados; datas estimadas não se tornam verificadas por mera releitura. Limites de cobertura continuam no relatório mesmo quando também há pendências de mensagens. O relatório quantifica as categorias e informa por que itens do cache não foram interpretados, incluindo mensagens ainda cifradas. As categorias podem se sobrepor e não devem ser somadas. Miniaturas HTTPS não são arquivos originais; o popup limpa o relatório anterior ao trocar de conta sem relatório próprio. Na tela do CRM, contatos e conversas mantêm os IDs do servidor; textos iguais não são fundidos, prévias não viram balões e o cache legado do navegador não é republicado automaticamente sobre o snapshot confirmado. Quando o servidor está indisponível, a leitura local continua servindo como fallback.

A revisão de backend `20261029.3` aceita registros `CALL` e `CONTACT_CARD` com os mesmos recibos e isolamento. Cartões vazios são rejeitados, e o vCard completo é preservado em uma seção expansível no histórico. A extensão 1.0.60 reconhece `call_log`, `vcard` e `multi_vcard`, sem presumir resultado ou gravação de chamadas. A revisão `20261029.3` foi conferida em produção antes da distribuição desta versão.

Os lotes são persistidos antes da transmissão na fila da extensão, limitados a 150 mensagens/384 KiB e 6 MiB no total da fila. A API exige autenticação e grava cada lote em uma transação com os webhooks. Preserva texto, status de leitura, vínculo da instância, não lidas e o resumo mais recente. Reenvios reconciliam IDs do WhatsApp em vez de duplicar a mensagem. O recibo contém `protocol: 2`, `batchId`, `tenantId` e os IDs efetivamente processados; só é emitido após o commit. Estruturas inválidas rejeitam o lote inteiro.

**Ordem de publicação:** backend primeiro; confira `X-Brokiva-Import-Protocol: 2` em `OPTIONS /api/v1/sync/extension-history`. Depois distribua/recarregue a extensão 1.0.60 e recarregue o WhatsApp Web e as abas do CRM já abertas. A ponte encerra o contexto invalidado com aviso de recarga, mantém identidade/fila na atualização e renova o token expirado somente na mesma conta/imobiliária. O parâmetro `pairExtension=1` permanece até o worker confirmar o pareamento. O popup mostra envios pendentes e o relatório da última importação; o botão **Retomar envios** reenvia os lotes preservados. Se um backend antigo responder HTTP 200 sem recibo completo, a extensão retém o lote e informa a incompatibilidade.

A fila retoma envios após falha/reinício, dentro da mesma conta e com sessão válida. A leitura interrompida precisa ser reiniciada. Arquivadas, filtros, datas não disponibilizadas e arquivos de mídia ausentes ficam explícitos como pendência, sem declaração de importação integral. Instruções completas em `../brokiva-chrome-extension/README.md`.

## Catálogo do Portal Master

O Portal Master consulta `GET /api/v1/master/tenants` após autenticar o administrador global. A lista vem de `tenants` no PostgreSQL, inclui todos os status e usa `tenant-<slug>`, igual ao contexto autenticado e aos snapshots do CRM. O endpoint rejeita usuários comuns e sessões limitadas da extensão; não retorna chaves Asaas, configurações de IA ou tokens.

O catálogo substitui a lista de identidades armazenada no navegador. A reconciliação usa o slug para preservar preferências locais da mesma imobiliária, sem confundir o ID legado de Teste Rafael com Vanguard. O botão **Atualizar lista** repete a consulta; falhas são exibidas em vez de um falso catálogo vazio. A seleção existente é reconciliada pelo cadastro, sem migrar ou fundir contatos/conversas.

As informações contratuais e os fluxos legados de criação/edição administrativa ainda usam armazenamento local. Esta etapa corrige a consulta do catálogo e o acesso aos ambientes já cadastrados no banco. Valores e capacidades não informados aparecem como tais, e indicadores financeiros ficam parciais quando há cadastros sem contrato local.

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

## Automações e regras comerciais

A tela **Automações & Regras** consulta `/api/v1/automations`; não carrega regras ou execuções de demonstração. Administradores e gestores podem criar, editar, duplicar, testar, publicar, pausar e arquivar. Corretores e leitores apenas acompanham. A flag `automations` do ambiente controla a exibição no menu; a API aplica as permissões independentemente do menu.

O assistente tem cinco passos: objetivo, critérios, ações, horários e conferência. Os modelos iniciais são sugestões editáveis e começam como rascunho. O teste salva o rascunho e executa a avaliação em uma cópia isolada dos dados, sem envio, tarefas reais ou alteração de contatos. Para publicar, é necessário testar a revisão atual. Editar uma regra ativa preserva a versão publicada até nova ativação. Texto copiado de um modelo fica congelado na regra; alterações posteriores no modelo não mudam envios já configurados. Este fluxo suporta texto; anexos não são enviados pelas automações.

Regras, versões publicadas, rascunhos, trilha de alterações e ações pendentes ficam no campo `automation` da linha de cada imobiliária em `crm_tenant_state`. Tarefas ficam em `tasks` e processos em `commercial`, na mesma linha. Não há tabela adicional a migrar quando `database/03_durable_crm_state.sql` já está aplicada. Mudanças de regra e execuções internas usam transação/bloqueio de linha. A revisão enviada pelo cliente impede sobrescrever edições concorrentes. O histórico registra as configurações de cada gravação/publicação.

As ações implementadas são: criar tarefa com prazo e responsável, preparar mensagem na agenda para revisão, adicionar etiqueta, distribuir contatos entre responsáveis ativos selecionados e enviar texto por uma conexão Z-API operacional. A preparação não envia WhatsApp: abra a tarefa, confira o texto e copie para o atendimento. Os modelos e tarefas agora usam APIs próprias e só confirmam gravação depois do banco. Configurações comerciais preservam os dados locais da própria imobiliária na primeira gravação explícita e passam a ser recuperadas do servidor; dados locais não são republicados automaticamente.

Eventos de cadastro manual e mudança de etapa são registrados na mesma transação dos dados. Recebimentos novos por webhook autenticado também podem acionar regras sem navegador. Reentregas são deduplicadas por regra, versão, evento e ação. Importação da extensão, importação em lote, reconciliação de snapshots, mensagens enviadas pelo próprio número e mensagens de webhook com data superior a cinco minutos no passado não disparam regras. Isso prioriza evitar abordagens comerciais retroativas; eventos atrasados continuam no histórico, mas não recebem disparo automático.

Contatos pessoais e pedidos de interrupção são excluídos. Mensagens exigem autorização registrada. Antes de executar, conferem-se novamente o contato, a versão ativa, o horário, os critérios e novas interações. Uma resposta ou atendimento posterior cancela a mensagem pendente. Publicar uma nova versão, pausar ou arquivar cancela ações ainda não iniciadas. Um envio já despachado pode concluir. Ativar não percorre a lista antiga de contatos. Inatividade acompanha apenas contatos que tiveram um acontecimento novo após a ativação da versão; cada período de inatividade executa uma vez.

### Processamento agendado

Tarefas, etiquetas, distribuição e preparação sem restrição de horário executam no próprio evento, sem cron. Inatividade, espera por horário comercial e envios externos exigem o processador periódico:

1. Configure no servidor `AUTOMATIONS_CRON_SECRET` com um segredo exclusivo de pelo menos 32 caracteres. Não reutilize `SESSION_SECRET`.
2. Agende um **POST HTTPS** em `/api/internal/automations/run`, com `Authorization: Bearer <segredo>`, a cada um a cinco minutos. Não exponha o segredo no navegador nem em parâmetros de URL. O workflow `.github/workflows/automations-worker.yml` é uma opção: configure a variável de repositório `CRM_AUTOMATIONS_URL` com a origem do CRM e o segredo `CRM_AUTOMATIONS_CRON_SECRET` com o mesmo valor do servidor. Sem a variável, o job não executa. Agendamentos do GitHub podem atrasar; para prazos operacionais estritos, use um agendador dedicado.
3. Execute uma vez e confira **Histórico real**. A tela só libera publicação de regras agendadas quando há confirmação do processador nos últimos dez minutos.
4. Para liberar envios automáticos, valide uma conexão Z-API real e configure `AUTOMATIONS_OUTBOUND_ENABLED=true`. O padrão é `false`; preparação para revisão continua disponível. A extensão sozinha não é um canal de envio do servidor. Esta implementação não renova assinaturas nem envia mensagens de teste automaticamente.

O processador tem orçamento de tempo e percorre primeiro os ambientes há mais tempo sem verificação. A cadência depende da frequência e capacidade desse agendador. Pendências expiram após 24 horas. Uma conexão indisponível mantém a ação aguardando para nova verificação. Antes do envio, a ação é marcada como iniciada; após confirmação, registra-se **aceito pelo provedor** e uma mensagem `SENT`. Entrega/leitura são atualizadas pelos callbacks. Timeout após início, interrupção da execução ou confirmação ausente produzem **precisa de conferência**, sem reenvio automático, evitando duplicação. Confira no WhatsApp antes de qualquer reenvio manual.

Funis/etapas em uso por oportunidades ou automações não podem ser removidos; motivos de perda utilizados devem ser desativados. Alterar o horário geral não muda o horário de regras publicadas: edite, teste e publique cada regra afetada. Configurações legadas de distribuição não substituem uma regra publicada de distribuição; o executor utiliza os responsáveis ativos selecionados na regra.

Validação: `npm test` inclui testes de regras, edição concorrente, persistência após reinício, simulação sem efeitos, isolamento, eventos reais, bloqueio de importações históricas, duplicação, pausa, inatividade, indisponibilidade do canal, timeout incerto e referências comerciais em uso. Todos usam dados fictícios e provedores controlados, sem envio real.

## Campanhas de WhatsApp

O módulo usa `/api/v1/campaigns`, PostgreSQL e processamento no servidor. O assistente tem objetivo, destinatários, mensagem, linha/horário e conferência. Administradores e gestores podem editar, registrar preferências e iniciar; corretores/leitores acompanham. Sessões da extensão não administram campanhas. A flag de interface `campaigns` pode ser habilitada pelo administrador do ambiente; não substitui as permissões da API.

### Publicação e operação

1. Faça backup do banco. Execute `npm run db:migrate:campaigns` **antes** de publicar. `database/04_campaigns.sql` e `database/05_campaign_sequences.sql` adicionam tabelas próprias de campanhas, destinatários, recibos e reservas de envio. A migração é repetível, preserva registros e altera apenas o padrão de consentimento dos cadastros futuros; não revoga nem concede autorização retroativamente. Nunca aplique o SQL inicial inteiro sobre uma instalação existente.
2. Publique a aplicação. Confira o login, a consulta de campanhas e a criação de rascunho. Sem a migração, a tela apresenta indisponibilidade; não simula campanhas salvas. O `amplify.yml` inclui `CAMPAIGNS_*` no ambiente do servidor.
3. Configure `CAMPAIGNS_ENABLED=true` para habilitar o processamento/recibos após a migração. Configure `CAMPAIGNS_OUTBOUND_ENABLED=true` somente quando o agendador e uma conexão Z-API operacional estiverem validados. Ambas têm padrão `false`. Nenhuma campanha é criada/ativada automaticamente na publicação.
4. Use o mesmo endpoint protegido e segredo das automações: `POST /api/internal/automations/run`. O processador alterna a prioridade de campanhas e automações, usando reservas compartilhadas por linha e por contato. O workflow do GitHub é uma alternativa a cada cinco minutos e pode atrasar; não representa um SLA. Para operação contínua, execute `npm run worker:messages` em um serviço supervisionado, com `CRM_WORKER_URL` e `AUTOMATIONS_CRON_SECRET` no ambiente. Esse processo consulta o servidor a cada cinco segundos, sem sobrepor requisições. **Executá-lo pode enviar campanhas previamente confirmadas; não é uma checagem de leitura.** `--once` limita a uma execução. O processo não deve ser usado no navegador nem como tarefa solta de uma função serverless.
5. Para anexos, configure bucket, IAM para PUT/GET e CORS do S3. São aceitos JPG, PNG, WebP e PDF até 10 MB, e vídeos MP4 até 25 MB. O servidor confirma MIME, tamanho e versão (ETag); a URL enviada ao provedor é assinada no momento de cada envio, sem armazenar links temporários como identidade do arquivo. O prefixo é exclusivo da imobiliária. Testes reais exigem o número do perfil do usuário e confirmação explícita; não aceitam um telefone arbitrário no corpo da requisição. Os testes de desenvolvimento usam provedores falsos e não enviam nada.

### Destinatários, mensagens e preferências

A seleção combina interesse, origem, etapa, responsável, etiquetas, regiões e orçamento, ou uma lista manual dos contatos do próprio ambiente. A conferência informa os elegíveis e um motivo principal por contato excluído. Telefones precisam estar identificados no formato internacional; não são inventados por sufixo ou nome. Números repetidos são excluídos, inclusive quando um cadastro relacionado ao mesmo número é pessoal ou está bloqueado. Público vazio nunca recebe uma quantidade fictícia e impede o início.

O campo legado `consentGiven` não é prova suficiente para campanhas. Autorizações ficam em `crm_tenant_state.marketingPermissions`, por telefone normalizado e imobiliária, com origem, descrição, data informada, registro no servidor e responsável. O gestor deve registrar uma preferência real em **Autorizações**, com confirmação explícita. Importar contatos ou receber uma mensagem não concede autorização automaticamente. As novas criações passam a usar consentimento falso. Pedidos explícitos recebidos no WhatsApp, como “SAIR”, “PARAR” e “não quero receber mensagens”, revogam a preferência e impedem comunicação automática subsequente. Um pedido atrasado é respeitado, salvo preferência explícita posterior. Uma nova autorização não pode ser anterior ao pedido de interrupção. Snapshots/importações antigos não desfazem uma revogação registrada.

O texto dos modelos é copiado para o rascunho e pode ser editado. Há botões para nome, primeiro nome, empresa e corretor responsável. Variáveis não reconhecidas, responsável ausente e texto personalizado longo são tratados antes do envio. Texto simples aceita até 4.096 caracteres; a aplicação limita legendas de imagem, vídeo e PDF a 1.024. O anexo de um modelo não é copiado automaticamente: deve ser escolhido e conferido no assistente. Para PDF, o cliente utiliza a [rota de documento com extensão e legenda](https://developer.z-api.io/message/send-message-document).

### Confirmação, acompanhamento e recuperação

Salvar rascunho não inicia envios. A simulação registra a revisão e a impressão digital dos destinatários/textos por quinze minutos; não manda mensagens nem cria tentativas reais. Alteração de público, autorização ou personalização exige nova simulação. A confirmação pede a quantidade exata e verifica a linha e o agendador novamente. A lista confirmada é congelada em `crm_campaign_recipients`, com mensagem personalizada, versão do arquivo e autorização usada; novos contatos não entram depois. Os excluídos na revisão são preservados no resumo para consulta.

Uma campanha iniciada não pode ter conteúdo alterado; use **Duplicar** para preparar outra. Pausar preserva os pendentes. Retomar não repete confirmados. Cancelar encerra os envios que ainda não começaram. Um envio já despachado pode concluir. Agendamento respeita fuso/dias/horário e pendências expiram no prazo configurado (24 a 168 horas a partir do início programado). Novas interações do cliente/equipe, mudança de telefone, autorização alterada/revogada, contato pessoal/removido ou abordagem automática pendente são conferidos novamente antes de cada envio.

As reservas impedem duas execuções simultâneas na mesma linha ou para o mesmo telefone. A aplicação usa intervalo mínimo de quinze segundos por linha, dez minutos entre abordagens ao mesmo número e vinte e quatro horas entre campanhas para o mesmo número. Teste para o próprio perfil tem intervalo mínimo de um minuto e limite de dez solicitações por hora. A duração depende da capacidade/frequência do processador; limites não garantem ausência de restrições do WhatsApp. Nenhum destes controles deve ser apresentado como “proteção anti-bloqueio” ou selo jurídico.

Há estados individuais: aguardando, verificando, aguardando conexão, enviando, aceito pelo provedor, entregue, lido, falha confirmada, não enviado, cancelado e precisa de conferência. Aceite do provedor não é entrega. Recibos persistidos podem chegar antes do retorno do envio e são conciliados sem regredir leitura/entrega. Respostas após envio são associadas ao último envio elegível da mesma linha, até sete dias; não são apresentadas como conversões comprovadas. Testes para o perfil aparecem separados e não entram nos indicadores comerciais.

Antes da chamada externa, a tentativa passa a “enviando”. Falha, timeout ou interrupção sem confirmação depois desse ponto vira “precisa de conferência”, **sem repetição automática**. Confira a conversa antes de decidir reenviar. Verificações interrompidas antes do despacho podem ser retomadas por lease. O painel lista resultados paginados e permite filtrar pendências. “Processamento concluído” significa que cada tentativa tem um resultado, podendo conter falhas ou itens para conferir; não significa entrega integral.

`npm test` cobre público vazio, duplicação, dados pessoais, autorização, alterações concorrentes, simulação, confirmação, congelamento de público, pausa/retomada/cancelamento, agendamento/expiração, concorrência com automações, timeout, recibos fora de ordem, resposta posterior e isolamento. `e2e/campaigns.spec.ts` cobre o assistente, recuperação de erro, preferências e tela pequena, com todas as APIs interceptadas. A validação com pessoas de baixa familiaridade tecnológica e um piloto com canal real ainda devem anteceder uso amplo.


### Sequências de até cinco mensagens

O editor permite de um a cinco blocos ordenados, com texto e anexo opcional em cada um. Use Adicionar mensagem, Subir, Descer e Remover. A conferência mostra os balões, anexos, quantidade por contato e intervalo. Campanhas antigas continuam como um bloco; salvar um rascunho novo normaliza a primeira mensagem para manter compatibilidade. Conteúdos iniciados continuam imutáveis.

O intervalo entre partes é de **30 segundos por padrão**, configurável de **15 a 3.600 segundos**. É uma espera mínima contada a partir do aceite persistido da parte anterior, nunca da abertura do navegador. O horário de atendimento, a fila e a frequência do processador podem alongar o intervalo. A alternativa de cron do GitHub continua com frequência de cinco minutos e não permite prometer intervalos de segundos; para isso, use o runner supervisionado com consulta a cada cinco segundos. O servidor não mantém uma função dormindo para esperar o timer. Fechar a tela ou reiniciar o processo não apaga a contagem. O relatório mostra o prazo derivado do aceite anterior e uma contagem regressiva local apenas informativa; o banco decide a liberação efetiva.

Cada destinatário tem uma sequência identificada e cada parte tem seu próprio registro, ordem, texto congelado, arquivo, autorização, estado e ID externo. Só a parte seguinte a uma parte aceita/entregue/lida pode ser despachada, após o intervalo. As reservas de linha continuam compartilhadas com automações. A exceção ao intervalo entre abordagens vale apenas para a continuação da **mesma sequência**, nunca para outra campanha. A autorização e novas interações são conferidas entre as partes. Resposta do contato ou atendimento da equipe interrompem as próximas partes; não há retomada automática depois dessa interrupção.

Pausar e retomar preserva as partes aceitas e o timer. Cancelar afeta apenas partes ainda não despachadas. Resultado incerto, falha confirmada, revogação ou expiração interrompem o restante, sem repetir a parte enviada. Um recibo tardio não reabre partes interrompidas. O teste para o próprio número envia a sequência completa, com o mesmo intervalo, e permanece separado dos indicadores. O limite de dez testes por hora conta solicitações, não blocos.

Os indicadores principais continuam contando **contatos**, sem multiplicá-los pela quantidade de blocos. Uma sequência só é aceita/entregue/lida por inteiro quando todas as partes alcançam o estado correspondente. O relatório lista cada mensagem separadamente. Para atualizar uma instalação existente, faça backup e execute novamente `npm run db:migrate:campaigns` antes de publicar; a migração 05 adiciona a identificação da sequência nas reservas e um índice, sem reescrever campanhas existentes. O envio continua condicionado ao canal ativo, agendador e flags operacionais já descritos.


### Vídeos e edição com blocos expansíveis

Um bloco pode conter somente um anexo, sem obrigar uma legenda; sem texto e sem arquivo, ele não pode ser salvo. As campanhas aceitam **vídeos MP4 de até 25 MB por parte**; imagens/PDFs mantêm o limite de 10 MB e as legendas opcionais mantêm o limite de 1.024 caracteres. O teto de vídeo é uma escolha da aplicação alinhada ao upload S3 existente, não uma afirmação de limite universal do WhatsApp. MIME, extensão .mp4, tamanho e ETag são conferidos no servidor; o código não inspeciona codecs nem faz transcodificação. Prefira MP4 exportado com H.264, conforme a [documentação oficial da Z-API para vídeos](https://developer.z-api.io/message/send-message-video). MOV, WebM e outros formatos precisam ser convertidos antes. O envio usa `/send-video` com legenda e processamento assíncrono; aceite continua distinto de entrega e depende dos recibos. Vídeo sem confirmação não é reenviado automaticamente, e o timer continua contado do aceite da parte anterior.

A prévia do editor tem controles, sem reprodução automática, e apresenta uma orientação quando o navegador não consegue reproduzir o arquivo. O histórico registra o tipo VIDEO e permite abrir/reproduzir o original pela rota autenticada de mídia; sem arquivo original acessível, a aplicação não promete recuperação. No histórico, o player não pré-carrega o vídeo antes da ação do usuário. Os pré-requisitos de S3, canal e agendador permanecem necessários; este desenvolvimento não ativa um canal nem realiza envios reais.

O editor abre inicialmente a primeira mensagem. Adicionar uma parte recolhe a anterior, abre a nova e posiciona o foco no texto. Clique no título/seta para expandir ou recolher; somente um bloco fica aberto por vez, podendo também recolher todos. Texto e anexo continuam no rascunho quando um bloco é recolhido. O cabeçalho mostra um resumo e o nome do arquivo. Reordenar preserva a mensagem que estava aberta; remover abre uma vizinha. Os controles Subir, Descer e Remover ficam no bloco aberto. Recolher um vídeo remove o player da tela, interrompendo sua reprodução, sem remover o anexo. O intervalo e a prévia geral ficam fora dos blocos.

### Validação integrada de campanhas e etiquetas (01/11/2026)

`e2e/campaigns-label-journey.spec.ts` executa a interface contra os handlers reais de campanhas/estado e PostgreSQL compatível isolado (PGlite). O transporte do navegador é adaptado pelo teste; login inicial e fronteiras de provedor são controlados. Não acessa o banco de produção e não executa o processador de envio. A fila criada no teste é cancelada antes do encerramento. `tests/security/campaign-labels.test.cjs` também percorre a importação real da extensão e o preview/importação Z-API com respostas externas fictícias. O fixture compartilhado está em `tests/support/campaign-journey.cjs` e falha se ocorrer uma tentativa externa de envio.

A jornada cobre etiquetas em `whatsappLabels`, etiquetas internas em `tags`, prefixos legados `[Etiqueta]`, nomes equivalentes por caixa/espaçamento/Unicode, seleção combinada, exclusão de pessoais e contatos sem autorização, público vazio, cinco partes, intervalo, simulação sem criar tentativas, confirmação com público congelado, pausa/retomada/cancelamento, persistência após recarregar e bloqueio com envio desabilitado. Os testes existentes continuam cobrindo mídias, resultados incertos, concorrência, status e isolamento. O matcher de etiquetas é exato após normalização; `VIP` não equivale a `Não VIP`. A aplicação não altera os nomes armazenados apenas para exibi-los nas campanhas, nem remove etiquetas retroativamente.

A consulta de campanhas inclui as etiquetas nativas do WhatsApp. A importação da extensão preserva esse campo e as etiquetas internas existentes. A reimportação em lote combina as etiquetas no estado atual dentro da transação, preservando os dados comerciais. Preview, sincronização e sincronização em segundo plano compartilham a resolução de IDs e objetos de etiquetas; IDs desconhecidos não viram nomes artificiais nem `[object Object]`. Campanhas usam as etiquetas já importadas no CRM: a seleção não consulta o WhatsApp ao vivo. Importações parciais acrescentam etiquetas; não são uma garantia de espelhamento de exclusões/renomeações ocorridas no telefone. O piloto com conta/canal real depende das condições operacionais descritas acima.
