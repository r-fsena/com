# Brokiva — extensão para WhatsApp Web

Versão **1.0.60**. Importa mensagens disponibilizadas pelo WhatsApp Web para a imobiliária pareada no CRM. A leitura exige o WhatsApp Web aberto; não substitui uma conexão de servidor para receber com o navegador fechado.

## Instalação e pareamento

1. Publique primeiro o backend com o protocolo de recibos de importação 2. `OPTIONS /api/v1/sync/extension-history` deve retornar `X-Brokiva-Import-Protocol: 2` e `X-Brokiva-Import-Revision: 20261029.3`, que aceita chamadas e cartões de contato.
2. Em `chrome://extensions`, ative o modo de desenvolvedor e carregue esta pasta. Se já estiver instalada, recarregue a Brokiva.
3. Recarregue também o WhatsApp Web e as abas do CRM já abertas para carregar os scripts novos.
4. No popup, clique em **Entrar e parear no CRM**, autentique-se e confira a imobiliária e o corretor. A sessão dura 15 minutos e a aba autenticada do CRM a renova. Trocar de imobiliária exige pareamento explícito.

## Atualização e renovação da sessão

Ao recarregar uma extensão descompactada, o Chrome trata a operação como atualização ([documentação do runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime)). As abas antigas do CRM precisam ser recarregadas. Se o contexto da extensão for invalidado, a ponte encerra temporizadores/listeners, aborta consultas em andamento e mostra **Recarregar CRM**, preservando os envios pendentes. A ponte antiga não continua tentando chamar APIs invalidadas.

A atualização mantém a identidade da conta/imobiliária e a fila mesmo se o token expirou. Com uma aba autenticada do CRM visível na mesma identidade, a renovação pode retomar sem depender do marcador `isPaired` removido na expiração. **Sair** da extensão remove essa identidade e exige pareamento explícito. Outra conta ou imobiliária não toma o lugar da conexão automaticamente.

O parâmetro `pairExtension=1` só é removido da URL depois que o serviço da extensão confirma o pareamento. Falha na confirmação mantém a solicitação para nova tentativa. A renovação tem timeout, confere o contexto novamente após a emissão do token e não sobrepõe execuções periódicas.

## Leitura e importação

- **Importar Lista de Conversas** percorre a lista aberta no WhatsApp sem corte de data. Arquivadas e filtros precisam ser conferidos separadamente.
- **Sincronizar Recentes** limita a seleção às 60 conversas encontradas no topo da lista; a profundidade de leitura de cada conversa continua sendo verificada.
- **Salvar Histórico Desta Conversa** lê somente a conversa aberta.
- Mantenha a conversa selecionada durante a leitura. A extensão interrompe se a identidade ou o ambiente mudar. Conversas com o mesmo nome não são deduplicadas pelo nome.
- A rolagem preserva sobreposição entre páginas virtualizadas e aguarda carregamentos. Estabilidade sem confirmação do início disponível resulta em **leitura parcial**, não em sucesso completo. Há limites de proteção de 1.600 etapas/20 minutos por conversa e 4.000 etapas por lista; atingir um limite é informado como pendência.
- IDs e direção vêm das mensagens reais do WhatsApp. Números, horários digitados, emojis e textos repetidos são preservados. Não se cria uma mensagem a partir da prévia da lista, nem um telefone a partir do nome.
- Sem ID, telefone ou data verificáveis, a mensagem/conversa fica indicada como pendente de leitura; não se atribui o conteúdo a um contato por aproximação. O cache nativo complementa o DOM e não é apresentado como histórico completo.

## Compatibilidade com o formato atual do WhatsApp

A versão 1.0.60 também lê mensagens cujo `data-id` contém somente o ID hexadecimal e cujo balão não usa as classes antigas `message-in/message-out`. O telefone é confirmado na gaveta de dados do contato, e a continuidade entre páginas é conferida pelos IDs que se sobrepõem durante a rolagem. A direção usa o remetente dos metadados e indicadores explícitos do balão; autoria ambígua fica pendente. O ID original é mantido na chave normalizada usada para deduplicar no CRM.

A ponte nativa prioriza as instâncias de `WAWebCollections`, sem confundir classes antigas com coleções carregadas. Aceita WIDs com `_serialized`, `$1` ou `user/server`, e usa somente o mapeamento local do WhatsApp para relacionar LID e telefone. Direções conflitantes, outro destinatário e datas inválidas são rejeitados. A confirmação nativa remove apenas a pendência do mesmo ID recuperado; não apaga pendências de outras mensagens nem comprova o início do histórico.

Chamadas (`call_log`) são importadas como `CALL`, com ID, direção e data do WhatsApp; o registro não presume atendimento, duração ou gravação. Cartões (`vcard` e `multi_vcard`) entram como `CONTACT_CARD`, preservando o conteúdo completo de cada vCard. Cartões incompletos continuam pendentes. Esses registros não são contados como arquivos de mídia. O CRM exibe cartões em uma seção expansível e mantém a deduplicação por ID.

O controle “Clique neste aviso para carregar mensagens mais antigas do seu celular” é acionado com espera e tentativas limitadas. O resultado da importação individual também fica salvo em **Última importação**, no popup e na barra da Brokiva no WhatsApp, incluindo os motivos de pendência. Ele é recuperado ao renovar a sessão e não depende de um alerta transitório.

O relatório informa quantidades por ID nas pendências visuais e classifica as falhas da leitura nativa (identidade, data, formato, conteúdo e itens ainda cifrados). Um item pode aparecer em mais de uma categoria: as quantidades de pendência não são somadas como mensagens únicas. A seção **Formatos pendentes — detalhes para suporte** identifica os tipos não suportados, sem incluir conteúdo ou telefone. Miniaturas, inclusive com URL HTTPS, continuam marcadas como prévia; localização não é contada como arquivo de mídia ausente. A confirmação de registros não equivale ao arquivamento dos arquivos originais. O alerta final direciona ao relatório persistente, sem afirmar que uma nova leitura resolverá toda pendência.

Quebras de linha representadas por elementos `br` são preservadas antes de copiar o texto do balão. O teste de regressão cobre mensagens em múltiplas linhas.

O título vem prioritariamente de `conversation-info-header-chat-title`, excluindo controles injetados pela própria Brokiva. Isso impede que “Sincronizar Histórico” seja tratado como nome do cliente.

## Histórico anterior ao que aparece na tela

Depois da rolagem, a extensão tenta carregar páginas anteriores pelo `WAWebChatLoadMessages.loadEarlierMsgs({ chat })`, sempre no chat cujo telefone foi confirmado. Se não houver progresso, pode solicitar uma vez dados ao dispositivo vinculado por `WAWebSendNonMessageDataRequest.sendPeerDataOperationRequest(3, { chatId })`, somente quando o WhatsApp informa `endOfHistoryTransferType === 0`. O pedido é de sincronização de dados; não envia mensagem ao contato. Referências primárias: [paginação em Chat.fetchMessages](https://github.com/wwebjs/whatsapp-web.js/blob/main/src/structures/Chat.js) e [Client.syncHistory](https://github.com/wwebjs/whatsapp-web.js/blob/main/src/Client.js).

As páginas têm sobreposição deduplicada, pausa entre consultas e checkpoint antes de avançar. A identidade continua sendo conferida após cada resposta. Há até 200 consultas nativas, orçamento de 20 minutos por conversa e reserva de tempo para a busca nativa após a rolagem. Um timeout encerra a espera sem iniciar outra operação concorrente; cancelamento não publica a página que chegou depois. O pedido ao dispositivo não é repetido continuamente.

Resposta vazia, recusa ou pedido aceito sem entrega não comprovam o início do histórico. O relatório diferencia mecanismo indisponível, pedido não confirmado e histórico solicitado ainda pendente. A disponibilidade dos dados antigos continua dependendo do WhatsApp. A contagem de falhas nativas usa IDs entre páginas; quando um item não tem ID, é apresentada como contagem mínima.

## Gravação e retomada

As mensagens verificadas são salvas em checkpoints durante a leitura. Uma correção de data, tipo ou conteúdo do mesmo ID também é salva no próximo checkpoint; mensagens inalteradas não precisam ser reenviadas ao final. Cada envio é dividido em lotes de até 150 mensagens/384 KiB, guardados em `chrome.storage.local` **antes** da chamada ao servidor. A fila é limitada a 6 MiB; se não houver espaço, a importação para e informa a pendência, sem sobrescrever a fila anterior.

O CRM precisa confirmar, após o commit, o identificador do lote, a imobiliária e todos os IDs enviados. HTTP 200 sem esse recibo não conta como sucesso. Reentregas usam os mesmos IDs e atualizam o mesmo histórico. Queda de rede, timeout, 401 e 429 preservam a fila. A extensão tenta novamente por alarme enquanto o navegador está funcionando e a sessão é válida; novo pareamento também permite retomar os envios da mesma conta. Lotes de outra conta permanecem retidos e não são transmitidos à imobiliária atual.

No popup, confira **mensagens pendentes**, use **Retomar envios** após entrar novamente no CRM e consulte **Última importação** para ver as conversas com pendências. Cancelar preserva os lotes já guardados/confirmados; uma leitura interrompida precisa ser iniciada novamente, e os IDs impedem duplicação. Se uma conversa ainda estava sendo lida antes do próximo checkpoint quando a aba fechou, essa parte precisará ser relida.

**Limites do WhatsApp:** mensagens que ele não disponibiliza, histórico anterior restrito ao celular e arquivos de mídia indisponíveis não podem ser inventados ou recuperados pela extensão. Um registro de áudio/foto sem arquivo utilizável é informado como pendência; uma miniatura não equivale ao arquivo original. Não remova a extensão nem limpe seu armazenamento enquanto houver envios pendentes.

## Verificação de desenvolvimento

```sh
npm ci
npm test
npm run check
```

Os testes usam HTML sintético (jsdom), fila/worker com falhas controladas e paginação virtual simulada. Não acessam mensagens reais nem enviam mensagens a contatos. Cobrem identidade, homônimos, conteúdo, citações, IDs repetidos, retomada, quota, sessão expirada, timeout após commit e recibo incompleto. O backend tem testes complementares de transação, concorrência e rollback em PostgreSQL embarcado.

Fonte oficial: `https://github.com/r-fsena/brokiva-chrome-extension`, branch `main`. Depois da validação, commit/push neste repositório. O CRM gera ZIP e espelho com `python3 scripts/package-extension.py`; `node_modules` e testes não são distribuídos no ZIP.
