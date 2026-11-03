# Brokiva CRM

## Guia de módulos funcionalidades e jornadas

**Referência:** 2 de novembro de 2026.  
**Público:** responsáveis pelo produto, gestores de imobiliárias, corretores e equipes de implantação.  
**Base:** funcionalidades presentes no código do projeto e condições operacionais descritas no README.

O Brokiva organiza o trabalho comercial imobiliário a partir das conversas com os clientes. Sua proposta é aproveitar o atendimento que o corretor já realiza no WhatsApp para formar um cadastro útil, acompanhar oportunidades e orientar a próxima ação, reduzindo a necessidade de digitar novamente as mesmas informações.

O principal diferencial é a ligação entre **conversa, qualificação, cadastro e acompanhamento comercial**. Atualmente, a qualificação automática utiliza leitura por regras de informações explícitas. Gemini e os demais provedores externos de IA permanecem desativados na operação atual. Interpretação generativa ampla do contexto não deve ser apresentada como uma capacidade ativa neste momento.

Este guia descreve o que cada área oferece, como a pessoa percorre sua jornada e quais condições precisam estar atendidas. A presença de uma tela não significa que todas as suas etapas estejam integradas ao servidor ou habilitadas em todos os ambientes.

**Navegação:** [jornada principal](#1-a-jornada-principal-do-produto) · [mapa dos módulos](#2-mapa-dos-módulos) · [jornadas por módulo](#3-módulos-e-suas-jornadas) · [capacidades compartilhadas](#4-capacidades-que-conectam-os-módulos) · [exemplos completos](#5-exemplos-de-jornadas-completas) · [diferenciais](#6-diferenciais-e-como-apresentá-los) · [implantação e demonstração](#7-jornada-sugerida-de-implantação-e-demonstração) · [referências](#8-referências-para-manutenção-deste-guia).

## 1 A jornada principal do produto

O ponto de partida é uma conversa ou um contato. O resultado esperado é um relacionamento comercial organizado, com informações verificáveis e uma próxima ação definida.

```text
Conectar o WhatsApp ou importar uma base
                  ↓
Conferir contatos conversas e pendências de leitura
                  ↓
Separar contatos comerciais de contatos pessoais
                  ↓
Preencher e revisar a qualificação disponível
                  ↓
Organizar a oportunidade no funil
                  ↓
Atender agendar e acompanhar o cliente
                  ↓
Registrar o desfecho e avaliar os indicadores
```

Campanhas e automações complementam essa jornada: a campanha trabalha um público selecionado; a automação reage a um acontecimento ou condição. Propostas e financeiro representam a continuidade pretendida da negociação, mas ainda contêm etapas parciais na implementação atual.

### Perfis de utilização

| Perfil | Jornada principal |
| --- | --- |
| Corretor | Localizar clientes, atender, conferir a qualificação, atualizar oportunidades e cumprir os próximos compromissos. |
| Gestor | Acompanhar o atendimento e o funil, distribuir trabalho, ajustar processos e conduzir campanhas e automações conforme as permissões disponíveis. |
| Administrador da imobiliária | Configurar o ambiente, a equipe, as conexões e os recursos liberados para a operação. |
| Administrador global | Consultar e acessar os ambientes pelo Portal Master e administrar a estrutura da plataforma. |
| Leitor | Acompanhar as informações permitidas ao seu perfil; não equivale a um usuário autorizado a publicar campanhas ou regras. |

Os acessos dependem do perfil e das permissões aplicadas em cada módulo. A disponibilidade no menu também pode variar conforme os recursos habilitados para a imobiliária.

### Termos utilizados neste guia

| Termo | Significado prático |
| --- | --- |
| Lead | Contato com potencial interesse comercial. |
| Qualificação | Informações que ajudam a compreender o perfil e a necessidade do cliente. |
| Funil | Sequência de etapas usadas para acompanhar uma oportunidade. |
| VGV | Valor Geral de Vendas; o significado do indicador depende dos negócios e estados considerados, não equivale automaticamente a dinheiro recebido. |
| Etiqueta | Classificação utilizada para organizar ou filtrar contatos. |
| SLA | Prazo ou nível de atendimento que a operação deseja acompanhar. |
| Webhook | Aviso que um provedor envia diretamente ao servidor quando acontece um evento. |
| Processador | Serviço que verifica e executa trabalhos pendentes. |
| Aceito pelo provedor | O serviço de envio confirmou a solicitação; ainda não é confirmação de entrega ao destinatário. |

## 2 Mapa dos módulos

**Como ler a situação atual:** “implementado” indica que há um fluxo funcional no código, não uma certificação de todos os cenários de produção. “Condicionado” indica dependência de conexão, serviço, configuração ou habilitação. “Parcial” identifica etapas locais, de demonstração ou ainda sem integração completa.

| Módulo ou capacidade | Para que serve | Situação atual |
| --- | --- | --- |
| Dashboard e Vendas | Apontar prioridades de atendimento e acompanhar negócios. | Implementado; indicadores dependem da qualidade dos registros. |
| Metas e Performance | Definir objetivos e comparar realizado e planejado. | Parcial; configuração de metas ainda armazenada no navegador. |
| Conexão WhatsApp | Preparar os canais de entrada e atendimento. | Condicionado à extensão ou a uma conexão Z-API operacional. |
| Importação de Contatos e Histórico | Aproveitar a base existente e o histórico disponibilizado. | Implementado, com limites de cobertura e dependências do canal. |
| Inbox WhatsApp | Reunir conversa, cadastro e ações de atendimento. | Implementado; envio pelo CRM depende da Z-API. |
| Leads e Clientes | Organizar e localizar a carteira comercial. | Implementado no núcleo operacional do CRM. |
| Qualificação automática | Transformar informações reconhecidas das conversas em dados do cadastro. | Implementado em leitura básica por regras; IA externa desativada. |
| Funil e Negócios | Acompanhar oportunidades por etapas comerciais. | Implementado, com configuração de processos no servidor. |
| Tarefas e SLAs | Organizar próximos passos e prazos de atendimento. | Tarefas implementadas; convites por e-mail ainda têm etapa simulada. |
| Modelos de Mensagens | Reutilizar textos de atendimento e de comunicação. | Implementado; anexos variam conforme o fluxo de destino. |
| Campanhas em Lote | Conduzir comunicações planejadas para um público selecionado. | Implementado; envio depende de canal, processador e habilitação. |
| Automações e Regras | Executar ações a partir de acontecimentos e critérios. | Implementado; espera, inatividade e envio dependem de processamento periódico. |
| Configurações e Processos Comerciais | Adaptar a operação à imobiliária e à equipe. | Situação mista; processos comerciais têm APIs próprias, outras configurações permanecem legadas. |
| Propostas Comerciais | Estruturar condições de uma negociação. | Parcial; persistência e etapas de aceite/cobrança ainda locais ou demonstrativas. |
| Financeiro e Asaas | Visualizar lançamentos e apoiar a jornada de cobrança. | Parcial na interface; existe integração real de cobrança no backend. |
| Copiloto Comercial | Configurar orientação de atendimento e acessar recursos de análise. | Condicionado; geração contextual externa não está ativa. |
| Portal Master | Administrar o conjunto de ambientes da plataforma. | Catálogo real no banco; parte dos cadastros e indicadores administrativos é local. |

## 3 Módulos e suas jornadas

### 3.1 Dashboard e Vendas

**Objetivo:** ajudar a pessoa a decidir por onde começar o dia.

O painel reúne indicadores de leads e negócios, valor das oportunidades, negócios ganhos, evolução das metas e compromissos. O radar de atendimento destaca conversas sem resposta e oportunidades sem continuidade. É possível sair do indicador e abrir a conversa relacionada.

**Jornada:** abrir o painel → consultar o radar e a agenda → escolher um cliente prioritário → abrir o atendimento → registrar o próximo passo → acompanhar a evolução dos negócios.

**Diferencial:** aproxima os números da ação do corretor. O painel permite chegar ao cliente que precisa de atenção, além de apresentar totais.

**Condição atual:** os valores refletem os registros disponíveis. VGV de oportunidades não equivale a dinheiro recebido. Dados originados de propostas e metas herdam as limitações desses módulos. Contatos marcados como pessoais são excluídos dos principais indicadores comerciais.

### 3.2 Metas e Performance

**Objetivo:** tornar o planejamento comercial visível para a equipe.

A área permite definir metas mensais de VGV, negócios ganhos, leads e clientes, registrar observações, replicar metas para os meses seguintes e configurar um objetivo anual. Há visões de acompanhamento e comparação por mês.

**Jornada:** escolher o período → informar metas realistas → salvar → acompanhar o realizado → revisar as prioridades da equipe.

**Diferencial:** conecta objetivos comerciais ao acompanhamento do funil, com leitura mensal e anual.

**Condição atual:** a configuração é salva no navegador e utiliza valores iniciais quando não há metas próprias. Ainda precisa de persistência central e validação de compartilhamento entre usuários para ser tratada como uma fonte única de planejamento da imobiliária.

### 3.3 Conexão WhatsApp

**Objetivo:** definir como as mensagens chegam ao CRM e quais ações o canal permite.

Existem dois caminhos distintos:

| Caminho | Jornada | O que permite |
| --- | --- | --- |
| Extensão Brokiva | Instalar a extensão oficial → entrar no CRM → parear a conta e o ambiente → abrir o WhatsApp Web → iniciar a sincronização. | Importar o conteúdo que o WhatsApp Web disponibiliza. |
| Z-API | Configurar a conexão da imobiliária → conectar o número → configurar os recebimentos no servidor → conferir o estado do canal. | Receber eventos sem o navegador aberto e enviar pelo CRM, quando o serviço estiver operacional. |

**Diferencial:** atende tanto ao aproveitamento do histórico existente quanto a uma operação conectada ao servidor, sem confundir as duas formas de integração.

**Condição atual:** a extensão exige WhatsApp Web aberto e sessão válida; a renovação do pareamento depende da aba autenticada do CRM. Ela não substitui a Z-API para envio pelo CRM. O recebimento sem navegador depende de uma conexão de provedor ativa, conectada e corretamente configurada.

### 3.4 Importação de Contatos e Histórico

**Objetivo:** permitir que a imobiliária aproveite os contatos e as conversas que já possui.

O produto oferece importação a partir do WhatsApp e de arquivos de agenda, como CSV, VCF e vCard. No fluxo pelo provedor, há prévia e seleção de contatos; na extensão, há leitura da lista e do histórico disponível. Os envios de lotes pela extensão dependem de recibos de gravação do servidor e podem ser retomados quando preservados na fila.

**Jornada:** escolher a origem → selecionar o escopo → iniciar a leitura/importação → acompanhar o progresso → conferir o resultado e as pendências → retomar o que for necessário.

**Diferencial:** o resultado distingue mensagens confirmadas de pendências de leitura. Ausência de conteúdo, autoria ou data verificável e limitações de mídia permanecem visíveis, em vez de uma declaração genérica de importação completa.

**Condição atual:** o WhatsApp pode limitar o histórico disponível na versão Web. Uma imagem com miniatura não comprova que o arquivo original foi importado. Importar uma agenda de contatos não importa, por si só, suas conversas. A leitura interrompida pode precisar ser reiniciada; isso é diferente de retomar lotes já lidos e preservados para envio.

### 3.5 Inbox WhatsApp

**Objetivo:** concentrar o atendimento junto das informações úteis sobre o cliente.

A área reúne conversas, mensagens, informações do contato, qualificação e recursos de organização do atendimento. O histórico pode apresentar texto e os tipos de conteúdo suportados, incluindo mídias, registros de chamadas e cartões de contato, conforme o material efetivamente recebido.

**Jornada:** localizar a conversa → ler o contexto disponível → conferir os dados do cliente → atender pelo canal operacional → atualizar informações e próximos passos.

**Diferencial:** o corretor consulta contexto e cadastro no mesmo fluxo, reduzindo a alternância entre conversa e preenchimento de fichas.

**Condição atual:** mensagens recebidas pelo servidor são persistidas antes da confirmação. Entrega e leitura dependem dos recibos disponíveis. A visualização ou reprodução de um anexo exige um arquivo acessível; o registro da mensagem pode existir sem o original. Registro de chamada não significa gravação da ligação.

### 3.6 Leads e Clientes

**Objetivo:** transformar a agenda de contatos em uma carteira de trabalho organizada.

Há busca por nome, telefone, e-mail e etiquetas; filtros por temperatura, origem, inatividade e tipo de contato; acesso ao atendimento; importação e exportação CSV. O cadastro comporta responsável, informações comerciais, preferências, notas e imóveis apresentados.

**Jornada:** cadastrar ou importar → conferir a identidade → definir se o contato é comercial ou pessoal → atribuir responsável e classificação → complementar o cadastro → abrir a conversa ou oportunidade.

**Diferencial:** diferencia pessoas da agenda pessoal de oportunidades comerciais e reúne a classificação interna com informações trazidas do WhatsApp.

**Condição atual:** os campos existentes no cadastro são mais amplos que os preenchidos automaticamente pela leitura atual. Campo disponível não significa campo já identificado em conversa. Um contato importado também não recebe autorização automática para campanhas.

### 3.7 Qualificação automática de leads

**Objetivo:** reduzir o trabalho de transcrever para o cadastro o que o cliente já informou no atendimento.

O fluxo atual pode preencher **renda mensal, entrada disponível, orçamento máximo, tipo de imóvel, regiões e e-mail**, quando reconhece uma afirmação explícita e verificável. Mantém a mensagem de origem e o trecho que fundamenta o dado. Também oferece classificação da conversa e estados de acompanhamento da análise.

**Jornada:** importar ou receber mensagens → registrar a conversa na fila de análise → reconhecer os fatos → preencher os campos permitidos → apresentar diferenças para revisão → continuar o histórico ou novas mensagens em execuções posteriores.

**Diferenciais:**

- O progresso fica no servidor e pode continuar em outra execução.
- A análise utiliza somente o histórico realmente disponível.
- Dados editados pela equipe são protegidos, inclusive quando a pessoa limpa um campo.
- Divergências são apresentadas para revisão pontual, com sua evidência.
- Uma falha permanece pendente, com nova tentativa, sem se transformar em uma análise concluída artificialmente.

**Condição atual:** o modo ativo é **leitura básica por regras, sem Gemini e sem outro provedor externo de IA**. Exemplos, mensagens encaminhadas, ambiguidades e informações sem evidência suficiente não devem virar fatos do cliente. O cadastro não representa uma aprovação de financiamento. O agendador dedicado permite continuar a qualificação sem a tela do CRM aberta; ele não recupera mensagens que nunca chegaram ao servidor e não é o processador de envios de campanhas.

### 3.8 Funil e Negócios

**Objetivo:** mostrar em que ponto cada oportunidade está e o que falta para avançar.

O quadro organiza negócios em etapas configuráveis, com movimentação de cartões, edição de detalhes, responsável, valor esperado e registro de ganho ou perda. Há suporte a múltiplos funis, configuração de etapas e motivos de perda, além de transferência de uma oportunidade entre processos.

**Jornada:** criar a oportunidade a partir do cliente → escolher o funil → registrar valor e contexto → avançar as etapas conforme o atendimento → registrar o desfecho e, quando aplicável, o motivo de perda.

**Diferencial:** permite adaptar o processo à forma de vender da imobiliária e relacionar o avanço comercial ao histórico do cliente.

**Condição atual:** a etapa precisa refletir um acontecimento real. Mover um cartão não comprova assinatura contratual nem recebimento financeiro. Os resultados do painel dependem desse cuidado de registro.

### 3.9 Tarefas e SLAs

**Objetivo:** garantir que o próximo compromisso comercial tenha prazo e responsável.

O módulo permite criar, editar, concluir e excluir tarefas, vincular compromissos ao cliente e organizar a agenda. Há recursos de convite e geração de arquivo de calendário `.ics`. O radar de inatividade complementa essa organização ao indicar clientes sem continuidade.

**Jornada:** identificar a próxima ação → definir o compromisso e o responsável → escolher data e horário → acompanhar na agenda → executar → concluir ou reagendar.

**Diferencial:** transforma uma intenção de acompanhamento em uma ação visível. Automações também podem criar tarefas e preparar mensagens para revisão.

**Condição atual:** as tarefas têm API e persistência no servidor. O arquivo `.ics` é gerado, mas a rota de convite por e-mail ainda simula o disparo; a mensagem de sucesso dessa etapa não comprova entrega de convite. Acompanhamento de prazo e radar não equivalem, por si só, a uma garantia contratual de SLA.

### 3.10 Modelos de Mensagens

**Objetivo:** facilitar a comunicação repetitiva sem exigir que a equipe reescreva tudo.

A biblioteca permite organizar, buscar, criar e editar modelos. Os textos podem ser aproveitados no atendimento, em campanhas e nas ações permitidas das automações. Há recursos de personalização com informações como nome do cliente, empresa e corretor.

**Jornada:** criar ou escolher um modelo → adaptar a linguagem → inserir no fluxo de atendimento ou comunicação → conferir o conteúdo → utilizar.

**Diferencial:** padroniza o ponto de partida, mantendo a possibilidade de adaptação por quem atende.

**Condição atual:** campanhas e regras recebem uma cópia do texto. Alterar o modelo original não muda automaticamente uma campanha já iniciada nem a versão publicada de uma regra. O suporte a anexo depende do destino: nas campanhas o arquivo precisa ser escolhido e conferido; as automações atuais enviam texto.

### 3.11 Campanhas em Lote

**Objetivo:** organizar uma comunicação planejada para um conjunto conhecido de clientes.

O assistente conduz a definição do objetivo, do público, das mensagens, do momento de envio e da revisão. O público pode combinar origem, etapa, responsável, etiquetas, região, orçamento e interesse, ou ser selecionado manualmente. A revisão informa quem pode participar e por que outros contatos foram excluídos.

**Jornada:** criar o rascunho → selecionar o público → montar as mensagens → conferir anexos e horários → simular sem envio → confirmar a quantidade de destinatários → iniciar → acompanhar resultados → pausar, retomar ou cancelar pendentes.

**Mensagens em sequência:**

- Uma campanha pode ter **de uma a cinco mensagens**, enviadas em ordem para cada destinatário.
- Ao adicionar uma nova mensagem, o editor recolhe a anterior e abre a nova. Cada bloco pode ser expandido novamente.
- O intervalo padrão é de **30 segundos**, ajustável entre **15 e 3.600 segundos**.
- O prazo é mínimo e começa após a confirmação da parte anterior pelo provedor. A fila e o processador podem aumentar a espera.
- Resposta do cliente ou atendimento posterior da equipe interrompem as próximas partes para permitir a continuidade humana.

**Anexos:** imagens JPG, PNG e WebP e documentos PDF até 10 MB; vídeos MP4 até 25 MB. Não há conversão automática de vídeo. O armazenamento de arquivos exige configuração própria.

**Acompanhamento:** o painel apresenta resultados por destinatário e por parte da sequência, incluindo aguardando, enviando, aceito pelo provedor, entregue, lido, falha e necessidade de conferência. Os indicadores principais contam contatos, sem multiplicar o público pela quantidade de partes.

**Diferencial:** permite construir uma conversa em partes, revisar o público antes do envio e acompanhar a execução com controles de pausa e cancelamento.

**Condição atual:** exige autorização registrada, telefone válido, conexão Z-API, habilitação e processador de envios operacional. A simulação não envia mensagens. Uma mensagem aceita pelo provedor ainda pode não ter sido entregue. Um despacho já iniciado pode concluir mesmo depois de pausar ou cancelar; um resultado incerto precisa de conferência antes de um novo envio. O agendador dedicado da qualificação não habilita esse processamento de mensagens.

### 3.12 Automações e Regras

**Objetivo:** reduzir tarefas repetitivas com regras compreensíveis e revisáveis.

O assistente tem cinco passos: **objetivo, critérios, ações, horários e conferência**. Os modelos iniciais são sugestões editáveis. A pessoa pode criar, editar, duplicar, testar, publicar, pausar e arquivar uma regra, conforme seu perfil.

As ações disponíveis incluem criar tarefa, preparar mensagem para revisão, adicionar etiqueta, distribuir contatos entre responsáveis selecionados e enviar texto por um canal operacional. Os gatilhos incluem acontecimentos como cadastro, mudança de etapa, recebimento de mensagem e inatividade, respeitando as condições do fluxo.

**Jornada:** escolher a situação que merece ação → definir quem atende aos critérios → escolher a ação → ajustar horários → testar sem efeitos reais → publicar → acompanhar o histórico → revisar ou pausar quando necessário.

**Diferencial:** combina facilidade de configuração com teste obrigatório da revisão atual, versionamento e histórico. A edição de uma regra ativa não substitui silenciosamente a versão publicada.

**Condição atual:** a publicação vale para novos acontecimentos; importar conversas antigas não inicia abordagens retroativas. Criar tarefas e adicionar etiquetas sem espera pode ocorrer no próprio evento. Inatividade, espera por horário e envio externo exigem processamento periódico próprio. Preparar uma mensagem para revisão não significa enviá-la. O envio automático atual suporta texto, não anexos.

### 3.13 Configurações e Processos Comerciais

**Objetivo:** adaptar o CRM à organização da imobiliária.

A área reúne configurações de empresa, equipe, conexões, horários, parâmetros de atendimento e recursos de análise. A configuração comercial permite administrar funis, etapas, origens, grupos de origem e motivos de perda.

**Jornada:** organizar a equipe e os responsáveis → definir os processos de venda → cadastrar origens e motivos de perda → conferir canais e horários → orientar o uso dos módulos no dia a dia.

**Diferencial:** permite que o processo comercial seja editável e evolua com a operação, em vez de depender apenas de uma configuração fixa inicial.

**Condição atual:** processos comerciais possuem APIs e persistência central. Outras configurações e rotinas administrativas ainda misturam estado local e fluxos legados; a existência de um formulário não comprova atualização persistente em todos os dispositivos. Convites, alterações de usuários e permissões precisam ser conferidos no fluxo correspondente. Alterar uma preferência de IA na tela não supera o bloqueio de provedores externos definido no servidor.

### 3.14 Propostas Comerciais

**Objetivo:** reunir as condições negociadas de uma oportunidade.

A interface permite montar uma proposta vinculada ao cliente e, quando disponível, ao negócio. Há campos de empreendimento, unidade, endereço, valor total, entrada, parcelas, balões, financiamento e divisão de comissão. Também existe uma apresentação de proposta e um fluxo visual de aceite.

**Jornada existente na interface:** escolher o cliente → informar o imóvel e as condições → conferir os valores → salvar e visualizar a proposta → acompanhar seu estado.

**Diferencial pretendido:** aproveitar o contexto do cliente e da oportunidade para diminuir a redigitação na formalização da negociação.

**Condição atual:** propostas são armazenadas localmente e podem iniciar com dados de demonstração. Links e informações de pagamento contêm etapas demonstrativas. O aceite pela interface pode alterar estados internos, inclusive lançamentos e etapa do negócio vinculado, mas isso não comprova assinatura nem liquidação. O módulo não deve ser tratado como uma jornada pública completa de aceite, assinatura eletrônica ou confirmação de pagamento. Sua continuidade exige persistência no servidor e integração real de cada etapa externa.

### 3.15 Financeiro e Asaas

**Objetivo:** aproximar o acompanhamento comercial dos valores a receber e das comissões.

A interface apresenta lançamentos, categorias, responsáveis, vencimentos e estados como pendente, pago e vencido. Há registros de entrada, parcelas, balões e comissões. No backend, existe uma integração real para criar cobranças Asaas com credenciais da própria imobiliária e referência da operação.

**Jornada existente na interface:** consultar lançamentos → filtrar cliente, categoria ou situação → registrar ou atualizar um lançamento → acompanhar os totais.

**Diferencial pretendido:** relacionar negociação, cobrança e comissão em um mesmo produto.

**Condição atual:** os lançamentos da tela ainda são locais e podem usar dados demonstrativos. O comando de sincronização do painel não executa uma conciliação real; o recebimento do webhook Asaas ainda não fecha esse ciclo de atualização persistente. O endpoint real de cobrança não torna automaticamente toda a interface financeira integrada. O ambiente padrão da integração é de testes; uso real exige configuração e validação próprias.

### 3.16 Copiloto Comercial

**Objetivo:** apoiar a organização da abordagem comercial e dos recursos de análise.

A interface reúne configurações de persona, tom, objetivo e orientações de atendimento, além de ferramentas de análise associadas às conversas. É acessível por uma área própria, separada da rotina principal de cadastro.

**Jornada:** definir a orientação de atendimento → abrir o contexto do cliente → consultar a análise disponível → conferir as informações antes de utilizá-las na conversa.

**Diferencial pretendido:** combinar contexto do cliente com o estilo de atendimento da equipe.

**Condição atual:** Gemini e os demais provedores externos estão desativados. As configurações e telas existentes não significam que geração de respostas, interpretação generativa ou atendimento autônomo estejam ativos. A capacidade operacional atual a destacar é a qualificação básica por regras, com suas evidências e limites.

### 3.17 Portal Master

**Objetivo:** organizar a visão global da plataforma e o acesso aos ambientes.

O portal oferece áreas de ambientes produtivos, painel estratégico, planos, administradores globais, configurações de APIs e proposta/provisionamento. O catálogo de ambientes é consultado no banco, incluindo os diferentes estados cadastrais, e permite entrar no contexto de uma imobiliária.

**Jornada validada para o catálogo:** autenticar como administrador global → consultar ou atualizar a lista → localizar a imobiliária → entrar no ambiente correto → retornar à visão global quando necessário.

**Diferencial:** separa a administração da plataforma da rotina de atendimento de cada imobiliária.

**Condição atual:** o catálogo e a identificação dos ambientes usam dados reais do servidor. Parte das informações contratuais, planos, provisionamento, administradores e indicadores financeiros permanece em estruturas locais ou de demonstração. Não devem ser apresentados como faturamento recorrente conciliado nem como provisionamento integral já automatizado.

## 4 Capacidades que conectam os módulos

### Etiquetas do WhatsApp e etiquetas internas

As etiquetas do WhatsApp Business e as classificações internas do CRM podem participar da organização e da segmentação. No público de campanhas, o sistema normaliza os nomes e preserva a origem da etiqueta, permitindo identificar se veio do WhatsApp, do CRM ou dos dois.

**Jornada:** importar as etiquetas disponíveis → conferir sua identificação → utilizar na busca e na segmentação → revisar a quantidade de contatos elegíveis.

Campanhas consultam as etiquetas já armazenadas no CRM. Não fazem uma leitura ao vivo do WhatsApp a cada seleção. Uma importação parcial não garante espelhamento de todas as exclusões e renomeações realizadas no telefone. Etiquetas técnicas não devem ser confundidas com critérios comerciais.

### Preferências de comunicação

O fluxo de campanhas mantém um registro específico da autorização, com origem, data e responsável. Pedidos reconhecidos de interrupção, como “SAIR” ou “não quero receber mensagens”, bloqueiam comunicações automáticas posteriores conforme o registro recebido.

**Jornada:** registrar uma autorização real → revisar a elegibilidade → respeitar alterações de preferência → conferir novamente antes de cada envio.

Importar uma lista, receber uma mensagem ou encontrar um campo antigo de consentimento preenchido não libera automaticamente uma campanha. Esses controles apoiam a operação e não constituem uma certificação jurídica do tratamento de dados.

### Continuidade e acompanhamento técnico

O núcleo operacional grava contatos, conversas, mensagens e oportunidades no servidor. Importações, qualificação e envios possuem controles próprios de progresso e retomada; eles não têm o mesmo comportamento.

| Processo | O que precisa permanecer disponível |
| --- | --- |
| Leitura pela extensão | WhatsApp Web aberto e sessão válida; a renovação exige o CRM autenticado. |
| Importação paginada pelo CRM | Uma aba ativa para continuar avançando as páginas; o progresso já gravado pode ser recuperado. |
| Recebimento por webhook | Provedor conectado e servidor disponível; não depende de uma aba do corretor aberta. |
| Qualificação periódica | Histórico no servidor e agendador operacional; não depende da tela aberta. |
| Campanhas e ações externas de automação | Canal operacional, autorizações, habilitações e processador de envios próprio. |

O agendador dedicado de qualificação foi habilitado na AWS e confirmou doze ciclos automáticos consecutivos na validação operacional de 2 de novembro de 2026. O cron anterior da qualificação foi retirado do GitHub, mantendo uma alternativa manual. A assinatura do canal de alertas por e-mail ainda aguarda confirmação; os alarmes permanecem disponíveis no painel AWS. Essa implantação não ativa o processador de campanhas ou de automações de envio.

### Privacidade e limites administrativos

Os fluxos revisados aplicam autenticação e contexto da imobiliária. Há também rotas de exportação e anonimização no projeto, mas elas ainda utilizam uma estrutura legada de armazenamento. Sua existência não comprova exportação completa nem eliminação integral dos dados persistidos. Esses recursos precisam de revisão própria antes de uma apresentação como jornada completa de atendimento a solicitações de titulares.

## 5 Exemplos de jornadas completas

Os exemplos abaixo são ilustrativos e não representam contatos ou negociações reais.

### Jornada do corretor que começa o dia

1. Abrir **Dashboard e Vendas** e consultar o radar e os compromissos.
2. Escolher um cliente com atendimento pendente e abrir o **Inbox**.
3. Ler o histórico disponível e conferir a **qualificação** e suas diferenças.
4. Completar somente as informações necessárias e atender pelo canal operacional.
5. Atualizar a oportunidade no **Funil**.
6. Criar uma **tarefa** com o próximo compromisso e concluir a ação anterior.

**Valor entregue:** menos procura por informações e maior clareza sobre quem atender e o que fazer depois.

### Jornada da conversa que vira cadastro comercial

1. Importar ou receber uma conversa de um interessado em imóvel.
2. O servidor registra as mensagens e coloca a conversa na fila de qualificação.
3. A leitura reconhece os fatos explícitos suportados e conserva suas evidências.
4. Campos livres podem ser preenchidos; diferenças com dados humanos ficam para revisão.
5. O corretor confere o resultado e cria ou atualiza a oportunidade.

**Valor entregue:** reaproveitar dados já informados pelo cliente, mantendo a equipe no controle de correções e decisões.

### Jornada de uma campanha com vídeo

1. Selecionar contatos por uma etiqueta comercial já importada e por outros critérios necessários.
2. Conferir as autorizações e os motivos de exclusão.
3. Criar uma primeira mensagem de apresentação, uma segunda com vídeo e uma terceira com convite para conversar.
4. Definir o intervalo mínimo e conferir a prévia dos três blocos.
5. Simular sem envio e confirmar o público revisado.
6. Com canal e processador operacionais, iniciar e acompanhar os resultados.
7. Se o cliente responder, interromper as próximas partes e continuar o atendimento humano.

**Valor entregue:** uma abordagem em partes, com revisão, acompanhamento e espaço para a resposta do cliente. A sequência não obriga o destinatário a receber todas as partes depois de uma nova interação.

### Jornada do gestor que cria uma automação

1. Escolher o objetivo de criar um lembrete para um novo contato comercial.
2. Definir os critérios e quem será o responsável.
3. Configurar prazo, ação e horário.
4. Executar o teste isolado e conferir o resultado.
5. Publicar a revisão e acompanhar os novos acontecimentos no histórico.
6. Ajustar o rascunho e testar novamente antes de substituir a versão ativa.

**Valor entregue:** consistência de acompanhamento com uma configuração que pode ser entendida e revisada pelo gestor.

## 6 Diferenciais e como apresentá-los

| Diferencial | Benefício para a pessoa | Formulação fiel à situação atual |
| --- | --- | --- |
| Conversa ligada ao cadastro | Menos redigitação durante o atendimento. | “Informações explícitas reconhecidas nas conversas podem preencher o cadastro, com evidência e revisão.” |
| Proteção da edição humana | O corretor mantém o controle sobre o que corrigiu. | “Diferenças com dados preenchidos pela equipe são apresentadas para revisão.” |
| Atendimento ligado ao funil e à agenda | Contexto e próximos passos ficam próximos. | “Da conversa, a equipe consegue organizar a oportunidade e seu acompanhamento.” |
| Contatos pessoais separados | A carteira comercial fica mais útil para priorização. | “Contatos pessoais podem ser identificados e excluídos de fluxos e indicadores comerciais.” |
| Etiquetas de duas origens | Segmentação aproveita o trabalho já feito no WhatsApp e no CRM. | “O público utiliza as etiquetas importadas e as classificações internas disponíveis.” |
| Campanhas em partes | Mensagens mais fáceis de acompanhar e revisar. | “Até cinco mensagens sequenciais, com intervalo mínimo e interrupção após nova interação.” |
| Teste antes da publicação | A pessoa pode conferir o resultado antes de executar. | “Campanhas e automações possuem simulação sem envio, seguida de confirmação.” |
| Pendências visíveis | O usuário distingue conclusão de resultado incerto. | “Importações e envios informam o que foi confirmado e o que ainda exige conferência.” |

O produto deve ser apresentado pela combinação desses recursos e pela redução de trabalho operacional. Ganho de conversão, retorno financeiro, importação integral de histórico, recuperação de todas as mídias e disponibilidade contínua de provedores não são resultados automaticamente comprovados pela existência das funcionalidades.

## 7 Jornada sugerida de implantação e demonstração

Para uma pessoa com pouca familiaridade tecnológica, a apresentação pode começar com uma única tarefa e um único cliente, ampliando o uso aos poucos.

1. **Primeiro contato:** mostrar onde estão o cliente, a conversa e o próximo compromisso.
2. **Organização:** explicar a diferença entre contato pessoal, cliente e oportunidade.
3. **Qualificação:** demonstrar um fato reconhecido e como conferir sua mensagem de origem.
4. **Acompanhamento:** avançar um negócio e registrar uma tarefa.
5. **Gestão:** apresentar o radar e os indicadores relacionados àquelas ações.
6. **Comunicação planejada:** montar uma campanha de exemplo e utilizar somente a simulação na demonstração inicial.
7. **Rotina padronizada:** criar uma automação simples de tarefa, testar e explicar sua publicação para novos eventos.

Antes de utilizar recursos externos, a implantação precisa conferir conexão, permissões, habilitações, armazenamento de anexos e o processador correspondente. Propostas, financeiro e rotinas administrativas parciais devem ser apresentados com seu estágio atual explícito.

## 8 Referências para manutenção deste guia

As referências abaixo permitem atualizar o documento quando uma jornada ou condição operacional mudar. São fontes de implementação; a validação em produção deve ser registrada separadamente.

| Assunto | Referências no projeto |
| --- | --- |
| Operação e limites de integração | [README](../README.md) |
| Navegação e módulos disponíveis | [Página principal](../src/app/page.tsx), [menu lateral](../src/components/layout/Sidebar.tsx) e [cabeçalho](../src/components/layout/Header.tsx) |
| Dashboard e metas | [Dashboard](../src/components/dashboard/SalesDashboard.tsx) e [metas](../src/components/goals/GoalsManager.tsx) |
| Conexão e importação | [Conexão WhatsApp](../src/components/whatsapp/WhatsAppConnectionView.tsx), [importação](../src/components/whatsapp/WhatsAppImportView.tsx) e [importação de arquivos](../src/components/contacts/ImportLeadsModal.tsx) |
| Atendimento e contatos | [Inbox](../src/components/inbox/WhatsAppInbox.tsx) e [Leads e Clientes](../src/components/contacts/ContactsList.tsx) |
| Qualificação e modo de análise | [Motor de qualificação](../src/lib/lead-qualification.ts), [serviço](../src/lib/lead-qualification-service.ts), [acompanhamento](../src/components/crm/LeadQualificationStatus.tsx) e [política de IA](../src/lib/ai-execution-policy.ts) |
| Funil e processos | [Quadro de negócios](../src/components/crm/KanbanBoard.tsx) e [configuração comercial](../src/components/settings/CommercialProcessesSettings.tsx) |
| Tarefas e convites | [Tarefas](../src/components/tasks/TasksManager.tsx) e [rota de convites](../src/app/api/v1/calendar/invite/route.ts) |
| Modelos | [Biblioteca de mensagens](../src/components/templates/MessageTemplatesModal.tsx) |
| Campanhas e etiquetas | [Campanhas](../src/components/campaigns/CampaignManager.tsx), [editor de sequência](../src/components/campaigns/CampaignSequenceEditor.tsx) e [normalização de etiquetas](../src/lib/contact-labels.ts) |
| Automações | [Assistente](../src/components/automations/AutomationManager.tsx) e [processamento](../src/lib/automation-service.ts) |
| Propostas financeiro e persistência local | [Propostas](../src/components/proposals/ProposalManager.tsx), [financeiro](../src/components/financial/FinancialDashboard.tsx) e [contexto do CRM](../src/lib/crm-context.tsx) |
| Integração de cobrança | [Criação de cobrança](../src/app/api/v1/asaas/create-payment/route.ts) e [webhook](../src/app/api/v1/asaas/webhook/route.ts) |
| Copiloto e administração | [Copiloto](../src/components/copilot/CopilotManager.tsx), [configurações](../src/components/settings/SettingsManager.tsx) e [Portal Master](../src/components/saas-master/SaaSAdminHub.tsx) |
| Privacidade e armazenamento | [Exportação](../src/app/api/v1/lgpd/export/route.ts), [anonimização](../src/app/api/v1/lgpd/anonymize/route.ts) e [repositório operacional](../src/lib/crm-repository.ts) |
| Agendador da qualificação | [Implantação e acompanhamento](../infra/qualification_scheduler/README.md) |

Ao revisar este guia, atualize as jornadas, a tabela de situação atual e as dependências em conjunto. Uma função deve mudar de “parcial” para “implementada” somente quando sua continuidade real estiver disponível, e não apenas quando uma nova tela for adicionada.
