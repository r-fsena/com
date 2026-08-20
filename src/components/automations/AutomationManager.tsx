'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Users, 
  Tag, 
  ArrowRight, 
  FileText, 
  Activity, 
  AlertTriangle,
  Bot
} from 'lucide-react';
import { AutomationRule, AutomationTriggerType, AutomationActionType } from '@/types/crm';
import { MOCK_AUTOMATIONS, MOCK_AUTOMATION_LOGS } from '@/lib/mock-data';
import { safeFormatDate } from '@/lib/date-utils';

export function AutomationManager() {
  const [automations, setAutomations] = useState<AutomationRule[]>(MOCK_AUTOMATIONS as any);
  const [logs] = useState(MOCK_AUTOMATION_LOGS);
  const [activeTab, setActiveTab] = useState<'RULES' | 'LOGS'>('RULES');
  const [showBuilder, setShowBuilder] = useState(false);

  // Form State do Workflow Builder
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('LEAD_CREATED');
  const [conditionField, setConditionField] = useState('temperature');
  const [conditionValue, setConditionValue] = useState('HOT');
  const [actionType, setActionType] = useState<AutomationActionType>('ASSIGN_BROKER_ROUND_ROBIN');

  const toggleRule = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule: AutomationRule = {
      id: `auto-${Date.now()}`,
      tenantId: 'tenant-vanguard-01',
      name: ruleName.trim(),
      description: ruleDescription.trim() || 'Regra de automação customizada',
      triggerType,
      isActive: true,
      conditions: [
        { field: conditionField, operator: 'EQUALS', value: conditionValue }
      ],
      actions: [
        { actionType, config: {} }
      ],
      executionCount: 0,
      createdAt: new Date().toISOString(),
    };

    setAutomations(prev => [newRule, ...prev]);
    setRuleName('');
    setRuleDescription('');
    setShowBuilder(false);
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'LEAD_CREATED': return '⚡ Novo Lead Criado (WhatsApp/Manual)';
      case 'STAGE_CHANGED': return '🔄 Mudança de Etapa no Kanban';
      case 'LEAD_INACTIVE': return '⏳ Inatividade de Lead > SLA';
      case 'MESSAGE_RECEIVED': return '💬 Nova Mensagem Recebida';
      default: return type;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'ASSIGN_BROKER_ROUND_ROBIN': return '👤 Atribuir Corretor por Rodízio';
      case 'CREATE_TASK': return '📋 Criar Tarefa com SLA';
      case 'ADD_TAG': return '🏷️ Aplicar Tag no Lead';
      case 'NOTIFY_TEAM': return '🔔 Notificar Gestão Comercial';
      default: return type;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Motor de Automações & Regras Comerciais</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {automations.filter(a => a.isActive).length} ativas
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatize distribuição de leads, criação de tarefas, alertas de inatividade e cadências de WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Pill */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('RULES')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'RULES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Regras do Fluxo
            </button>
            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'LOGS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Logs de Execução ({logs.length})</span>
            </button>
          </div>

          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Automação</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-4">
        {activeTab === 'RULES' ? (
          automations.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white rounded-2xl p-5 border transition duration-150 shadow-xs ${
                rule.isActive ? 'border-slate-200 hover:border-emerald-500' : 'border-slate-200 opacity-60 bg-slate-50/60'
              }`}
            >
              {/* Header do Card */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    rule.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{rule.name}</h3>
                    <p className="text-xs text-slate-500">{rule.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    rule.isActive
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {rule.isActive ? <Play className="w-3 h-3 fill-emerald-800" /> : <Pause className="w-3 h-3" />}
                  <span>{rule.isActive ? 'Ativa' : 'Pausada'}</span>
                </button>
              </div>

              {/* Workflow Pipeline Visualization */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex flex-wrap items-center gap-2 text-xs font-medium">
                {/* Trigger */}
                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs text-slate-800 font-semibold">
                  {getTriggerLabel(rule.triggerType)}
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                {/* Conditions */}
                {rule.conditions && rule.conditions.length > 0 ? (
                  rule.conditions.map((cond, idx) => (
                    <div key={idx} className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-lg font-mono text-[11px]">
                      Se {cond.field} == '{cond.value}'
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Sem condições extras</span>
                )}

                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  {rule.actions.map((act, idx) => (
                    <div key={idx} className="bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2.5 py-1.5 rounded-lg font-semibold text-[11px]">
                      {getActionLabel(act.actionType)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer com Contador de Execuções */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700 font-mono">
                  {rule.executionCount} execuções registradas
                </span>
                {rule.lastExecutedAt && (
                  <span className="text-[11px] font-mono">
                    Última execução: {safeFormatDate(rule.lastExecutedAt, 'dd/MM/yyyy HH:mm')}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          /* TAB DE LOGS */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Trilha de Auditoria e Execuções das Automações
            </div>
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-slate-900">{log.ruleName}</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {log.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{log.reason}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Lead afetado: <strong>{log.contactName}</strong></p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                  {safeFormatDate(log.executedAt, 'HH:mm • dd/MM')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Workflow Builder */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold">Criar Nova Regra de Automação</h2>
              </div>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Automação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Atribuição Imediata de Leads da Campanha Jardins"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição do Objetivo</label>
                <input
                  type="text"
                  placeholder="Ex: Dispara rodízio e agenda follow-up em 15 minutos"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              {/* Gatilho */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">1</span>
                  Quando acontecer este Gatilho (Trigger):
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium"
                >
                  <option value="LEAD_CREATED">Novo Lead Criado via WhatsApp ou Cadastro</option>
                  <option value="STAGE_CHANGED">Negócio Movido de Etapa no Funil Kanban</option>
                  <option value="LEAD_INACTIVE">Lead Inativo sem Interação há mais de X Horas</option>
                  <option value="MESSAGE_RECEIVED">Nova Mensagem Recebida do Cliente</option>
                </select>
              </div>

              {/* Condições */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center">2</span>
                  Apenas se atender à Condição (Filtro):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="temperature">Temperatura do Lead</option>
                    <option value="source">Origem do Contato</option>
                    <option value="preferredPropertyType">Tipo de Imóvel</option>
                  </select>

                  <input
                    type="text"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="Valor esperado (Ex: HOT)"
                    className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Ações */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] flex items-center justify-center">3</span>
                  Executar as seguintes Ações Automáticas:
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full text-xs bg-white border border-emerald-200 rounded-xl px-3 py-2 focus:outline-none font-medium"
                >
                  <option value="ASSIGN_BROKER_ROUND_ROBIN">Atribuir Corretor via Rodízio Circular</option>
                  <option value="CREATE_TASK">Criar Tarefa de 1º Atendimento com SLA</option>
                  <option value="ADD_TAG">Adicionar Tag Comercial ao Perfil</option>
                  <option value="NOTIFY_TEAM">Notificar Gestão Comercial</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md"
                >
                  Salvar e Ativar Automação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
