# Brokiva — extensão para WhatsApp Web

Versão **1.0.53**. Importa mensagens disponibilizadas pelo WhatsApp Web para a imobiliária pareada no CRM. A leitura exige o WhatsApp Web aberto; não substitui uma conexão de servidor para receber com o navegador fechado.

## Instalação e pareamento

1. Publique primeiro o backend com o protocolo de recibos de importação 2. `OPTIONS /api/v1/sync/extension-history` deve retornar `X-Brokiva-Import-Protocol: 2`.
2. Em `chrome://extensions`, ative o modo de desenvolvedor e carregue esta pasta. Se já estiver instalada, recarregue a Brokiva.
3. Recarregue também a aba do WhatsApp Web para carregar o coletor novo.
4. No popup, clique em **Entrar e parear no CRM**, autentique-se e confira a imobiliária e o corretor. A sessão dura 15 minutos e a aba autenticada do CRM a renova. Trocar de imobiliária exige pareamento explícito.

## Leitura e importação

- **Importar Lista de Conversas** percorre a lista aberta no WhatsApp sem corte de data. Arquivadas e filtros precisam ser conferidos separadamente.
- **Sincronizar Recentes** limita a seleção às 60 conversas encontradas no topo da lista; a profundidade de leitura de cada conversa continua sendo verificada.
- **Salvar Histórico Desta Conversa** lê somente a conversa aberta.
- Mantenha a conversa selecionada durante a leitura. A extensão interrompe se a identidade ou o ambiente mudar. Conversas com o mesmo nome não são deduplicadas pelo nome.
- A rolagem preserva sobreposição entre páginas virtualizadas e aguarda carregamentos. Estabilidade sem confirmação do início disponível resulta em **leitura parcial**, não em sucesso completo. Há limites de proteção de 1.600 etapas/20 minutos por conversa e 4.000 etapas por lista; atingir um limite é informado como pendência.
- IDs e direção vêm das mensagens reais do WhatsApp. Números, horários digitados, emojis e textos repetidos são preservados. Não se cria uma mensagem a partir da prévia da lista, nem um telefone a partir do nome.
- Sem ID, telefone ou data verificáveis, a mensagem/conversa fica indicada como pendente de leitura; não se atribui o conteúdo a um contato por aproximação. O cache nativo complementa o DOM e não é apresentado como histórico completo.

## Compatibilidade com o formato atual do WhatsApp

A versão 1.0.53 também lê mensagens cujo `data-id` contém somente o ID hexadecimal e cujo balão não usa as classes antigas `message-in/message-out`. O telefone é confirmado na gaveta de dados do contato, e a continuidade entre páginas é conferida pelos IDs que se sobrepõem durante a rolagem. A direção usa o remetente dos metadados e indicadores explícitos do balão; autoria ambígua fica pendente. O ID original é mantido na chave normalizada usada para deduplicar no CRM.

O título vem prioritariamente de `conversation-info-header-chat-title`, excluindo controles injetados pela própria Brokiva. Isso impede que “Sincronizar Histórico” seja tratado como nome do cliente.

## Gravação e retomada

As mensagens verificadas são salvas em checkpoints durante a leitura. Cada envio é dividido em lotes de até 150 mensagens/384 KiB, guardados em `chrome.storage.local` **antes** da chamada ao servidor. A fila é limitada a 6 MiB; se não houver espaço, a importação para e informa a pendência, sem sobrescrever a fila anterior.

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
