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
  Check,
  Settings,
  ArrowUp,
  ArrowDown,
  Palette,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Deal, Contact, PipelineStage } from '@/types/crm';

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
    updatePipelineStages,
    contacts, 
    users, 
    conversations,
    aiInsights
  } = useCRM();

  // Estados de Filtros e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [selectedTemperature, setSelectedTemperature] = useState<string>('ALL');

  // Estado do Modal de Configuração do Funil
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingStages, setEditingStages] = useState<PipelineStage[]>([]);

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

  // Funções de Configuração do Funil
  const handleOpenConfigModal = () => {
    setEditingStages(JSON.parse(JSON.stringify(currentPipeline.stages)));
    setIsConfigModalOpen(true);
  };

  const handleUpdateStageField = (index: number, field: keyof PipelineStage, value: any) => {
    setEditingStages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleMoveStageUp = (index: number) => {
    if (index === 0) return;
    setEditingStages(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveStageDown = (index: number) => {
    if (index === editingStages.length - 1) return;
    setEditingStages(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleAddStage = () => {
    const defaultColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#059669', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6'];
    const color = defaultColors[editingStages.length % defaultColors.length];
    const newStage: PipelineStage = {
      id: `stage-${Date.now()}`,
      pipelineId: currentPipeline.id,
      name: `Nova Etapa ${editingStages.length + 1}`,
      order: editingStages.length + 1,
      slaHours: 24,
      colorHex: color,
      isWon: false,
      isLost: false,
    };
    setEditingStages(prev => [...prev, newStage]);
  };

  const handleRemoveStage = (index: number) => {
    if (editingStages.length <= 1) {
      alert('O funil deve conter pelo menos uma etapa.');
      return;
    }
    const stageToRemove = editingStages[index];
    const dealsInStage = deals.filter(d => d.stageId === stageToRemove.id);

    if (dealsInStage.length > 0) {
      if (!confirm(`Esta etapa possui ${dealsInStage.length} negócio(s). Ao remover, eles serão transferidos para a primeira etapa do funil. Deseja continuar?`)) {
        return;
      }
      const fallbackStage = editingStages.find((_, i) => i !== index);
      if (fallbackStage) {
        dealsInStage.forEach(deal => {
          updateDeal(deal.id, { stageId: fallbackStage.id });
        });
      }
    }

    setEditingStages(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetStagesToDefault = () => {
    if (confirm('Deseja restaurar as etapas padrão do funil?')) {
      const defaultStages: PipelineStage[] = [
        { id: 'stage-1', pipelineId: currentPipeline.id, name: '1. Novo Lead', order: 1, slaHours: 4, colorHex: '#3b82f6' },
        { id: 'stage-2', pipelineId: currentPipeline.id, name: '2. Qualificação', order: 2, slaHours: 24, colorHex: '#8b5cf6' },
        { id: 'stage-3', pipelineId: currentPipeline.id, name: '3. Visita Agendada', order: 3, slaHours: 48, colorHex: '#f59e0b' },
        { id: 'stage-4', pipelineId: currentPipeline.id, name: '4. Negociação / Proposta', order: 4, slaHours: 72, colorHex: '#059669', isWon: false },
        { id: 'stage-5', pipelineId: currentPipeline.id, name: '5. Contrato Fechado', order: 5, slaHours: 0, colorHex: '#10b981', isWon: true },
      ];
      setEditingStages(defaultStages);
    }
  };

  const handleSavePipelineConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStages.length === 0) {
      alert('O funil deve conter pelo menos uma etapa.');
      return;
    }
    updatePipelineStages(editingStages);
    setIsConfigModalOpen(false);
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

          {/* Configurar Funil */}
          <button
            onClick={handleOpenConfigModal}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200/80 transition shadow-2xs active:scale-95 cursor-pointer"
            title="Configurar etapas, nomes, cores e SLAs do Kanban"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Configurar Funil</span>
          </button>

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
                    const daysInactive = Math.floor((Date.now() - new Date(deal.updatedAt || deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onMouseEnter={(e) => handleMouseEnterCard(e, deal.id)}
                        onMouseLeave={handleMouseLeaveCard}
                        onClick={() => handleOpenDealModal(deal)}
                        className={`bg-white rounded-2xl p-3.5 shadow-xs border transition duration-150 hover:shadow-md hover:border-emerald-500 group cursor-pointer relative ${
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
                            {/* Alerta de Inatividade SLA */}
                            {deal.status === 'OPEN' && daysInactive >= 2 && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 animate-pulse" title={`Sem interação há ${daysInactive} dias`}>
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                <span>{daysInactive}d</span>
                              </span>
                            )}

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
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                          <span className="truncate font-medium text-slate-700">{contact?.name || 'Cliente'}</span>
                          <span className="font-mono text-[10px] text-slate-400">{contact?.phone}</span>
                        </div>

                        {/* Empreendimento / Unidade Apresentada */}
                        {((contact?.presentedProperties && contact.presentedProperties.length > 0) || (deal.presentedProperties && deal.presentedProperties.length > 0)) && (
                          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-lg px-2 py-1 mb-2.5 flex items-center justify-between text-[10.5px]">
                            <span className="font-bold text-emerald-900 truncate">
                              🏢 {(contact?.presentedProperties?.[0] || deal.presentedProperties?.[0])?.name}
                            </span>
                            {(contact?.presentedProperties?.[0] || deal.presentedProperties?.[0])?.unit && (
                              <span className="font-semibold text-emerald-800 bg-white px-1.5 py-0.2 rounded border border-emerald-200 text-[9.5px] truncate max-w-[90px]">
                                {(contact?.presentedProperties?.[0] || deal.presentedProperties?.[0])?.unit}
                              </span>
                            )}
                          </div>
                        )}

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
                                className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold py-0.5 px-2 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
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
          className="w-64 max-w-[270px] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700/80 pointer-events-none animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
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

          {/* Resumo da IA com Quebra de Linha Completa */}
          <div className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl p-2.5 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span>Resumo da IA:</span>
            </div>
            <p className="text-[10.5px] text-emerald-100 leading-relaxed whitespace-normal break-words italic">
              "{hoveredInsight?.summary || (
                hoveredContact.monthlyIncome
                  ? `Lead qualificado com renda de R$ ${(hoveredContact.monthlyIncome / 1000).toFixed(0)}k/mês e entrada de R$ ${(hoveredContact.downPaymentAvailable || 300000) / 1000}k para imóvel de alto padrão.`
                  : 'Lead em acompanhamento ativo no WhatsApp com orçamento e perfil mapeados durante a conversa.'
              )}"
            </p>
          </div>

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

            {hoveredContact.presentedProperties && hoveredContact.presentedProperties.length > 0 ? (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-emerald-400 text-[10px]">🏢 Empreend.:</span>
                <span className="font-bold text-emerald-300 truncate max-w-[130px]">
                  {hoveredContact.presentedProperties[0].name}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10px]">🏢 Imóvel:</span>
                <span className="font-medium text-slate-200 truncate max-w-[120px]">
                  {hoveredContact.preferredPropertyType === 'PENTHOUSE' ? 'Cobertura' : hoveredContact.preferredPropertyType === 'HOUSE' ? 'Casa' : 'Apartamento'}
                  {hoveredContact.targetRegions?.[0] ? ` • ${hoveredContact.targetRegions[0]}` : ''}
                </span>
              </div>
            )}

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

      {/* ---------------------------------------------------- */}
      {/* MODAL: CONFIGURAR ETAPAS DO FUNIL (KANBAN SETTINGS)  */}
      {/* ---------------------------------------------------- */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Configuração do Funil & Etapas</h3>
                  <p className="text-xs text-slate-500">
                    Personalize os nomes, cores, SLA em horas e a ordem da jornada de vendas.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com Lista de Etapas */}
            <form onSubmit={handleSavePipelineConfig} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-3">
                {editingStages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition duration-150 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Indicador de Ordem */}
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>

                        {/* Seletor de Cor da Etapa */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="color"
                            value={stage.colorHex}
                            onChange={(e) => handleUpdateStageField(idx, 'colorHex', e.target.value)}
                            className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                            title="Escolher cor da etapa"
                          />
                        </div>

                        {/* Nome da Etapa */}
                        <input
                          type="text"
                          value={stage.name}
                          onChange={(e) => handleUpdateStageField(idx, 'name', e.target.value)}
                          placeholder="Nome da etapa (ex: Visita Agendada)"
                          required
                          className="flex-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      {/* Botões de Ação da Etapa */}
                      <div className="flex items-center gap-1">
                        {/* Subir */}
                        <button
                          type="button"
                          onClick={() => handleMoveStageUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition cursor-pointer"
                          title="Subir posição da etapa"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Descer */}
                        <button
                          type="button"
                          onClick={() => handleMoveStageDown(idx)}
                          disabled={idx === editingStages.length - 1}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg transition cursor-pointer"
                          title="Descer posição da etapa"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoveStage(idx)}
                          disabled={editingStages.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 rounded-lg transition cursor-pointer ml-1"
                          title="Excluir etapa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Linha Inferior: SLA e Tipo de Etapa */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          SLA Máximo:
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="720"
                            value={stage.slaHours}
                            onChange={(e) => handleUpdateStageField(idx, 'slaHours', Number(e.target.value) || 0)}
                            className="w-16 text-xs text-center font-bold bg-white border border-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] text-slate-400">horas</span>
                        </div>
                      </div>

                      {/* Tipo de Desfecho */}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={!!stage.isWon}
                            onChange={(e) => {
                              handleUpdateStageField(idx, 'isWon', e.target.checked);
                              if (e.target.checked) handleUpdateStageField(idx, 'isLost', false);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>🏆 Etapa de Ganho (WON)</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={!!stage.isLost}
                            onChange={(e) => {
                              handleUpdateStageField(idx, 'isLost', e.target.checked);
                              if (e.target.checked) handleUpdateStageField(idx, 'isWon', false);
                            }}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>❌ Etapa de Perda (LOST)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão Adicionar Nova Etapa */}
              <button
                type="button"
                onClick={handleAddStage}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-slate-600 hover:text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Nova Etapa ao Funil</span>
              </button>

              {/* Rodapé de Ações */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetStagesToDefault}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-xl transition cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Funil</span>
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
