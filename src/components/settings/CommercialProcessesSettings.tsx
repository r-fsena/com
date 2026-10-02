'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  GitFork, 
  Layers, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Trophy, 
  XCircle,
  ArrowUp,
  ArrowDown,
  Palette,
  RotateCcw,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { PipelineStage, LossReason, LeadSource, LeadSourceGroup } from '@/types/crm';

export function CommercialProcessesSettings() {
  const {
    pipelines,
    currentPipeline,
    setCurrentPipelineById,
    createPipeline,
    updatePipeline,
    deletePipeline,
    deals,
    lossReasons,
    createLossReason,
    updateLossReason,
    deleteLossReason,
    leadSourceGroups,
    createLeadSourceGroup,
    updateLeadSourceGroup,
    deleteLeadSourceGroup,
    leadSources,
    createLeadSource,
    updateLeadSource,
    deleteLeadSource,
  } = useCRM();

  // Sub-abas principais: ORIGINS, LOSS_REASONS, PIPELINES
  const [activeSection, setActiveSection] = useState<'ORIGINS' | 'LOSS_REASONS' | 'PIPELINES'>('ORIGINS');

  // Sub-aba de Origens: 'SOURCES' | 'GROUPS'
  const [sourcesTab, setSourcesTab] = useState<'SOURCES' | 'GROUPS'>('SOURCES');

  // Filtros de Origens
  const [sourceSearchName, setSourceSearchName] = useState('');
  const [sourceSearchDesc, setSourceSearchDesc] = useState('');

  // Modais de Origens e Grupos
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [sourceFormName, setSourceFormName] = useState('');
  const [sourceFormDesc, setSourceFormDesc] = useState('');
  const [sourceFormGroupId, setSourceFormGroupId] = useState('');
  const [sourceFormActive, setSourceFormActive] = useState(true);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LeadSourceGroup | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDesc, setGroupFormDesc] = useState('');
  const [groupFormActive, setGroupFormActive] = useState(true);

  // Filtros de Motivos de Perda
  const [lossSearchQuery, setLossSearchQuery] = useState('');
  const [lossFilterPipelineId, setLossFilterPipelineId] = useState<string>('ALL');

  // Modais de Motivos de Perda
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [editingLossReason, setEditingLossReason] = useState<LossReason | null>(null);
  const [lossFormName, setLossFormName] = useState('');
  const [lossFormDesc, setLossFormDesc] = useState('');
  const [lossFormActive, setLossFormActive] = useState(true);
  const [lossFormPipelineIds, setLossFormPipelineIds] = useState<string[]>([]);
  const [lossFormAllPipelines, setLossFormAllPipelines] = useState(true);

  // Modais de Funis
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [pipelineFormName, setPipelineFormName] = useState('');
  const [pipelineStagesList, setPipelineStagesList] = useState<PipelineStage[]>([]);

  // -------------------------------------------------------------
  // HANDLERS: ORIGENS
  // -------------------------------------------------------------
  const handleOpenCreateSource = () => {
    setEditingSource(null);
    setSourceFormName('');
    setSourceFormDesc('');
    setSourceFormGroupId(leadSourceGroups[0]?.id || '');
    setSourceFormActive(true);
    setIsSourceModalOpen(true);
  };

  const handleOpenEditSource = (source: LeadSource) => {
    setEditingSource(source);
    setSourceFormName(source.name);
    setSourceFormDesc(source.description || '');
    setSourceFormGroupId(source.groupId || '');
    setSourceFormActive(source.isActive);
    setIsSourceModalOpen(true);
  };

  const handleSaveSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceFormName.trim()) return;

    if (editingSource) {
      updateLeadSource(editingSource.id, {
        name: sourceFormName.trim(),
        description: sourceFormDesc.trim() || undefined,
        groupId: sourceFormGroupId || undefined,
        isActive: sourceFormActive,
      });
    } else {
      createLeadSource({
        name: sourceFormName.trim(),
        description: sourceFormDesc.trim() || undefined,
        groupId: sourceFormGroupId || undefined,
        isActive: sourceFormActive,
      });
    }
    setIsSourceModalOpen(false);
  };

  const handleToggleSourceStatus = (source: LeadSource) => {
    updateLeadSource(source.id, { isActive: !source.isActive });
  };

  // -------------------------------------------------------------
  // HANDLERS: GRUPOS DE ORIGENS
  // -------------------------------------------------------------
  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormName('');
    setGroupFormDesc('');
    setGroupFormActive(true);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group: LeadSourceGroup) => {
    setEditingGroup(group);
    setGroupFormName(group.name);
    setGroupFormDesc(group.description || '');
    setGroupFormActive(group.isActive);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormName.trim()) return;

    if (editingGroup) {
      updateLeadSourceGroup(editingGroup.id, {
        name: groupFormName.trim(),
        description: groupFormDesc.trim() || undefined,
        isActive: groupFormActive,
      });
    } else {
      createLeadSourceGroup({
        name: groupFormName.trim(),
        description: groupFormDesc.trim() || undefined,
        isActive: groupFormActive,
      });
    }
    setIsGroupModalOpen(false);
  };

  const handleToggleGroupStatus = (group: LeadSourceGroup) => {
    updateLeadSourceGroup(group.id, { isActive: !group.isActive });
  };

  // -------------------------------------------------------------
  // HANDLERS: MOTIVOS DE PERDA
  // -------------------------------------------------------------
  const handleOpenCreateLossReason = () => {
    setEditingLossReason(null);
    setLossFormName('');
    setLossFormDesc('');
    setLossFormActive(true);
    setLossFormAllPipelines(true);
    setLossFormPipelineIds([]);
    setIsLossModalOpen(true);
  };

  const handleOpenEditLossReason = (reason: LossReason) => {
    setEditingLossReason(reason);
    setLossFormName(reason.name);
    setLossFormDesc(reason.description || '');
    setLossFormActive(reason.isActive);
    const hasSpecificPipelines = Array.isArray(reason.pipelineIds) && reason.pipelineIds.length > 0;
    setLossFormAllPipelines(!hasSpecificPipelines);
    setLossFormPipelineIds(reason.pipelineIds || []);
    setIsLossModalOpen(true);
  };

  const handleSaveLossReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossFormName.trim()) return;

    const pipelineIdsPayload = lossFormAllPipelines ? [] : lossFormPipelineIds;

    if (editingLossReason) {
      updateLossReason(editingLossReason.id, {
        name: lossFormName.trim(),
        description: lossFormDesc.trim() || undefined,
        isActive: lossFormActive,
        pipelineIds: pipelineIdsPayload,
      });
    } else {
      createLossReason({
        name: lossFormName.trim(),
        description: lossFormDesc.trim() || undefined,
        isActive: lossFormActive,
        pipelineIds: pipelineIdsPayload,
      });
    }
    setIsLossModalOpen(false);
  };

  const handleToggleLossReasonStatus = (reason: LossReason) => {
    updateLossReason(reason.id, { isActive: !reason.isActive });
  };

  // -------------------------------------------------------------
  // HANDLERS: FUNIS
  // -------------------------------------------------------------
  const handleOpenCreatePipeline = () => {
    setEditingPipelineId(null);
    setPipelineFormName('');
    const defaultStages: PipelineStage[] = [
      { id: `st-${Date.now()}-1`, pipelineId: '', name: '1. Novo Lead', order: 1, slaHours: 4, colorHex: '#3b82f6', isWon: false, isLost: false },
      { id: `st-${Date.now()}-2`, pipelineId: '', name: '2. Qualificação', order: 2, slaHours: 24, colorHex: '#8b5cf6', isWon: false, isLost: false },
      { id: `st-${Date.now()}-3`, pipelineId: '', name: '3. Visita / Reunião', order: 3, slaHours: 48, colorHex: '#f59e0b', isWon: false, isLost: false },
      { id: `st-${Date.now()}-4`, pipelineId: '', name: '4. Negociação', order: 4, slaHours: 72, colorHex: '#059669', isWon: false, isLost: false },
      { id: `st-${Date.now()}-5`, pipelineId: '', name: '5. Fechamento', order: 5, slaHours: 0, colorHex: '#10b981', isWon: true, isLost: false },
    ];
    setPipelineStagesList(defaultStages);
    setIsPipelineModalOpen(true);
  };

  const handleOpenEditPipeline = (pipId: string) => {
    const p = pipelines.find(item => item.id === pipId);
    if (!p) return;
    setEditingPipelineId(p.id);
    setPipelineFormName(p.name);
    setPipelineStagesList(JSON.parse(JSON.stringify(p.stages)));
    setIsPipelineModalOpen(true);
  };

  const handleSavePipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineFormName.trim()) return;

    if (editingPipelineId) {
      updatePipeline(editingPipelineId, {
        name: pipelineFormName.trim(),
        stages: pipelineStagesList,
      });
    } else {
      createPipeline({
        name: pipelineFormName.trim(),
        stages: pipelineStagesList,
      });
    }
    setIsPipelineModalOpen(false);
  };

  // -------------------------------------------------------------
  // FILTRAGEM DE TABELAS
  // -------------------------------------------------------------
  const filteredSources = useMemo(() => {
    return leadSources.filter(src => {
      const matchName = !sourceSearchName || src.name.toLowerCase().includes(sourceSearchName.toLowerCase());
      const matchDesc = !sourceSearchDesc || (src.description || '').toLowerCase().includes(sourceSearchDesc.toLowerCase());
      return matchName && matchDesc;
    });
  }, [leadSources, sourceSearchName, sourceSearchDesc]);

  const filteredGroups = useMemo(() => {
    return leadSourceGroups.filter(grp => {
      const matchName = !sourceSearchName || grp.name.toLowerCase().includes(sourceSearchName.toLowerCase());
      const matchDesc = !sourceSearchDesc || (grp.description || '').toLowerCase().includes(sourceSearchDesc.toLowerCase());
      return matchName && matchDesc;
    });
  }, [leadSourceGroups, sourceSearchName, sourceSearchDesc]);

  const filteredLossReasons = useMemo(() => {
    return lossReasons.filter(r => {
      const matchQuery = !lossSearchQuery || 
        r.name.toLowerCase().includes(lossSearchQuery.toLowerCase()) || 
        (r.description || '').toLowerCase().includes(lossSearchQuery.toLowerCase());
      
      const matchPipeline = lossFilterPipelineId === 'ALL' || 
        !r.pipelineIds || 
        r.pipelineIds.length === 0 || 
        r.pipelineIds.includes(lossFilterPipelineId);

      return matchQuery && matchPipeline;
    });
  }, [lossReasons, lossSearchQuery, lossFilterPipelineId]);

  return (
    <div className="space-y-6">
      {/* Navegação de Abas do Módulo Processos Comerciais */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Processos Comerciais & Origens</h2>
            <p className="text-xs text-slate-500">Configure múltiplos funis, motivos de perda segregados e origens de leads</p>
          </div>
        </div>

        {/* Seletor de Seções (Estilo Benchmark PipeRun) */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSection('ORIGINS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'ORIGINS'
                ? 'bg-white text-[#3742AC] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Origens & Grupos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('LOSS_REASONS')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'LOSS_REASONS'
                ? 'bg-white text-[#3742AC] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Motivos de Perda
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('PIPELINES')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'PIPELINES'
                ? 'bg-white text-[#3742AC] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Funis & Etapas
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: ORIGENS E GRUPOS DE ORIGENS (ESTILO BENCHMARK PIPERUN)           */}
      {/* ========================================================================= */}
      {activeSection === 'ORIGINS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* Header da Subseção */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-slate-400 font-medium mb-1">
                Home / Ajustes e configurações / <strong className="text-slate-600">Origens e grupos de origens</strong>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Origens e grupos de origens</h3>
              <p className="text-xs text-slate-500">Gerencie as origens e grupos de origens de suas oportunidades imobiliárias.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={sourcesTab === 'SOURCES' ? handleOpenCreateSource : handleOpenCreateGroup}
                className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar {sourcesTab === 'SOURCES' ? 'Origem' : 'Grupo'}</span>
              </button>
            </div>
          </div>

          {/* Seletor Tipo: Origens ou Grupo de Origens (com bolinha de rádio) */}
          <div className="flex items-center gap-6 border-b border-slate-100 pb-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSourcesTab('SOURCES')}
              className={`flex items-center gap-2 cursor-pointer pb-1 transition ${
                sourcesTab === 'SOURCES'
                  ? 'text-emerald-700 font-bold border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                sourcesTab === 'SOURCES' ? 'border-emerald-600' : 'border-slate-300'
              }`}>
                {sourcesTab === 'SOURCES' && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
              </span>
              <span>Origens ({leadSources.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSourcesTab('GROUPS')}
              className={`flex items-center gap-2 cursor-pointer pb-1 transition ${
                sourcesTab === 'GROUPS'
                  ? 'text-emerald-700 font-bold border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                sourcesTab === 'GROUPS' ? 'border-emerald-600' : 'border-slate-300'
              }`}>
                {sourcesTab === 'GROUPS' && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
              </span>
              <span>Grupo de Origens ({leadSourceGroups.length})</span>
            </button>
          </div>

          {/* TABELA DE ORIGENS */}
          {sourcesTab === 'SOURCES' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-1/4">
                      <div className="mb-1">NOME ▲</div>
                      <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={sourceSearchName}
                        onChange={(e) => setSourceSearchName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-28">
                      <div className="mb-1">ID</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3 w-1/3">
                      <div className="mb-1">DESCRIÇÃO ▲</div>
                      <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={sourceSearchDesc}
                        onChange={(e) => setSourceSearchDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">
                      <div className="mb-1">GRUPO DE ORIGENS</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3 text-center w-20">
                      <div className="mb-1">STATUS</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3 text-right w-20">
                      <div className="mb-1">AÇÕES</div>
                      <div className="h-6" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSources.map((source) => {
                    const group = leadSourceGroups.find(g => g.id === source.groupId);
                    return (
                      <tr key={source.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {source.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {source.id.replace(/^(src-|source-)/, '').slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {source.description || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {group ? (
                            <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                              {group.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sem grupo</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSourceStatus(source)}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer mx-auto ${
                              source.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                            title={source.isActive ? 'Ativo (clique para desativar)' : 'Inativo (clique para ativar)'}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSource(source)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja excluir a origem "${source.name}"?`)) {
                                  deleteLeadSource(source.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSources.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhuma origem encontrada para os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TABELA DE GRUPOS DE ORIGENS */}
          {sourcesTab === 'GROUPS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-1/3">
                      <div className="mb-1">NOME DO GRUPO ▲</div>
                      <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={sourceSearchName}
                        onChange={(e) => setSourceSearchName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-28">
                      <div className="mb-1">ID</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3">
                      <div className="mb-1">DESCRIÇÃO ▲</div>
                      <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={sourceSearchDesc}
                        onChange={(e) => setSourceSearchDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </th>
                    <th className="py-2.5 px-3 text-center w-28">
                      <div className="mb-1">ORIGENS VINCULADAS</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3 text-center w-20">
                      <div className="mb-1">STATUS</div>
                      <div className="h-6" />
                    </th>
                    <th className="py-2.5 px-3 text-right w-20">
                      <div className="mb-1">AÇÕES</div>
                      <div className="h-6" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGroups.map((group) => {
                    const linkedSourcesCount = leadSources.filter(s => s.groupId === group.id).length;
                    return (
                      <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {group.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {group.id.replace(/^(grp-|group-)/, '').slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {group.description || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[11px]">
                            {linkedSourcesCount} origens
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleGroupStatus(group)}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer mx-auto ${
                              group.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                            title={group.isActive ? 'Ativo (clique para desativar)' : 'Inativo (clique para ativar)'}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditGroup(group)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja excluir o grupo "${group.name}"?`)) {
                                  deleteLeadSourceGroup(group.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum grupo de origens encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 2: MOTIVOS DE PERDA (ESTILO BENCHMARK PIPERUN)                      */}
      {/* ========================================================================= */}
      {activeSection === 'LOSS_REASONS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* Header da Subseção */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-slate-400 font-medium mb-1">
                Home / Ajustes e configurações / <strong className="text-slate-600">Motivos de perda</strong>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Motivos de perda</h3>
              <p className="text-xs text-slate-500">Gerencie os motivos de perda de suas oportunidades e segregue por funil de vendas.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreateLossReason}
                className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar motivo</span>
              </button>
            </div>
          </div>

          {/* Tabela de Motivos de Perda */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-1/2">
                    <div className="mb-1">MOTIVO ▲</div>
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={lossSearchQuery}
                      onChange={(e) => setLossSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </th>
                  <th className="py-2.5 px-3">
                    <div className="mb-1">FUNIL</div>
                    <select
                      value={lossFilterPipelineId}
                      onChange={(e) => setLossFilterPipelineId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-normal text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Selecione um ou mais funis (Todos)</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="py-2.5 px-3 text-center w-24">
                    <div className="mb-1">STATUS ▲</div>
                    <div className="h-6" />
                  </th>
                  <th className="py-2.5 px-3 text-right w-20">
                    <div className="mb-1">AÇÕES</div>
                    <div className="h-6" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLossReasons.map((reason) => {
                  const isGlobal = !reason.pipelineIds || reason.pipelineIds.length === 0;
                  const linkedPipelineNames = isGlobal 
                    ? 'Todos os funis' 
                    : reason.pipelineIds
                        ?.map(id => pipelines.find(p => p.id === id)?.name || id)
                        .join(', ');

                  return (
                    <tr key={reason.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        <div>{reason.name}</div>
                        {reason.description && (
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5">{reason.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                          isGlobal ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {linkedPipelineNames}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleLossReasonStatus(reason)}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer mx-auto ${
                            reason.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                          title={reason.isActive ? 'Ativo (clique para desativar)' : 'Inativo (clique para ativar)'}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditLossReason(reason)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja excluir o motivo de perda "${reason.name}"?`)) {
                                deleteLossReason(reason.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredLossReasons.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Nenhum motivo de perda cadastrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 3: FUNIS E ETAPAS (ESTILO BENCHMARK PIPERUN)                        */}
      {/* ========================================================================= */}
      {activeSection === 'PIPELINES' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-slate-400 font-medium mb-1">
                Home / Ajustes e configurações / <strong className="text-slate-600">Funis e etapas</strong>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Funis e etapas</h3>
              <p className="text-xs text-slate-500">Gerencie os funis e suas etapas de maneira simples para adaptar ao seu processo de vendas.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreatePipeline}
                className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Funil</span>
              </button>
            </div>
          </div>

          {/* Grid de Funis com Colunas Visuais de Etapas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pipelines.map(pipeline => {
              const pDeals = deals.filter(d => (!d.pipelineId && pipeline.id === 'default-sales') || d.pipelineId === pipeline.id);
              const isCurrentActive = pipeline.id === currentPipeline.id;

              return (
                <div key={pipeline.id} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-2xs">
                  {/* Cabeçalho do Card de Funil */}
                  <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Funil com {pipeline.stages.length} etapas
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {pipeline.name}
                        {isCurrentActive && (
                          <span className="text-[9.5px] bg-[#3742AC]/10 text-[#3742AC] font-bold px-1.5 py-0.2 rounded">
                            Ativo
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-500">{pDeals.length} negócios cadastrados</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPipeline(pipeline.id)}
                        className="p-1.5 text-slate-400 hover:text-[#3742AC] hover:bg-[#3742AC]/10 rounded-lg transition cursor-pointer"
                        title="Editar Funil e Etapas"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {pipelines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (pDeals.length > 0) {
                              alert(`Não é possível excluir o funil "${pipeline.name}" pois ele possui ${pDeals.length} oportunidade(s). Migre os negócios primeiro.`);
                              return;
                            }
                            if (confirm(`Deseja realmente remover o funil "${pipeline.name}"?`)) {
                              deletePipeline(pipeline.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Excluir Funil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Etapas em Lista de Cards Verticais (Estilo PipeRun) */}
                  <div className="p-3 space-y-2 flex-1">
                    {pipeline.stages.map((stage, idx) => (
                      <div 
                        key={stage.id} 
                        className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: stage.colorHex || '#3b82f6' }} 
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{stage.name}</span>
                            <span className="text-[10px] text-slate-400">
                              SLA: {stage.slaHours ? `${stage.slaHours}h` : 'Sem SLA'}
                              {stage.isWon ? ' • 🏆 Ganho' : stage.isLost ? ' • ❌ Perda' : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé: Ação Rápida */}
                  <div className="p-3 bg-white border-t border-slate-200 text-center">
                    <button
                      type="button"
                      onClick={() => setCurrentPipelineById(pipeline.id)}
                      className={`w-full py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isCurrentActive
                          ? 'bg-slate-100 text-slate-500 cursor-default'
                          : 'bg-[#3742AC]/10 hover:bg-[#3742AC]/20 text-[#3742AC]'
                      }`}
                      disabled={isCurrentActive}
                    >
                      {isCurrentActive ? 'Funil Ativo no Kanban' : 'Ativar no Kanban'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR / EDITAR ORIGEM                                          */}
      {/* ========================================================================= */}
      {isSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{editingSource ? 'Editar Origem' : 'Adicionar Origem'}</h3>
                <p className="text-[11px] text-slate-400">Classificação de canais de atração de leads</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSourceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSource} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome da Origem *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instagram Ads, Indicação de Parceiro, Google..."
                  value={sourceFormName}
                  onChange={(e) => setSourceFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Grupo de Origens</label>
                <select
                  value={sourceFormGroupId}
                  onChange={(e) => setSourceFormGroupId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Sem grupo (Avulso)</option>
                  {leadSourceGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o canal..."
                  value={sourceFormDesc}
                  onChange={(e) => setSourceFormDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={sourceFormActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setSourceFormActive(e.target.value === 'ACTIVE')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSourceModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Origem</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR / EDITAR GRUPO DE ORIGENS                                */}
      {/* ========================================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{editingGroup ? 'Editar Grupo' : 'Adicionar Grupo de Origens'}</h3>
                <p className="text-[11px] text-slate-400">Agrupador de canais (Ex: Redes Sociais, Anúncios, Indicação)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Grupo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Redes Sociais, Portais Imobiliários..."
                  value={groupFormName}
                  onChange={(e) => setGroupFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Finalidade do grupo..."
                  value={groupFormDesc}
                  onChange={(e) => setGroupFormDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={groupFormActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setGroupFormActive(e.target.value === 'ACTIVE')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Grupo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR / EDITAR MOTIVO DE PERDA (ESTILO BENCHMARK PIPERUN)      */}
      {/* ========================================================================= */}
      {isLossModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-white p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingLossReason ? 'Editar motivo de perda' : 'Adicionar motivo de perda'}
              </h3>
              <button
                type="button"
                onClick={() => setIsLossModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLossReason} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Motivo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Análise de Crédito Recusada"
                    value={lossFormName}
                    onChange={(e) => setLossFormName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={lossFormActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setLossFormActive(e.target.value === 'ACTIVE')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Explicação detalhada para orientar a equipe..."
                  value={lossFormDesc}
                  onChange={(e) => setLossFormDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Seleção de Funis (Estilo PipeRun) */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">
                  Disponibilidade no Funil
                </label>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={lossFormAllPipelines}
                      onChange={(e) => {
                        setLossFormAllPipelines(e.target.checked);
                        if (e.target.checked) setLossFormPipelineIds([]);
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Disponível em todos os funis</span>
                  </label>

                  {!lossFormAllPipelines && (
                    <div className="pt-2 pl-4 border-t border-slate-200 space-y-1.5">
                      <span className="text-[11px] text-slate-500 block">Selecione os funis aplicáveis:</span>
                      {pipelines.map(pip => {
                        const isChecked = lossFormPipelineIds.includes(pip.id);
                        return (
                          <label key={pip.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setLossFormPipelineIds(prev => [...prev, pip.id]);
                                } else {
                                  setLossFormPipelineIds(prev => prev.filter(id => id !== pip.id));
                                }
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{pip.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLossModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Motivo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR FUNIL & ETAPAS                                      */}
      {/* ========================================================================= */}
      {isPipelineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{editingPipelineId ? 'Editar Funil & Etapas' : 'Novo Funil de Vendas'}</h3>
                <p className="text-[11px] text-slate-400">Configure etapas, tempos de SLA e objetivos de ganho</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPipelineModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePipeline} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Funil *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vendas Residencial, Locação, Captação..."
                  value={pipelineFormName}
                  onChange={(e) => setPipelineFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-[#3742AC]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-700">Etapas do Funil ({pipelineStagesList.length})</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newSt: PipelineStage = {
                        id: `st-${Date.now()}-${pipelineStagesList.length + 1}`,
                        pipelineId: editingPipelineId || '',
                        name: `Nova Etapa ${pipelineStagesList.length + 1}`,
                        order: pipelineStagesList.length + 1,
                        slaHours: 24,
                        colorHex: '#3b82f6',
                        isWon: false,
                        isLost: false,
                      };
                      setPipelineStagesList(prev => [...prev, newSt]);
                    }}
                    className="text-[11px] text-[#3742AC] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Etapa</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {pipelineStagesList.map((st, idx) => (
                    <div key={st.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="color"
                            value={st.colorHex || '#3b82f6'}
                            onChange={(e) => {
                              const updated = [...pipelineStagesList];
                              updated[idx].colorHex = e.target.value;
                              setPipelineStagesList(updated);
                            }}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={st.name}
                            onChange={(e) => {
                              const updated = [...pipelineStagesList];
                              updated[idx].name = e.target.value;
                              setPipelineStagesList(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-semibold focus:outline-none focus:border-[#3742AC]"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx === 0) return;
                              const updated = [...pipelineStagesList];
                              const temp = updated[idx - 1];
                              updated[idx - 1] = updated[idx];
                              updated[idx] = temp;
                              setPipelineStagesList(updated);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === pipelineStagesList.length - 1}
                            onClick={() => {
                              if (idx === pipelineStagesList.length - 1) return;
                              const updated = [...pipelineStagesList];
                              const temp = updated[idx + 1];
                              updated[idx + 1] = updated[idx];
                              updated[idx] = temp;
                              setPipelineStagesList(updated);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {pipelineStagesList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPipelineStagesList(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 gap-4 pt-1 border-t border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <span>SLA de permanência:</span>
                          <input
                            type="number"
                            min="0"
                            value={st.slaHours ?? 24}
                            onChange={(e) => {
                              const updated = [...pipelineStagesList];
                              updated[idx].slaHours = Number(e.target.value);
                              setPipelineStagesList(updated);
                            }}
                            className="w-14 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono"
                          />
                          <span>horas</span>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-800">
                          <input
                            type="checkbox"
                            checked={!!st.isWon}
                            onChange={(e) => {
                              const updated = [...pipelineStagesList];
                              updated[idx].isWon = e.target.checked;
                              setPipelineStagesList(updated);
                            }}
                            className="rounded text-emerald-600"
                          />
                          <span>Etapa de Ganho (🏆)</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPipelineModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-[#3742AC] hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Funil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
