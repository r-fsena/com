# 13. Arquitetura Técnica & Benchmark PipeRun (Brokiva CRM)

Este documento consolida a especificação técnica, validação de viabilidade e roadmap arquitetural dos recursos analisados no benchmark com o CRM PipeRun, estruturados em duas grandes visões: **Visão de Oportunidades** e **Visão de Atendimento**.

---

## 1. Status Geral das Implementações

| Recurso | Visão | Status | Componente Principal |
| :--- | :--- | :--- | :--- |
| **Múltiplos Funis de Vendas** | Oportunidades | **IMPLEMENTADO (P1)** | `KanbanBoard.tsx`, `crm-context.tsx` |
| **Migração entre Funis** | Oportunidades | **IMPLEMENTADO (P1)** | `moveDealToPipeline`, `KanbanBoard.tsx` |
| **Motivos de Perda Segregados** | Oportunidades | **IMPLEMENTADO (P2)** | `CommercialProcessesSettings.tsx`, `LossReason` |
| **Origens e Grupos de Origens** | Oportunidades | **IMPLEMENTADO (P3)** | `CommercialProcessesSettings.tsx`, `NewLeadModal.tsx` |
| **Formulários Personalizados** | Oportunidades | **ESPECIFICADO (P4)** | Engine `CustomFieldDefinition` |
| **Condições no Funil (Stage Gates)** | Oportunidades | **ESPECIFICADO (P5)** | Engine `StageGateRule` |
| **Canais de Atendimento** | Atendimento | **ESPECIFICADO (P6)** | Hub Z-API Multi-Instância |
| **Templates de Mensagens** | Atendimento | **ESTRUTURADO (P7)** | `MessageTemplatesModal.tsx` + Variáveis |
| **Eventos & Linha do Tempo** | Atendimento | **ESPECIFICADO (P8)** | Event Sourcing `DealTimelineEvent` |
| **Prioridades & SLAs** | Atendimento | **ESTRUTURADO (P9)** | Radar de Inatividade + SLA Engine |
| **Serviços e Categorias** | Atendimento | **ESPECIFICADO (P10)** | Catálogo de Serviços Imobiliários |

---

## 2. Visão de Oportunidades: Itens Implementados

### 2.1. Múltiplos Funis (Configuração de Funis & Migração)
- **Estrutura:** Suporte nativo a múltiplos pipelines (`Pipeline`), cada um contendo suas próprias etapas (`PipelineStage`), SLAs de estagnação em horas, cores identificadoras e bandeiras de desfecho (`isWon`, `isLost`).
- **Seletor de Funil Ativo:** Componente dropdown integrado ao header do Kanban com contadores em tempo real de oportunidades ativas e valor total em negociação por funil.
- **Migração entre Funis (`moveDealToPipeline`):** Permite transferir qualquer oportunidade entre funis distintos (ex: mover de *Vendas Residencial* para *Captação de Exclusividade* ou *Locação*), selecionando a etapa inicial de destino e preservando 100% do histórico de conversas do WhatsApp, dados de qualificação e histórico do cliente.

### 2.2. Cadastro de Motivos de Perda por Funil
- **Independência por Processo:** O modelo `LossReason` possui o atributo `pipelineIds?: string[]`.
  - Quando vazio ou não definido: motivo global (disponível em todos os funis).
  - Quando vinculado a IDs específicos: visível e selecionável estritamente nos funis cadastrados.
- **Interação no Kanban:** Ao arrastar um card para uma etapa de desfecho negativo (`isLost: true`) ou clicar em "Marcar como Perdido", abre-se um modal contextual listando apenas os motivos de perda pertinentes ao funil atual.

### 2.3. Gestão Hierárquica de Origens e Grupos de Origens
- **Modelagem Relacional:**
  - `LeadSourceGroup`: Agrupador de primeiro nível (ex: *Redes Sociais*, *Portais Imobiliários*, *Indicações*, *Receptivo*).
  - `LeadSource`: Canal granular pertencente ao grupo (ex: *Instagram Ads Campanha A*, *VivaReal*, *ZAP Imóveis*, *Parceiro Imobiliário*).
- **Interface no Padrão PipeRun:** Submenu "Processos Comerciais & Origens" nas Configurações, com abas para alternar entre "Origens" e "Grupos de Origens", barra de busca instantânea, toggle de ativação e modais de criação/edição.
- **Integração no Cadastro de Lead:** No `NewLeadModal`, o campo de seleção de origem agrupa dinamicamente as opções via `<optgroup>` com base nos grupos e canais ativos no sistema.

---

## 3. Validação e Estruturação Técnica dos Demais Itens

Abaixo detalha-se a engenharia de software planejada para os itens complementares identificados no benchmark.

---

### Item 4: Formulário Personalizado de Cadastro de Oportunidades (Leads)

#### Diagnóstico & Requisito
Nem toda imobiliária ou corretor coleta os mesmos dados. Um funil de *Locação* exige dados do fiador/seguro-fiança, enquanto um funil de *Lançamentos na Planta* exige dados de construtora, regime de casamento e comprovação de renda para financiamento Caixa.

#### Modelo de Dados Recomendado
```typescript
export type FieldDataType = 
  | 'TEXT' 
  | 'NUMBER' 
  | 'CURRENCY' 
  | 'SELECT' 
  | 'MULTISELECT' 
  | 'BOOLEAN' 
  | 'DATE' 
  | 'FILE';

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  pipelineId?: string; // Se omitido, aplica a todos os funis
  label: string;
  name: string; // chave técnica (ex: "tem_fgts", "regime_bens")
  type: FieldDataType;
  isRequired: boolean;
  options?: string[]; // Para SELECT e MULTISELECT
  defaultValue?: any;
  order: number;
  placeholder?: string;
  helpText?: string;
}

// Em Deal e Contact:
export interface Deal {
  // ... campos existentes
  customFields?: Record<string, any>; // Ex: { tem_fgts: true, valor_fgts: 85000, banco_preferencial: "Caixa" }
}
```

#### Arquitetura de Componentes
1. **Field Builder (`CustomFieldsSettings.tsx`):** Tela visual estilo drag-and-drop para criar campos, definir tipos, obrigatoriedade e vincular ao funil desejado.
2. **Schema-Driven Form Renderer (`DynamicFieldsRenderer.tsx`):** Componente que lê a lista de `CustomFieldDefinition` do funil ativo e monta os inputs automaticamente com validação via Zod / React Hook Form.

---

### Item 5: Configuração de Condições no Funil (Stage Gates)

#### Diagnóstico & Requisito
Garantir maturidade e integridade no processo de vendas, impedindo que corretores avancem negociações prematuramente sem as informações mandatórias daquela fase.

#### Modelo de Dados Recomendado
```typescript
export interface StageGateRule {
  id: string;
  pipelineStageId: string;
  requiredStandardFields?: Array<keyof Deal | 'contact.cpf' | 'contact.income' | 'presentedProperty'>;
  requiredCustomFieldNames?: string[];
  minExpectedValue?: number;
  requireBrokerAssignment?: boolean;
  requireScheduledActivity?: boolean; // Ex: exige visita marcada para avançar
  errorMessage: string;
}

export interface PipelineStage {
  // ... campos existentes
  gateRules?: StageGateRule[];
}
```

#### Mecânica de Execução (UX):
Quando o usuário arrasta um card ou altera o estágio pelo seletor:
1. O método `moveDealStage(dealId, targetStageId)` valida as regras do `gateRules` da etapa de destino.
2. Se houver pendências (ex: "Falta informar o Valor da Proposta e o Tipo de Garantia"):
   - A transição física é bloqueada temporariamente.
   - Abre-se uma janela modal **"Completar Requisitos para Avançar Etapa"**, trazendo apenas os campos obrigatórios pendentes.
   - Ao preencher e salvar, a oportunidade avança de etapa automaticamente.

---

### Item 6: Configuração de Canais de Atendimento (Visão de Atendimento)

#### Diagnóstico & Requisito
Unificar os pontos de contato da imobiliária (Múltiplas instâncias do WhatsApp via Z-API, Instagram Direct, Formulários de Portais e Site Institucional) em um hub de roteamento inteligente.

#### Modelo de Dados Recomendado
```typescript
export type ChannelType = 'WHATSAPP_ZAPI' | 'INSTAGRAM' | 'PORTAL_INTEGRATION' | 'WEBHOOK' | 'EMAIL';

export interface ServiceChannel {
  id: string;
  tenantId: string;
  name: string; // Ex: "WhatsApp Vendas Jardins", "WhatsApp Locação Matriz"
  type: ChannelType;
  instanceId?: string; // Vinculado a Z-API Instance
  phoneNumber?: string;
  isActive: boolean;
  routingMode: 'DIRECT_ROUND_ROBIN' | 'MANUAL_INBOX' | 'FIXED_BROKER' | 'AI_FIRST_RESPONSE';
  assignedUserIds?: string[]; // Corretores aptos a receber leads deste canal
  defaultPipelineId: string;
  defaultStageId: string;
}
```

#### Arquitetura de Roteamento:
1. **Webhook Ingress Gateway:** O webhook da Z-API identifica o `instanceId` emissor.
2. **Channel Dispatcher:** Consulta o `ServiceChannel` correspondente, define o corretor responsável pela regra (ex: Roleta comercial entre os usuários atribuídos) e gera o Deal no Funil e Etapa pré-configurados do canal.

---

### Item 7: Templates de Mensagens com Variáveis Dinâmicas

#### Diagnóstico & Requisito
O corretor não deve digitar textos repetitivos. Templates prontos de abordagem inicial, confirmação de visita, proposta e pós-visita devem interpolar dados reais do cliente e do imóvel em 1 clique.

#### Modelo de Dados & Motor de Interpolação
```typescript
export interface MessageTemplate {
  id: string;
  tenantId: string;
  title: string; // Ex: "Confirmação de Visita Presencial"
  category: 'PRIMEIRO_CONTATO' | 'AGENDAMENTO' | 'PROPOSTA' | 'FOLLOW_UP';
  content: string; 
  // Ex: "Olá {{cliente.primeiro_nome}}! Confirmamos nossa visita ao imóvel {{imovel.titulo}} amanhã às {{visita.horario}}..."
  shortcut?: string; // Ex: "/visita"
  isActive: boolean;
}
```

#### Variáveis Disponíveis no Motor de Substituição:
- `{{cliente.nome}}`, `{{cliente.primeiro_nome}}`, `{{cliente.telefone}}`
- `{{corretor.nome}}`, `{{corretor.telefone}}`, `{{corretor.creci}}`
- `{{imovel.titulo}}`, `{{imovel.valor}}`, `{{imovel.endereco}}`
- `{{negocio.valor_estimado}}`, `{{empresa.nome}}`

---

### Item 8: Linha do Tempo Unificada & Eventos de Negócio

#### Diagnóstico & Requisito
Histórico transparente de auditoria e linha do tempo de 360º de cada oportunidade, permitindo que gestores e corretores vejam exatamente quando a oportunidade foi aberta, quando mensagens foram trocadas, quando etapas mudaram e quais alertas foram gerados.

#### Modelo de Dados
```typescript
export type EventType = 
  | 'DEAL_CREATED'
  | 'STAGE_CHANGED'
  | 'PIPELINE_MIGRATED'
  | 'WHATSAPP_MESSAGE_SENT'
  | 'WHATSAPP_MESSAGE_RECEIVED'
  | 'NOTE_ADDED'
  | 'URGENCY_ALERT_TRIGGERED'
  | 'DEAL_WON'
  | 'DEAL_LOST'
  | 'VISIT_SCHEDULED';

export interface DealTimelineEvent {
  id: string;
  dealId: string;
  tenantId: string;
  userId?: string;
  type: EventType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
```

---

### Item 9: Prioridades & SLAs de Atendimento

#### Diagnóstico & Requisito
A Brokiva já possui o **Radar de Inatividade Inteligente** (detectando leads "No Vácuo" e "Esfriando"). O passo evolutivo é formalizar filas operacionais de atendimento baseadas em SLAs rígidos.

#### Estrutura de Filas Recomendada:
1. **Fila Crítica (P1 - Vácuo / Emergencial):** Mensagem de cliente não respondida há mais de 15 minutos em horário comercial.
2. **Fila Alta (P2 - Leads Novos):** Entradas recentes aguardando primeiro contato (SLA de 5 minutos).
3. **Fila Normal (P3 - Follow-up Ativo):** Leads em negociação regular dentro do SLA.
4. **Fila Monitorada (P4 - Esfriamento):** Negócios sem interação há mais de 48h com sugestão de reativação pelo Copiloto IA (Brok.ia).

---

### Item 10: Catálogo Comercial de Serviços e Categorias

#### Diagnóstico & Requisito
Permitir que imobiliárias e corretores estruturem seus produtos e taxas de intermediação, calculando comissões e valores previstos com precisão matemática.

#### Modelo de Dados
```typescript
export interface CommercialCategory {
  id: string;
  tenantId: string;
  name: string; // Ex: "Intermediação Imobiliária", "Locação & Gestão", "Serviços Jurídicos / Avaliação"
  description?: string;
}

export interface CommercialService {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string; // Ex: "Comissão Venda Prontos (6%)", "Taxa Adm Locação (10%)", "Avaliação Mercadológica PTAM"
  code?: string;
  pricingType: 'PERCENTAGE' | 'FIXED_VALUE' | 'VARIABLE';
  defaultPercentage?: number; // Ex: 6.0
  defaultValue?: number;
  isActive: boolean;
}

export interface DealServiceItem {
  id: string;
  dealId: string;
  serviceId: string;
  appliedValue: number;
  calculatedCommission: number;
}
```

---

## 4. Conclusão e Próximos Passos de Execução

As **3 prioridades fundamentais** solicitadas pelo usuário foram implementadas com fidelidade à experiência de usuário do benchmark PipeRun e aderência ao Sovereign Design System da Brokiva:
1. **Múltiplos Funis:** Isolamento de deals, seletor de funis, métricas independentes e migração entre funis.
2. **Motivos de Perda Segregados:** Associação de motivos por funis, filtro dinâmico e integração ao fluxo de perda do Kanban.
3. **Origens e Grupos de Origens:** Tabela detalhada de origens com filtros de busca, grupos com contadores, botões de ação e modais de criação/edição.

Os demais 7 itens foram tecnicamente mapeados com seus respectivos contratos de dados, regras de UX e arquitetura modular, prontos para serem integrados nas sprints seguintes.
