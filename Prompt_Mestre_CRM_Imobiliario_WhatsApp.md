# Prompt mestre — CRM imobiliário multiempresa integrado ao WhatsApp

## 1. Como utilizar este documento

Copie todo o conteúdo da seção **“Prompt de execução”** para a ferramenta de desenvolvimento por IA. O agente deve trabalhar por fases, gerar primeiro a arquitetura e o plano técnico, depois implementar o MVP em incrementos verificáveis.

Este documento define um produto SaaS B2B multiempresa para várias imobiliárias independentes. Cada imobiliária deve possuir ambiente, usuários, configurações, contatos, mensagens, funis e indicadores isolados.

---

# Prompt de execução

Você é um time sênior formado por Product Manager, Product Designer, UX Researcher, Arquiteto de Software AWS, Engenheiro Full Stack, Engenheiro de Dados, Especialista em Segurança/LGPD, QA e DevOps.

Sua missão é projetar e construir uma plataforma SaaS de CRM imobiliário multiempresa, integrada ao WhatsApp por meio da Z-API. O sistema deve ser clean, rápido, prático e orientado à conversão de leads. Não produza apenas um protótipo visual: construa uma aplicação funcional, segura, testável, documentada e preparada para produção.

Trabalhe de forma incremental. Antes de escrever código, apresente:

1. entendimento do produto e premissas;
2. mapa de módulos;
3. arquitetura técnica;
4. modelo de dados;
5. fluxos principais;
6. backlog dividido em MVP, versão 1.1 e versão futura;
7. riscos, dependências e decisões que exigem validação;
8. plano de implementação e testes.

Não invente credenciais, URLs, tokens ou funcionalidades não suportadas pela Z-API. Use variáveis de ambiente e adaptadores de integração. Quando houver dúvida sobre comportamento atual da Z-API ou de um serviço AWS, sinalize a validação necessária na documentação oficial antes da implementação.

## 2. Visão do produto

Criar um CRM para imobiliárias acompanharem toda a jornada comercial de um lead, desde a entrada pelo WhatsApp ou cadastro manual até a conversão, perda ou reativação.

O produto deve permitir:

- cadastrar e enriquecer automaticamente contatos provenientes do WhatsApp;
- armazenar renda, faixa de financiamento, entrada disponível, interesse, região, tipo de imóvel, origem do lead e demais dados comerciais;
- visualizar e responder conversas do WhatsApp dentro do CRM;
- organizar leads em funis personalizáveis;
- criar tarefas, lembretes, alertas e regras de inatividade;
- segmentar contatos e enviar campanhas ou sequências automáticas;
- medir atendimento, engajamento e conversão;
- usar IA para resumir conversas, classificar sentimento e intenção, sugerir respostas e apoiar a priorização comercial;
- manter os dados e configurações de cada imobiliária completamente isolados.

## 3. Modelo SaaS multiempresa

Implemente multi-tenancy com `tenant_id` obrigatório em todas as entidades pertencentes a uma imobiliária.

Regras obrigatórias:

- nunca confiar em `tenant_id` enviado livremente pelo frontend;
- derivar a empresa e as permissões do token autenticado;
- aplicar isolamento no serviço e no banco;
- prever testes automatizados contra vazamento entre tenants;
- possibilitar que um usuário pertença a uma ou mais imobiliárias, com papéis distintos;
- permitir configuração de marca, logo, cores, fuso horário, horário comercial e regras de atendimento por imobiliária;
- permitir uma ou mais instâncias/números Z-API por imobiliária;
- registrar trilha de auditoria para ações críticas.

Perfis iniciais:

- **Superadmin da plataforma:** administra tenants, planos, limites, saúde das integrações e suporte; não deve acessar conteúdo de conversas por padrão;
- **Administrador da imobiliária:** configura usuários, funis, campos, integrações, automações e permissões;
- **Gestor:** acompanha equipe, redistribui leads, acessa relatórios e configura regras permitidas;
- **Corretor/atendente:** acessa seus leads e conversas, atualiza o funil e executa tarefas;
- **Visualizador:** consulta informações autorizadas sem editar.

Use RBAC com permissões granulares e possibilidade futura de equipes.

## 4. Cadastro e perfil 360º do lead

Ao receber uma primeira mensagem de um número ainda não registrado, criar automaticamente um contato preliminar dentro do tenant vinculado à instância Z-API. Normalizar o telefone em padrão internacional, evitar duplicidade e manter o identificador externo do WhatsApp.

Campos padrão do lead:

- nome;
- telefone e e-mail;
- CPF opcional, protegido e com acesso restrito;
- status do contato;
- corretor responsável;
- origem e suborigem do lead;
- campanha, anúncio, empreendimento ou parceiro de origem;
- renda individual e familiar;
- valor de entrada disponível;
- faixa estimada de financiamento;
- valor mínimo e máximo do imóvel;
- tipo de imóvel;
- finalidade: moradia ou investimento;
- quantidade de quartos, vagas e demais preferências;
- cidade, bairro ou região desejada;
- prazo estimado para compra;
- estágio do funil;
- temperatura do lead;
- tags;
- consentimento, opt-in, opt-out e base legal;
- observações internas;
- data do último contato do cliente;
- data do último contato da equipe;
- próxima ação;
- data de criação, atualização, conversão e perda.

Permitir campos personalizados por tenant com tipos texto, número, moeda, data, lista, múltipla escolha, booleano e usuário.

O perfil 360º deve reunir dados cadastrais, negócio ativo, histórico do funil, conversas, anexos, tarefas, notas, campanhas recebidas, consentimentos, IA e auditoria relevante.

## 5. Caixa de entrada omnicanal focada no WhatsApp

Criar uma inbox em três áreas:

1. lista de conversas e filtros;
2. conversa ativa;
3. painel lateral do lead e negócio.

Funcionalidades:

- receber mensagens via webhook Z-API;
- enviar texto e, conforme capacidade validada no provedor, mídias e documentos;
- estados de envio, entrega, leitura e falha quando disponíveis;
- mensagens recebidas e enviadas em ordem cronológica idempotente;
- atribuição manual e automática por corretor/equipe;
- conversas não atribuídas, minhas, da equipe, aguardando cliente, aguardando equipe e encerradas;
- notas internas que nunca são enviadas ao cliente;
- respostas rápidas e modelos;
- busca por contato e conteúdo indexável permitido;
- indicador digitando apenas se a integração suportar;
- anexos armazenados com segurança;
- bloqueio de envio para contatos com opt-out;
- opção de atendimento manual antes de qualquer automação;
- histórico de falhas e reprocessamento controlado.

O webhook deve responder rapidamente e transferir o processamento para fila assíncrona. Validar autenticidade conforme recursos atuais da Z-API, aplicar segredo/token, allowlist quando aplicável, rate limiting, idempotência e proteção contra replay.

## 6. Funil de atendimento e conversão

Permitir múltiplos funis por imobiliária. O funil padrão poderá conter:

1. Novo lead;
2. Primeiro contato;
3. Em qualificação;
4. Perfil validado;
5. Imóveis apresentados;
6. Visita agendada;
7. Visita realizada;
8. Proposta;
9. Análise de crédito/financiamento;
10. Negociação;
11. Contrato/convertido;
12. Perdido;
13. Nutrição futura.

Requisitos:

- quadro Kanban e visão em lista;
- drag and drop com confirmação em etapas críticas;
- etapas, cores, SLAs e motivos de perda configuráveis;
- valor potencial do negócio;
- probabilidade manual e probabilidade estimada pela IA, exibidas separadamente;
- histórico imutável de movimentações;
- obrigatoriedade de campos por etapa;
- automações acionadas ao entrar ou sair de uma etapa;
- filtros salvos e visualizações por corretor, equipe, origem, empreendimento, período e temperatura;
- possibilidade de mais de um negócio por contato.

## 7. Alertas, tarefas e cadências

Criar motor de alertas configurável. Exemplos:

- lead novo sem primeiro atendimento após X minutos;
- cliente respondeu e está aguardando a equipe há X minutos;
- equipe enviou mensagem e o cliente não respondeu há X horas ou dias;
- lead sem qualquer interação há X dias;
- visita ou tarefa próxima do vencimento;
- tarefa atrasada;
- lead parado em uma etapa além do SLA;
- proposta sem acompanhamento;
- instância Z-API desconectada ou webhook com falhas.

Cada regra deve poder definir público, condição, horário comercial, responsável, prioridade, canais de notificação e ação. Evitar alertas duplicados e permitir adiar, concluir ou reatribuir.

Notificações iniciais: central interna e e-mail. Preparar arquitetura para push PWA e alertas por WhatsApp interno, sem implementar envio recursivo ou inseguro.

## 8. Segmentação, campanhas e mensagens automáticas

Permitir criar segmentos dinâmicos e listas estáticas usando filtros como:

- etapa do funil;
- responsável;
- origem;
- tags;
- região e interesse;
- renda e faixa de financiamento;
- valor do imóvel;
- tempo sem interação;
- última mensagem;
- probabilidade de compra;
- sentimento;
- campanha anterior;
- consentimento e opt-out.

O usuário deve poder criar uma campanha, definir mensagem, público, instância remetente, janela de envio, intervalo/lote, regras de exclusão e agendamento. Exibir estimativa de destinatários antes da confirmação.

Regras obrigatórias:

- respeitar LGPD, consentimento e opt-out;
- exigir confirmação antes de iniciar campanha;
- impedir contato com bloqueados ou sem base válida conforme a finalidade;
- aplicar limites configuráveis por tenant e por instância;
- usar filas, lotes, retry com backoff e dead-letter queue;
- não prometer que intervalos artificiais evitam bloqueio;
- registrar enviado, entregue, lido, respondido, falhou e motivo, conforme dados disponíveis;
- permitir pausar e cancelar envios ainda não processados;
- manter blacklist/suppression list;
- adicionar comando claro de saída quando aplicável;
- consultar e respeitar políticas atuais do WhatsApp e da Z-API antes da produção.

Automações devem usar um construtor simples baseado em gatilho, condições e ações.

Gatilhos iniciais:

- lead criado;
- mensagem recebida;
- mudança de etapa;
- campo atualizado;
- tarefa vencida;
- período sem resposta;
- data programada.

Ações iniciais:

- enviar mensagem;
- criar tarefa;
- atribuir responsável;
- adicionar/remover tag;
- mover etapa;
- atualizar campo;
- notificar usuário;
- iniciar ou encerrar cadência.

Implemente controle de versão, logs e proteção contra ciclos infinitos. O usuário deve enxergar por que uma automação foi ou não executada.

## 9. Agente e recursos de inteligência artificial

A IA é copiloto, não substitui automaticamente o corretor no MVP.

Recursos do MVP:

- resumo atualizado da conversa;
- extração sugerida de informações como renda, entrada, região, interesse, prazo e objeções;
- sugestão de resposta contextual;
- identificação de intenção e sentimento;
- lista de pendências e próxima melhor ação;
- categorização das principais objeções;
- alerta de risco de abandono.

Evoluções:

- score de propensão à compra;
- recomendação de imóveis integrados a um catálogo;
- cadências personalizadas;
- agente conversacional com autonomia limitada e handoff humano;
- análise de desempenho de atendimento.

Regras de IA:

- sempre indicar quando um dado foi inferido;
- exigir confirmação humana antes de gravar informação sensível ou enviar resposta no MVP;
- nunca inventar disponibilidade, preço, aprovação de crédito ou condição comercial;
- mostrar justificativas simples para score e recomendação;
- permitir edição da sugestão;
- registrar aceite, edição ou rejeição para avaliação futura;
- mascarar/minimizar dados pessoais enviados ao modelo sempre que possível;
- não utilizar conversas de um tenant para beneficiar outro;
- ter timeout, fallback e controle de custos;
- armazenar versão do prompt, modelo, latência, tokens/custo e resultado, respeitando privacidade;
- incluir avaliação offline com conjunto de casos e monitoramento de qualidade;
- proteger contra prompt injection existente em mensagens ou anexos.

Use um provedor de LLM atrás de uma interface abstrata. Para AWS, considerar Amazon Bedrock quando adequado, sem acoplar o domínio a um único modelo.

Não tratar a probabilidade de compra como verdade estatística no início. Na ausência de dados históricos rotulados, usar um score heurístico explicável, chamado **Score de prioridade**, e não uma porcentagem enganosa. Migrar para modelo calibrado somente após volume e qualidade de dados suficientes.

## 10. Dashboards e indicadores

Dashboard executivo por período, tenant, funil, origem, corretor e empreendimento:

- novos leads;
- leads atendidos;
- tempo até primeira resposta;
- tempo médio de resposta;
- leads sem responsável;
- leads parados e SLAs vencidos;
- conversão por etapa;
- taxa de conversão final;
- tempo médio de ciclo;
- origem versus conversão;
- distribuição de motivos de perda;
- visitas e propostas;
- campanhas: entrega, leitura, resposta, opt-out e conversão atribuída, conforme dados disponíveis;
- produtividade por corretor sem criar métricas manipuláveis ou invasivas;
- saúde das instâncias Z-API.

Definir claramente fórmulas e eventos usados em cada indicador. Não calcular métricas diretamente em consultas pesadas durante cada carregamento; preparar agregações e processamento assíncrono conforme escala.

## 11. UX/UI e design system

O visual deve ser clean, contemporâneo, profissional e de alta legibilidade. Priorizar velocidade de trabalho e redução de cliques.

Diretrizes:

- desktop-first para operação, totalmente responsivo para tablet e celular;
- PWA instalável como evolução ou desde o MVP se não comprometer estabilidade;
- navegação lateral recolhível;
- cabeçalho simples com busca global, ações rápidas e notificações;
- hierarquia visual clara, respiro e densidade ajustável;
- componentes consistentes e estados completos: vazio, carregando, erro, offline, sem permissão e sucesso;
- acessibilidade WCAG 2.2 AA como referência;
- teclado, foco visível, contraste, labels e leitores de tela;
- feedback imediato em ações e prevenção de erros;
- autosave quando seguro;
- confirmações apenas para ações irreversíveis ou de grande impacto;
- interface e textos em português do Brasil;
- datas, moeda e telefones no padrão brasileiro, mantendo UTC internamente;
- tema claro no MVP e arquitetura preparada para tema escuro;
- não usar excesso de cards, gradientes, animações ou dashboards decorativos;
- Kanban deve continuar utilizável em telas menores, oferecendo alternativa em lista.

Telas mínimas:

1. login, recuperação e primeiro acesso;
2. seleção de imobiliária para usuários multi-tenant;
3. onboarding da empresa e conexão Z-API;
4. dashboard;
5. inbox/conversas;
6. lista e perfil do lead;
7. funil Kanban/lista;
8. tarefas e agenda;
9. segmentos;
10. campanhas e resultados;
11. automações;
12. relatórios;
13. usuários, perfis e permissões;
14. configurações da empresa, campos, funis e integrações;
15. central de notificações;
16. painel administrativo da plataforma.

## 12. Arquitetura técnica AWS

Adotar arquitetura modular e pragmática. Começar com um **monólito modular serverless ou serviços bem delimitados**, evitando microserviços prematuros. Separar domínios e eventos para permitir extração futura.

Stack recomendada:

- frontend: Next.js + TypeScript;
- UI: design system com componentes acessíveis e tokens de design;
- estado de servidor: TanStack Query ou equivalente;
- formulários e validação: React Hook Form + Zod ou equivalentes;
- autenticação: Amazon Cognito User Pools;
- autorização: claims/grupos do Cognito combinados com RBAC persistido no banco;
- API: Amazon API Gateway HTTP API;
- backend: AWS Lambda com TypeScript/Node.js em versão LTS;
- banco transacional: Amazon Aurora PostgreSQL Serverless v2 ou RDS PostgreSQL;
- conexão ao banco: RDS Proxy;
- ORM: Prisma ou Drizzle, escolhendo com justificativa e estratégia compatível com Lambda;
- filas: Amazon SQS, incluindo DLQ;
- eventos de domínio: Amazon EventBridge quando agregar valor;
- agendamentos: EventBridge Scheduler;
- arquivos: Amazon S3 com URLs pré-assinadas, validação de tipo/tamanho e antivírus quando aplicável;
- CDN/frontend: CloudFront + S3 ou hospedagem compatível com Next.js na AWS;
- segredos: AWS Secrets Manager e/ou SSM Parameter Store;
- e-mail: Amazon SES;
- observabilidade: CloudWatch Logs/Metrics/Alarms, X-Ray ou OpenTelemetry;
- proteção: AWS WAF na borda quando aplicável;
- infraestrutura como código: AWS CDK ou Terraform;
- CI/CD: pipeline com lint, testes, análise de segurança, migrations controladas e deploy por ambiente;
- IA: Amazon Bedrock ou adaptador de provedor configurável;
- cache/locks: ElastiCache Redis somente quando a necessidade estiver comprovada; avaliar DynamoDB para idempotência/locks de alta escala.

Ambientes independentes: desenvolvimento, homologação e produção. Contas AWS separadas são preferíveis para produção; no mínimo, separar recursos, credenciais e configurações.

Fluxo de entrada do WhatsApp:

1. Z-API chama endpoint de webhook;
2. API valida segredo e contexto da instância;
3. serviço registra envelope/idempotency key e envia evento à SQS;
4. retorna resposta rápida ao provedor;
5. consumidor normaliza evento, resolve tenant/instância/contato/conversa;
6. persiste mensagem e atualiza última interação;
7. publica eventos de domínio;
8. avalia atribuição, alertas, automações e IA assíncrona;
9. atualiza frontend via polling eficiente no MVP ou canal em tempo real validado.

Fluxo de saída:

1. usuário ou automação solicita envio;
2. autorização, opt-out, regras e limites são validados;
3. mensagem recebe status pendente e entra em fila;
4. worker seleciona credencial da instância e chama Z-API;
5. resposta externa é persistida;
6. callbacks posteriores atualizam entrega/leitura/falha;
7. retry ocorre apenas para erros elegíveis, com backoff e DLQ.

Não executar campanhas grandes diretamente na requisição HTTP nem manter Lambda aguardando delays.

## 13. Modelo de dados inicial

Criar migrations para as entidades abaixo, com chaves UUID/ULID, timestamps, índices e constraints adequados:

- `tenants`;
- `tenant_settings`;
- `users`;
- `memberships`;
- `roles` e `permissions`;
- `teams` e `team_members`;
- `whatsapp_instances`;
- `contacts`;
- `contact_channels`;
- `contact_consents`;
- `custom_field_definitions`;
- `custom_field_values`;
- `lead_sources`;
- `pipelines`;
- `pipeline_stages`;
- `deals`;
- `deal_stage_history`;
- `conversations`;
- `conversation_assignments`;
- `messages`;
- `message_status_history`;
- `attachments`;
- `notes`;
- `tags` e `contact_tags`;
- `tasks`;
- `saved_segments`;
- `campaigns`;
- `campaign_recipients`;
- `message_templates`;
- `automation_definitions`;
- `automation_versions`;
- `automation_runs`;
- `alert_rules`;
- `alerts`;
- `ai_insights`;
- `ai_feedback`;
- `notifications`;
- `webhook_events`;
- `integration_delivery_attempts`;
- `audit_logs`.

Regras do banco:

- `tenant_id` obrigatório e indexado nas tabelas de tenant;
- unicidade de telefone normalizado dentro do tenant, com estratégia segura de mesclagem;
- unicidade de identificadores externos por instância/provedor;
- soft delete apenas onde fizer sentido, sem substituir retenção e anonimização;
- valores monetários em decimal ou centavos inteiros, nunca float;
- datas operacionais em UTC e apresentação no fuso do tenant;
- histórico de estágio e status de mensagem append-only;
- criptografia de dados sensíveis e tokens fora do banco quando possível;
- paginação por cursor nas listas volumosas;
- estratégia de índices validada com consultas reais.

## 14. API e contratos

Criar API versionada e documentada com OpenAPI. Separar módulos:

- auth/contexto;
- tenants e memberships;
- usuários/permissões;
- contatos;
- negócios/funis;
- conversas/mensagens;
- tarefas;
- segmentos;
- campanhas;
- automações;
- alertas/notificações;
- relatórios;
- integrações;
- IA;
- administração da plataforma.

Aplicar validação de entrada, códigos de erro consistentes, correlation ID, paginação, filtros, ordenação, rate limiting e idempotency key em mutações críticas.

Versionar contratos dos webhooks Z-API internamente. Manter o payload bruto somente pelo período necessário para diagnóstico, com proteção e política de retenção.

## 15. Segurança e LGPD

Requisitos mínimos:

- Cognito com política de senha, recuperação segura e MFA configurável/obrigatório para administradores;
- tokens curtos, refresh seguro e revogação adequada;
- princípio do menor privilégio em IAM;
- criptografia TLS em trânsito e KMS em repouso;
- credenciais Z-API por tenant no Secrets Manager, nunca no frontend ou logs;
- sanitização e validação de conteúdo;
- proteção contra XSS, CSRF quando aplicável, SSRF, injection, upload malicioso e enumeração de usuários;
- logs estruturados sem tokens, CPF ou conteúdo integral desnecessário;
- auditoria de login, exportação, mudanças de permissão, campanhas, integrações e exclusões;
- política de retenção, exportação, anonimização e exclusão;
- registro de consentimento e opt-out;
- processos para direitos do titular;
- backups automáticos, point-in-time recovery e testes de restauração;
- análise de dependências, SAST e secrets scanning no CI;
- limites de uso e proteção contra abuso;
- revisão de ameaça usando STRIDE antes da produção;
- termos de uso, política de privacidade e contrato de operador/controlador a serem definidos juridicamente.

## 16. Observabilidade e confiabilidade

Implementar:

- logs JSON com `correlation_id`, `tenant_id` não sensível, módulo e resultado;
- métricas de webhook, filas, envio, erro por provedor, latência e DLQ;
- alarmes de instância desconectada, falhas elevadas, backlog, erros 5xx e saturação;
- dashboards técnicos;
- tracing nos fluxos principais;
- health checks e status de integrações;
- runbooks para reprocessamento, DLQ, indisponibilidade da Z-API e restauração;
- retries com jitter somente quando seguros;
- idempotência ponta a ponta;
- feature flags para funcionalidades arriscadas;
- definição inicial de SLOs e orçamento de erros.

## 17. Requisitos não funcionais iniciais

- carregar as telas operacionais principais rapidamente em conexão comum;
- não bloquear a interface enquanto processos assíncronos executam;
- suportar inicialmente centenas de tenants, milhares de usuários e milhões de mensagens com estratégia de escala horizontal;
- usar paginação e lazy loading;
- evitar N+1 queries;
- garantir acessibilidade e responsividade;
- manter cobertura de testes nos domínios críticos;
- fornecer documentação de setup, arquitetura, decisões e operação;
- não amarrar regras de negócio diretamente a componentes de UI ou ao SDK Z-API.

Defina metas mensuráveis de performance após conhecer carga, volume de mensagens, campanhas e quantidade de tenants. Crie testes de carga antes da produção.

## 18. Escopo recomendado do MVP

Incluir:

- multi-tenancy e RBAC;
- login Cognito, recuperação e onboarding;
- conexão segura de uma instância Z-API por tenant, deixando modelo preparado para várias;
- webhook, envio e recebimento de mensagens de texto;
- cadastro automático e manual de contatos;
- perfil do lead e campos comerciais principais;
- um ou mais funis configuráveis;
- inbox compartilhada com atribuição;
- tarefas e alertas essenciais de inatividade;
- tags, filtros e segmentos;
- campanhas agendadas simples com consentimento, limites, pausa e métricas;
- respostas rápidas;
- IA copiloto: resumo, extração sugerida, sentimento/intenção e resposta sugerida;
- dashboard básico;
- auditoria, observabilidade e LGPD essencial;
- painel de configurações;
- testes e documentação.

Não incluir no primeiro MVP, salvo nova decisão:

- cobrança/assinaturas do SaaS;
- catálogo completo de imóveis e portais imobiliários;
- telefonia, Instagram ou e-mail omnichannel;
- agente de IA enviando respostas autonomamente;
- machine learning preditivo com porcentagem de compra;
- workflow visual avançado com dezenas de blocos;
- aplicativo nativo;
- BI avançado;
- múltiplos provedores de WhatsApp.

## 19. Critérios de aceite essenciais

O MVP só pode ser considerado pronto quando:

- um tenant não consegue acessar dados de outro por UI, API, alteração de identificador ou consultas indiretas;
- um contato novo recebido pela Z-API é criado ou conciliado sem duplicação e a mensagem aparece na inbox;
- um usuário autorizado consegue responder e acompanhar o status disponível;
- falhas temporárias não duplicam mensagens;
- leads podem ser qualificados, atribuídos e movidos pelo funil com histórico;
- alertas de primeiro atendimento e inatividade funcionam com horário do tenant;
- uma campanha exclui opt-outs, mostra o público antes da confirmação e pode ser pausada;
- mensagens são processadas por fila e não por espera síncrona;
- sugestões da IA não são enviadas sem aprovação humana;
- dados inferidos pela IA aparecem como sugestão, não como fato confirmado;
- permissões são testadas por perfil;
- telas principais funcionam em desktop e celular;
- há estados de loading, vazio, erro e sem permissão;
- logs não expõem segredos nem dados sensíveis proibidos;
- migrations, backups, alertas e runbooks estão documentados;
- testes unitários, de integração, contratos, E2E e isolamento de tenant passam no CI;
- o ambiente de homologação permite executar um fluxo completo antes da produção.

## 20. Estratégia de testes

Criar:

- testes unitários para regras de domínio;
- testes de integração com PostgreSQL real/efêmero;
- testes de contrato para a Z-API usando fixtures sanitizadas;
- testes E2E para login, lead, conversa, funil, campanha e permissões;
- testes de isolamento multi-tenant;
- testes de idempotência e mensagens fora de ordem;
- testes de falha, retry e DLQ;
- testes de acessibilidade;
- testes de carga em webhooks e campanhas;
- testes de segurança e autorização negativa;
- conjunto de avaliação para respostas e extrações da IA.

Nunca depender da API externa real em toda execução do CI. Criar um adapter Z-API, mock server e ambiente sandbox/controlado.

## 21. Entregáveis técnicos obrigatórios

Produzir no repositório:

- README com instalação e execução;
- visão de arquitetura e diagramas C4;
- ADRs das decisões principais;
- modelo ER e dicionário de dados;
- especificação OpenAPI;
- documentação do adapter e webhooks Z-API;
- threat model;
- política de retenção e matriz de dados pessoais;
- infraestrutura como código;
- migrations e seeds não sensíveis;
- coleção de testes/requests;
- runbooks operacionais;
- guia de deploy e rollback;
- guia de onboarding de tenants;
- catálogo de eventos de domínio;
- backlog e critérios de aceite;
- changelog.

## 22. Ordem de implementação

Execute nesta ordem:

### Fase 0 — Descoberta e validação

- validar volume esperado por tenant, quantidade de usuários, leads e campanhas;
- validar plano e limites atuais da Z-API;
- validar políticas aplicáveis do WhatsApp;
- validar regras legais e operacionais de consentimento;
- definir identidade visual e nome do produto;
- criar arquitetura, protótipos e backlog refinado.

### Fase 1 — Fundação

- monorepo, ambientes, IaC, CI/CD e observabilidade;
- Cognito, tenants, memberships, RBAC e auditoria;
- PostgreSQL, migrations, RDS Proxy e padrões de API;
- design system e shell da aplicação.

### Fase 2 — CRM central

- contatos, campos, origens, tags e negócios;
- funis, etapas, histórico, tarefas e perfil 360º;
- filtros, listas e busca.

### Fase 3 — WhatsApp

- configuração segura Z-API;
- webhook idempotente, filas e normalização;
- inbox, conversas, mensagens e atribuição;
- envio, callbacks, retries e monitoramento.

### Fase 4 — Engajamento

- alertas de SLA e inatividade;
- segmentos, templates, campanhas simples;
- automações iniciais e logs explicáveis.

### Fase 5 — IA e análise

- resumo, extração sugerida, intenção/sentimento e respostas;
- feedback humano, avaliação, custos e segurança;
- dashboards comerciais e técnicos.

### Fase 6 — Hardening e lançamento

- E2E, carga, segurança, acessibilidade e LGPD;
- backup/restore, runbooks, alertas e rollback;
- piloto controlado com poucas imobiliárias;
- correções e liberação progressiva.

## 23. Forma de trabalho esperada do agente de desenvolvimento

- Não implemente todo o sistema em uma única alteração.
- Crie pequenos incrementos executáveis e testáveis.
- Antes de alterar arquitetura, registre a decisão e o impacto.
- Reutilize componentes e mantenha consistência visual.
- Não substitua funcionalidades reais por telas estáticas sem identificar claramente o mock.
- Não marque uma tarefa como concluída sem teste ou evidência verificável.
- Preserve contratos, migrations e compatibilidade de dados.
- Em cada incremento, informe arquivos alterados, migrations, testes executados, riscos e próximo passo.
- Ao encontrar requisito ambíguo, adote a opção mais segura e registre a premissa; peça decisão quando houver impacto material em custo, segurança ou produto.
- Nunca exponha segredo, token Z-API, credencial AWS ou dado real nos commits.

Comece agora pela **Fase 0**. Entregue o mapa do produto, arquitetura C4 de contexto e contêineres, ER inicial, fluxos críticos, backlog priorizado, wireframes das telas principais, riscos e perguntas de decisão. Não inicie a implementação antes dessa revisão.

---

# Anexo A — Decisões de produto já adotadas

| Tema | Decisão inicial |
|---|---|
| Mercado | CRM voltado para operações imobiliárias |
| Modelo | SaaS multiempresa |
| Clientes | Várias imobiliárias independentes |
| WhatsApp | Z-API por meio de adapter desacoplado |
| Cloud | AWS |
| Identidade | Amazon Cognito |
| Backend | Lambda + API Gateway + filas |
| Banco | Aurora PostgreSQL Serverless v2 ou RDS PostgreSQL, conforme carga/custo |
| IA | Copiloto com aprovação humana no MVP |
| UX | Web responsiva, clean e orientada à operação |
| Segurança | Isolamento por tenant, RBAC, auditoria e LGPD by design |

# Anexo B — Perguntas que devem ser respondidas na descoberta

1. Quantas imobiliárias, usuários, leads ativos e mensagens/mês são esperados no primeiro ano?
2. Cada imobiliária terá quantos números de WhatsApp?
3. O mesmo telefone pode ser compartilhado entre unidades ou equipes?
4. Leads devem ser distribuídos por rodízio, disponibilidade, região, empreendimento ou regra personalizada?
5. Quais origens precisam de captura além do WhatsApp: site, landing page, Meta Ads, portais ou importação CSV?
6. Existe catálogo de imóveis ou outro ERP/CRM para integrar?
7. Quais mensagens podem ser automáticas sem aprovação humana?
8. Quais critérios e registros de consentimento já existem?
9. Qual tempo esperado para primeiro atendimento e inatividade?
10. Quais indicadores definem sucesso no piloto?
11. Haverá plano por usuário, por tenant, por mensagens ou combinação?
12. A plataforma precisa de white-label ou apenas personalização de marca?
13. Quais dados financeiros são realmente necessários e por quanto tempo serão retidos?
14. Quais papéis e visibilidades entre corretores e gestores são obrigatórios?
15. Qual região AWS, orçamento mensal e requisito de disponibilidade?

# Anexo C — Resultado esperado da primeira execução do prompt

A primeira execução deve entregar, sem iniciar código de produção:

- mapa de módulos e dependências;
- personas e principais jornadas;
- fluxos BPMN ou equivalentes;
- wireframes responsivos;
- arquitetura C4;
- diagrama ER;
- contratos preliminares de API e eventos;
- backlog priorizado com histórias e critérios de aceite;
- estimativa por fases baseada em premissas explícitas;
- matriz de riscos;
- projeção inicial de custos AWS com cenários de carga;
- lista curta de decisões pendentes para aprovação.
