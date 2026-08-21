'use client';

import React, { useState, useRef } from 'react';
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
  CheckCircle2, 
  Trophy,
  Filter,
  Search,
  X,
  Edit3,
  Save,
  Trash2,
  AlertCircle,
  MapPin,
  TrendingUp,
  XCircle,
  Info,
  Phone,
  Mail,
  Calendar,
  Building,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Deal, Contact } from '@/types/crm';

interface KanbanBoardProps {
  onOpenLeadModal: () => void;
  onOpenChat: (contactId: string) => void;
}

export function KanbanBoard({ onOpenLeadModal, onOpenChat }: KanbanBoardProps) {
  const { 
    currentPipeline, 
    deals, 
    moveDealStage, 
    updateDeal,
    deleteDeal,
    contacts, 
    users, 
    conversations,
    aiInsights
  } = useCRM();

  // Estados de Filtros e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [selectedTemperature, setSelectedTemperature] = useState<string>('ALL');

  // Estado de Hover Card (Item 6 - Popover de Resumo 360º)
  const [hoveredDealId, setHoveredDealId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estado de Modal / Drawer de Detalhes do Negócio
  const [selectedDealForModal, setSelectedDealForModal] = useState<Deal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editStageId, setEditStageId] = useState('');
  const [editBrokerId, setEditBrokerId] = useState('');
  const [editProbability, setEditProbability] = useState('');
  const [editLossReason, setEditLossReason] = useState('');
  const [showLossReasonInput, setShowLossReasonInput] = useState(false);

  // Drag and Drop
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Filtragem de deals
  const filteredDeals = deals.filter(deal => {
    const contact = contacts.find(c => c.id === deal.contactId);
    
    // Filtro por Corretor
    if (selectedBroker !== 'ALL' && deal.assignedUserId !== selectedBroker) return false;
    
    // Filtro por Temperatura
    if (selectedTemperature !== 'ALL' && contact?.temperature !== selectedTemperature) return false;

    // Busca textual
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = deal.title.toLowerCase().includes(q);
      const matchClient = contact?.name?.toLowerCase().includes(q) || false;
      const matchPhone = contact?.phone?.includes(q) || false;
      if (!matchTitle && !matchClient && !matchPhone) return false;
    }

    return true;
  });

  // Métricas do Funil
  const totalPipelineValue = filteredDeals.reduce((acc, d) => acc + (d.status !== 'LOST' ? d.expectedValue : 0), 0);
  const openDealsCount = filteredDeals.filter(d => d.status === 'OPEN').length;
  const wonDealsCount = filteredDeals.filter(d => d.status === 'WON').length;
  const wonTotalValue = filteredDeals.filter(d => d.status === 'WON').reduce((acc, d) => acc + d.expectedValue, 0);

  const handleMoveStage = (dealId: string, targetStageId: string) => {
    const stage = currentPipeline.stages.find(s => s.id === targetStageId);
    moveDealStage(dealId, targetStageId);

    if (stage?.isWon) {
      triggerConfetti();
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  // Funções de Hover Card
  const handleMouseEnterCard = (e: React.MouseEvent<HTMLDivElement>, dealId: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearRightEdge = typeof window !== 'undefined' && rect.right + 260 > window.innerWidth;
    setHoverPosition({
      x: isNearRightEdge ? Math.max(12, rect.left - 250) : rect.right + 8,
      y: Math.max(70, Math.min(rect.top - 10, typeof window !== 'undefined' ? window.innerHeight - 320 : 200)),
    });
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDealId(dealId);
    }, 180);
  };

  const handleMouseLeaveCard = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredDealId(null);
  };

  // Funções de Drag & Drop
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
    setDraggedDealId(dealId);
    setHoveredDealId(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId;
    if (dealId) {
      handleMoveStage(dealId, targetStageId);
    }
    setDraggedDealId(null);
    setDragOverStageId(null);
  };

  // Abrir Modal de Detalhes
  const handleOpenDealModal = (deal: Deal) => {
    setSelectedDealForModal(deal);
    setEditTitle(deal.title);
    setEditValue(String(deal.expectedValue));
    setEditStageId(deal.stageId);
    setEditBrokerId(deal.assignedUserId);
    setEditProbability(String(deal.manualProbability || 50));
    setEditLossReason(deal.lossReason || '');
    setShowLossReasonInput(deal.status === 'LOST');
    setHoveredDealId(null);
  };

  const handleSaveDealDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealForModal) return;

    const numValue = Number(editValue.replace(/\D/g, '')) || selectedDealForModal.expectedValue;
    const stage = currentPipeline.stages.find(s => s.id === editStageId);

    updateDeal(selectedDealForModal.id, {
      title: editTitle.trim() || selectedDealForModal.title,
      expectedValue: numValue,
      stageId: editStageId,
      assignedUserId: editBrokerId,
      manualProbability: Number(editProbability) || 50,
      status: (stage?.isWon ? 'WON' : showLossReasonInput ? 'LOST' : 'OPEN') as any,
      lossReason: showLossReasonInput ? editLossReason : undefined,
    });

    if (stage?.isWon) {
      triggerConfetti();
    }

    setSelectedDealForModal(null);
  };

  // Helper para dados do hover
  const hoveredDeal = deals.find(d => d.id === hoveredDealId);
  const hoveredContact = hoveredDeal ? contacts.find(c => c.id === hoveredDeal.contactId) : null;
  const hoveredBroker = hoveredDeal ? users.find(u => u.id === hoveredDeal.assignedUserId) : null;
  const hoveredConv = hoveredContact ? conversations.find(c => c.contactId === hoveredContact.id) : null;
  const hoveredInsight = hoveredConv ? aiInsights[hoveredConv.id] : null;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 relative">
      {/* Header & Metrics Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">{currentPipeline.name}</h1>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {openDealsCount} oportunidades ativas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Funil Comercial Imobiliário • Arraste os cards ou use as ações rápidas
            </p>
          </div>

          {/* Resumo Financeiro */}
          <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-slate-200 text-xs">
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Volume em Negociação</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                R$ {totalPipelineValue.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80">
              <span className="text-emerald-600 block text-[9px] uppercase font-bold tracking-wider">Contratos Fechados ({wonDealsCount})</span>
              <span className="text-sm font-bold text-emerald-800 font-mono">
                R$ {wonTotalValue.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Busca Rápida */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, imóvel ou tel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-52"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtro por Temperatura */}
          <select
            value={selectedTemperature}
            onChange={(e) => setSelectedTemperature(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">🌡️ Todas Temperaturas</option>
            <option value="HOT">🔥 Leads Quentes</option>
            <option value="WARM">⚡ Leads Mornos</option>
            <option value="COLD">❄️ Leads Frios</option>
          </select>

          {/* Filtro por Corretor */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">👤 Todos os Corretores</option>
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
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Negócio</span>
          </button>
        </div>
      </div>

      {/* Kanban Stages Horizontal Scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex gap-4">
        {currentPipeline.stages.map((stage, stageIndex) => {
          const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
          const stageTotalValue = stageDeals.reduce((sum, d) => sum + d.expectedValue, 0);
          const isDragOver = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`w-80 flex flex-col rounded-2xl border p-3 flex-shrink-0 max-h-full transition-colors ${
                isDragOver 
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-300/40' 
                  : 'bg-slate-200/60 border-slate-300/70'
              }`}
            >
              {/* Stage Header */}
              <div className="pb-3 mb-2 border-b border-slate-300/80 flex-shrink-0">
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
                  <span className="font-mono">R$ {stageTotalValue.toLocaleString('pt-BR')}</span>
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
                  <div className="py-10 text-center text-slate-400 text-xs border-2 border-dashed border-slate-300/70 rounded-xl">
                    Nenhum negócio nesta etapa
                  </div>
                ) : (
                  stageDeals.map((deal) => {
                    const contact = contacts.find(c => c.id === deal.contactId);
                    const broker = users.find(u => u.id === deal.assignedUserId);

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onMouseEnter={(e) => handleMouseEnterCard(e, deal.id)}
                        onMouseLeave={handleMouseLeaveCard}
                        onClick={() => handleOpenDealModal(deal)}
                        className={`bg-white rounded-xl p-3.5 shadow-sm border transition duration-150 hover:shadow-md hover:border-emerald-500 group cursor-pointer relative ${
                          stage.isWon ? 'border-emerald-300 bg-emerald-50/20' : 
                          stage.isLost ? 'border-rose-200 bg-rose-50/20 opacity-80' : 
                          'border-slate-200'
                        }`}
                      >
                        {/* Header do Card */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            R$ {deal.expectedValue.toLocaleString('pt-BR')}
                          </span>

                          <div className="flex items-center gap-1">
                            {deal.status === 'WON' && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                🏆 Ganho
                              </span>
                            )}
                            {deal.status === 'LOST' && (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                ❌ Perdido
                              </span>
                            )}
                            {contact?.temperature && deal.status === 'OPEN' && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                contact.temperature === 'HOT' ? 'bg-rose-100 text-rose-700' :
                                contact.temperature === 'WARM' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {contact.temperature === 'HOT' ? '🔥 Quente' : contact.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Título do Negócio */}
                        <h4 className="text-xs font-bold text-slate-900 mb-1 leading-snug group-hover:text-emerald-700 transition">
                          {deal.title}
                        </h4>

                        {/* Informações do Cliente */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2.5">
                          <span className="truncate font-medium text-slate-700">{contact?.name || 'Cliente'}</span>
                          <span className="font-mono text-[10px] text-slate-400">{contact?.phone}</span>
                        </div>

                        {/* Tags de Perfil Rápido */}
                        {(contact?.preferredPropertyType || (contact?.targetRegions && contact.targetRegions.length > 0)) && (
                          <div className="flex items-center gap-1 mb-3 flex-wrap">
                            {contact?.preferredPropertyType && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                🏢 {contact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : contact.preferredPropertyType === 'HOUSE' ? 'Casa' : 'Apartamento'}
                              </span>
                            )}
                            {contact?.targetRegions?.[0] && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]">
                                📍 {contact.targetRegions[0]}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rodapé do Card com Ações */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <img
                              src={broker?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(broker?.name || 'Corretor')}
                              alt={broker?.name}
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                              title={broker?.name}
                            />
                            <span className="text-[10px] font-medium text-slate-600 truncate max-w-[70px]">
                              {broker?.name.split(' ')[0]}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Botão de Abrir Chat WhatsApp */}
                            {contact && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenChat(contact.id);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Mover para Esquerda */}
                            {stageIndex > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveStage(deal.id, currentPipeline.stages[stageIndex - 1].id);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Mover para etapa anterior"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Mover para Direita */}
                            {stageIndex < currentPipeline.stages.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveStage(deal.id, currentPipeline.stages[stageIndex + 1].id);
                                }}
                                className="p-1 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg transition cursor-pointer"
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

      {/* ---------------------------------------------------- */}
      {/* ITEM 6: POPOVER FLUTUANTE 360º (HOVER RESUMO DO LEAD) */}
      {/* ---------------------------------------------------- */}
      {/* ---------------------------------------------------- */}
      {/* ITEM 6: MINI-CARD FLUTUANTE 360º (ÚNICA COLUNA COMPACTA) */}
      {/* ---------------------------------------------------- */}
      {hoveredDeal && hoveredContact && hoverPosition && !selectedDealForModal && (
        <div
          style={{
            position: 'fixed',
            left: hoverPosition.x,
            top: hoverPosition.y,
            zIndex: 50,
          }}
          className="w-60 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 pointer-events-none animate-in fade-in zoom-in-95 duration-150 space-y-2"
        >
          {/* Header Compacto */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <img
              src={hoveredContact.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(hoveredContact.name)}&background=059669&color=fff`}
              alt={hoveredContact.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-500/50 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-white truncate">{hoveredContact.name}</h4>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  hoveredContact.temperature === 'HOT' ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40' :
                  hoveredContact.temperature === 'WARM' ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {hoveredContact.temperature === 'HOT' ? '🔥 Quente' : hoveredContact.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">{hoveredContact.phone}</p>
            </div>
          </div>

          {/* Resumo da IA Conciso (1 Coluna) */}
          {hoveredInsight?.summary && (
            <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-2">
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 mb-0.5">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                <span>Resumo da IA</span>
              </div>
              <p className="text-[10px] text-emerald-100 leading-snug line-clamp-2">
                {hoveredInsight.summary}
              </p>
            </div>
          )}

          {/* Lista de Informações em Coluna Única */}
          <div className="space-y-1 text-[10.5px] bg-white/5 p-2 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 text-[10px]">💰 Orçamento:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {hoveredContact.maxPropertyValue ? `R$ ${(hoveredContact.maxPropertyValue / 1000).toFixed(0)}k` : 'R$ 1.2M'}
              </span>
            </div>

            {hoveredContact.monthlyIncome && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10px]">💵 Renda:</span>
                <span className="font-semibold text-slate-200 font-mono">
                  R$ {(hoveredContact.monthlyIncome / 1000).toFixed(0)}k/mês
                </span>
              </div>
            )}

            {hoveredContact.downPaymentAvailable && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10px]">🏦 Entrada:</span>
                <span className="font-semibold text-slate-200 font-mono">
                  R$ {(hoveredContact.downPaymentAvailable / 1000).toFixed(0)}k
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 text-[10px]">🏢 Imóvel:</span>
              <span className="font-medium text-slate-200 truncate max-w-[120px]">
                {hoveredContact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : hoveredContact.preferredPropertyType === 'HOUSE' ? 'Casa' : 'Apartamento'}
                {hoveredContact.targetRegions?.[0] ? ` • ${hoveredContact.targetRegions[0]}` : ''}
              </span>
            </div>

            {hoveredBroker && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10px]">👤 Corretor:</span>
                <span className="font-medium text-slate-300 truncate max-w-[120px]">
                  {hoveredBroker.name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>

          <p className="text-[8.5px] text-slate-500 text-center pt-0.5">
            Clique no card para abrir detalhes
          </p>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL / DRAWER DE DETALHES E EDIÇÃO DA OPORTUNIDADE  */}
      {/* ---------------------------------------------------- */}
      {selectedDealForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Detalhes da Oportunidade</h3>
                  <p className="text-[11px] text-slate-400">Gerenciamento comercial e ciclo de vendas do imóvel</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDealForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveDealDetails} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Título do Negócio */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Negócio / Imóvel</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Valor e Etapa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    required
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Etapa Atual no Funil</label>
                  <select
                    value={editStageId}
                    onChange={(e) => setEditStageId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {currentPipeline.stages.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.isWon ? '🏆' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Corretor Responsável e Probabilidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                  <select
                    value={editBrokerId}
                    onChange={(e) => setEditBrokerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Probabilidade de Fechamento (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editProbability}
                    onChange={(e) => setEditProbability(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Ações de Desfecho Comercial (Ganho / Perdido) */}
              <div className="pt-2 border-t border-slate-200">
                <span className="block font-bold text-slate-700 mb-2">Desfecho Comercial do Negócio:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const wonStage = currentPipeline.stages.find(s => s.isWon) || currentPipeline.stages[currentPipeline.stages.length - 1];
                      setEditStageId(wonStage.id);
                      setShowLossReasonInput(false);
                    }}
                    className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold py-2 rounded-xl transition cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-emerald-600" />
                    <span>Marcar como GANHO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLossReasonInput(!showLossReasonInput)}
                    className={`flex items-center justify-center gap-1.5 border font-bold py-2 rounded-xl transition cursor-pointer ${
                      showLossReasonInput 
                        ? 'bg-rose-600 text-white border-rose-700' 
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{showLossReasonInput ? 'Cancelando Perda' : 'Marcar como PERDIDO'}</span>
                  </button>
                </div>

                {showLossReasonInput && (
                  <div className="mt-2.5 p-3 bg-rose-50/70 border border-rose-200 rounded-xl animate-in fade-in duration-150">
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">Motivo da Perda do Negócio:</label>
                    <select
                      value={editLossReason}
                      onChange={(e) => setEditLossReason(e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs text-rose-900 font-medium focus:outline-none"
                    >
                      <option value="Preço / Fora do Orçamento">🏷️ Preço / Fora do Orçamento</option>
                      <option value="Comprou Imóvel Concorrente">🏢 Comprou Imóvel Concorrente</option>
                      <option value="Financiamento Reprovado">🏦 Financiamento Reprovado</option>
                      <option value="Localização / Bairro Não Agradou">📍 Localização / Bairro Não Agradou</option>
                      <option value="Desistência Familiar">👥 Desistência Familiar / Momento Inadequado</option>
                      <option value="Outro Motivo">📋 Outro Motivo</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Abrir WhatsApp */}
                  <button
                    type="button"
                    onClick={() => {
                      const contactId = selectedDealForModal.contactId;
                      setSelectedDealForModal(null);
                      onOpenChat(contactId);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-xl font-bold transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Abrir no WhatsApp</span>
                  </button>

                  {/* Excluir */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja remover este negócio do funil?')) {
                        deleteDeal(selectedDealForModal.id);
                        setSelectedDealForModal(null);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Excluir Oportunidade"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDealForModal(null)}
                    className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
