'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Bot, 
  CheckCircle2, 
  Building2, 
  UserCheck, 
  UserMinus, 
  AlertCircle, 
  Play, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useCRM } from '@/lib/crm-context';

interface BatchAIQualificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const BatchAIQualificationModal: React.FC<BatchAIQualificationModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { 
    conversations, 
    contacts, 
    messages, 
    aiInsights, 
    currentUser, 
    currentTenant, 
    applyBatchAIQualifications 
  } = useCRM();

  const [mode, setMode] = useState<'PENDING' | 'ALL'>('PENDING');
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentContactName, setCurrentContactName] = useState('');
  const [leadsFound, setLeadsFound] = useState(0);
  const [personalFound, setPersonalFound] = useState(0);

  const abortRef = useRef(false);

  // Mapeamento rápido de contatos por ID
  const contactMap = useMemo(() => {
    const map = new Map<string, typeof contacts[0]>();
    contacts.forEach(c => map.set(c.id, c));
    return map;
  }, [contacts]);

  // Conversas ativas e elegíveis
  const eligibleConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (conv.isArchived) return false;
      const contact = contactMap.get(conv.contactId);
      if (!contact) return false;

      if (mode === 'PENDING') {
        const hasInsight = Boolean(aiInsights[conv.id]);
        const isClassified = contact.isPersonal !== undefined && contact.isPersonal !== null;
        // Elegível se ainda não tiver insight ou não tiver sido classificado
        return !hasInsight || !isClassified;
      }
      return true;
    });
  }, [conversations, contactMap, aiInsights, mode]);

  if (!isOpen) return null;

  const handleStartBatch = async () => {
    if (eligibleConversations.length === 0) return;

    setIsRunning(true);
    setIsCompleted(false);
    setErrorMsg(null);
    abortRef.current = false;

    const total = eligibleConversations.length;
    setTotalCount(total);
    setCurrentProgress(0);
    setLeadsFound(0);
    setPersonalFound(0);

    const CHUNK_SIZE = 10;
    const allResults: any[] = [];
    let accumulatedLeads = 0;
    let accumulatedPersonal = 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (abortRef.current) break;

      const chunk = eligibleConversations.slice(i, i + CHUNK_SIZE);
      const itemsPayload = chunk.map(conv => {
        const contact = contactMap.get(conv.contactId);
        const convMsgs = messages
          .filter(m => m.conversationId === conv.id && !m.isInternalNote && m.content)
          .map(m => ({
            sender: m.senderType === 'USER' ? ('BROKER' as const) : ('CLIENT' as const),
            text: m.content,
          }));

        const chatHistory = convMsgs.length > 0 
          ? convMsgs 
          : [{ sender: 'CLIENT' as const, text: conv.lastMessagePreview || 'Olá' }];

        return {
          conversationId: conv.id,
          contactId: conv.contactId,
          contactName: contact?.name || 'Cliente',
          chatHistory,
          contactContext: {
            name: contact?.name,
            tags: contact?.tags,
            whatsappLabels: contact?.whatsappLabels,
            monthlyIncome: contact?.monthlyIncome,
            downPaymentAvailable: contact?.downPaymentAvailable,
            maxPropertyValue: contact?.maxPropertyValue,
            preferredPropertyType: contact?.preferredPropertyType,
            targetRegions: contact?.targetRegions,
          }
        };
      });

      if (chunk[0]) {
        const firstContact = contactMap.get(chunk[0].contactId);
        setCurrentContactName(firstContact?.name || 'Analisando lote...');
      }

      try {
        const res = await fetch('/api/v1/ai/batch-qualify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsPayload,
            brokerName: currentUser?.name || 'Corretor',
            aiConfig: currentTenant?.aiConfig,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Falha na requisição (Status ${res.status})`);
        }

        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          allResults.push(...data.results);
          accumulatedLeads += (data.leadsCount || 0);
          accumulatedPersonal += (data.personalCount || 0);
          setLeadsFound(accumulatedLeads);
          setPersonalFound(accumulatedPersonal);
        }
      } catch (err: any) {
        console.error('[BatchAIQualification] Erro no chunk:', err);
        setErrorMsg(`Aviso: Falha ao processar parte das conversas (${err.message}). Prosseguindo com as demais...`);
      }

      const processedSoFar = Math.min(i + CHUNK_SIZE, total);
      setCurrentProgress(processedSoFar);

      // Pequena pausa para animação suave da barra
      await new Promise(r => setTimeout(r, 60));
    }

    // Salva em lote no CRM se tivermos resultados
    if (allResults.length > 0) {
      applyBatchAIQualifications(allResults);
    }

    setIsRunning(false);
    setIsCompleted(true);
  };

  const handleCancel = () => {
    abortRef.current = true;
    setIsRunning(false);
  };

  const handleFinish = () => {
    onClose();
    if (onComplete) onComplete();
  };

  const percent = totalCount > 0 ? Math.round((currentProgress / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#3742AC] to-indigo-600 text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Qualificação em Massa com IA</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                  Copilot Pro
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Classifique toda a sua base de conversas do WhatsApp em segundos
              </p>
            </div>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!isRunning && !isCompleted && (
            <>
              {/* Card de Apresentação das Funcionalidades */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">O que a IA fará automaticamente:</span>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <UserMinus className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span><strong>Separar Contatos Pessoais:</strong> Conversas com familiares, amigos e rotina são marcadas como <em>Não-Lead</em> (score 0%, sem poluir o funil).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Qualificar Leads Imobiliários:</strong> Extrai intenção de compra, tipo de imóvel, orçamento, entrada disponível e regiões de busca.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Gerar Resumo do Perfil 360º:</strong> Cria síntese tática imediata de cada cliente no CRM.</span>
                  </div>
                </div>
              </div>

              {/* Seletor de Modo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Escolha o escopo da qualificação:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('PENDING')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      mode === 'PENDING'
                        ? 'border-[#3742AC] bg-indigo-50/50 text-[#3742AC] ring-2 ring-[#3742AC]/20 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="text-xs">Apenas Pendentes</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Analisa conversas novas ainda não classificadas
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('ALL')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      mode === 'ALL'
                        ? 'border-[#3742AC] bg-indigo-50/50 text-[#3742AC] ring-2 ring-[#3742AC]/20 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="text-xs">Toda a Base</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Reavalia e limpa todas as conversas do zero
                    </div>
                  </button>
                </div>
              </div>

              {/* Contagem de Elegíveis */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100/70 rounded-xl text-xs">
                <span className="text-slate-600">Conversas a processar:</span>
                <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                  {eligibleConversations.length} conversas
                </span>
              </div>
            </>
          )}

          {/* Estado em Execução */}
          {isRunning && (
            <div className="space-y-5 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#3742AC] animate-spin" />
                  <span className="text-xs font-bold text-slate-800">
                    Processando conversas ({currentProgress} de {totalCount})...
                  </span>
                </div>
                <span className="text-xs font-extrabold font-mono text-[#3742AC]">
                  {percent}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-[#3742AC] via-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Detalhe do contato atual */}
              {currentContactName && (
                <div className="text-center text-[11px] text-slate-500 truncate">
                  Analisando: <strong className="text-slate-800">{currentContactName}</strong>
                </div>
              )}

              {/* Placar em Tempo Real */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Leads Imobiliários</span>
                  <span className="text-2xl font-black text-emerald-700">{leadsFound}</span>
                </div>
                <div className="p-3 bg-slate-100/80 border border-slate-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Contatos Pessoais</span>
                  <span className="text-2xl font-black text-slate-700">{personalFound}</span>
                </div>
              </div>
            </div>
          )}

          {/* Estado Concluído */}
          {isCompleted && (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  Qualificação em Massa Concluída!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Todas as conversas selecionadas foram analisadas pelo motor semântico Copilot.
                </p>
              </div>

              {/* Resumo Final */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">🏢 Leads Imobiliários</span>
                  <span className="text-2xl font-black text-emerald-700">{leadsFound}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">Prontos no Funil</span>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">👤 Contatos Pessoais</span>
                  <span className="text-2xl font-black text-slate-700">{personalFound}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Separados da Rotina</span>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          {!isRunning && !isCompleted && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartBatch}
                disabled={eligibleConversations.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#3742AC] to-indigo-600 hover:from-[#2e3792] hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Qualificação ({eligibleConversations.length})</span>
              </button>
            </>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
            >
              Interromper Análise
            </button>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
            >
              Concluir e Ver Resultados
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
