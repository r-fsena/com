'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  DollarSign, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Plus, 
  Flame, 
  User, 
  Clock, 
  CheckCircle, 
  Trophy,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface KanbanBoardProps {
  onOpenLeadModal: () => void;
  onOpenChat: (contactId: string) => void;
}

export function KanbanBoard({ onOpenLeadModal, onOpenChat }: KanbanBoardProps) {
  const { 
    currentPipeline, 
    deals, 
    moveDealStage, 
    contacts, 
    users, 
    createDeal,
    activeConversationId,
    conversations
  } = useCRM();

  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');

  // Filtragem de deals
  const filteredDeals = deals.filter(deal => {
    if (selectedBroker !== 'ALL' && deal.assignedUserId !== selectedBroker) return false;
    return true;
  });

  // Métricas do Funil
  const totalPipelineValue = filteredDeals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  const openDealsCount = filteredDeals.filter(d => d.status === 'OPEN').length;
  const wonDealsCount = filteredDeals.filter(d => d.status === 'WON').length;

  const handleMoveStage = (dealId: string, targetStageId: string) => {
    const stage = currentPipeline.stages.find(s => s.id === targetStageId);
    moveDealStage(dealId, targetStageId);

    if (stage?.isWon) {
      // Dispara celebração de confetti
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (err) {
        console.log('Confetti triggered');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* Header & Metrics Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">{currentPipeline.name}</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {openDealsCount} negócios ativos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Arraste ou movimente os negócios pelas etapas do ciclo comercial imobiliário
          </p>
        </div>

        {/* Resumo Financeiro & Filtros */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs border-r border-slate-200 pr-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Valor Total no Funil</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                R$ {totalPipelineValue.toLocaleString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Ganhos / Fechados</span>
              <span className="text-sm font-bold text-emerald-600 font-mono">
                {wonDealsCount} contratos
              </span>
            </div>
          </div>

          {/* Filtro por Corretor */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Corretores</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  👤 {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Novo Negócio */}
          <button
            onClick={onOpenLeadModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Negócio</span>
          </button>
        </div>
      </div>

      {/* Kanban Stages Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex gap-4">
        {currentPipeline.stages.map((stage, stageIndex) => {
          const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
          const stageTotalValue = stageDeals.reduce((sum, d) => sum + d.expectedValue, 0);

          return (
            <div
              key={stage.id}
              className="w-80 flex flex-col bg-slate-200/60 rounded-2xl border border-slate-300/70 p-3 flex-shrink-0 max-h-full"
            >
              {/* Stage Header */}
              <div className="pb-3 mb-2 border-b border-slate-300/80">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.colorHex }}
                    />
                    <h3 className="text-xs font-bold text-slate-900 truncate">{stage.name}</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded-full shadow-xs">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>R$ {stageTotalValue.toLocaleString('pt-BR')}</span>
                  {stage.slaHours > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Clock className="w-3 h-3" /> SLA: {stage.slaHours}h
                    </span>
                  )}
                </div>
              </div>

              {/* Deal Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {stageDeals.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs border-2 border-dashed border-slate-300/70 rounded-xl">
                    Nenhum negócio nesta etapa
                  </div>
                ) : (
                  stageDeals.map((deal) => {
                    const contact = contacts.find(c => c.id === deal.contactId);
                    const broker = users.find(u => u.id === deal.assignedUserId);

                    return (
                      <div
                        key={deal.id}
                        className={`bg-white rounded-xl p-3.5 shadow-sm border transition duration-150 hover:shadow-md hover:border-emerald-500 group ${
                          stage.isWon ? 'border-emerald-300 bg-emerald-50/30' : 
                          stage.isLost ? 'border-rose-200 opacity-75' : 
                          'border-slate-200'
                        }`}
                      >
                        {/* Header do Card */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            R$ {deal.expectedValue.toLocaleString('pt-BR')}
                          </span>

                          {contact?.temperature && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              contact.temperature === 'HOT' ? 'bg-rose-100 text-rose-700' :
                              contact.temperature === 'WARM' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {contact.temperature === 'HOT' ? '🔥 Quente' : contact.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                            </span>
                          )}
                        </div>

                        {/* Título do Negócio */}
                        <h4 className="text-xs font-bold text-slate-900 mb-1 leading-snug">
                          {deal.title}
                        </h4>

                        {/* Informações do Cliente */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                          <span className="truncate font-medium">{contact?.name || 'Cliente'}</span>
                          <span className="font-mono text-[10px]">{contact?.phone}</span>
                        </div>

                        {/* Rodapé do Card com Ações */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={broker?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(broker?.name || 'Corretor')}
                              alt={broker?.name}
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                              title={broker?.name}
                            />
                            <span className="text-[10px] font-medium text-slate-600 truncate max-w-[80px]">
                              {broker?.name.split(' ')[0]}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Botão de Abrir Chat WhatsApp */}
                            {contact && (
                              <button
                                onClick={() => onOpenChat(contact.id)}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Mover para Esquerda */}
                            {stageIndex > 0 && (
                              <button
                                onClick={() => handleMoveStage(deal.id, currentPipeline.stages[stageIndex - 1].id)}
                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                title="Mover para etapa anterior"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Mover para Direita */}
                            {stageIndex < currentPipeline.stages.length - 1 && (
                              <button
                                onClick={() => handleMoveStage(deal.id, currentPipeline.stages[stageIndex + 1].id)}
                                className="p-1 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg transition"
                                title="Avançar etapa no funil"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
