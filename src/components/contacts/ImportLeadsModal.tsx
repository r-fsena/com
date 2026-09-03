'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Users, 
  Sparkles, 
  ArrowRight,
  HelpCircle,
  Building,
  DollarSign,
  Smartphone,
  RefreshCw,
  MessageSquare,
  Check,
  Phone,
  Search,
  Filter,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { Contact, Deal } from '@/types/crm';
import { parseCSVContent, parseVCFContent, normalizePhoneNumber, ParsedContactRecord } from '@/lib/vcf-parser';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

interface WhatsAppChatPreview {
  id: string;
  phone: string;
  phoneDisplay: string;
  lid?: string;
  name: string;
  hasRealName: boolean;
  avatarUrl: string;
  lastMessagePreview: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  isGroup: boolean;
  whatsappLabels?: string[];
}

export function ImportLeadsModal({ isOpen, onClose, onSuccess }: ImportLeadsModalProps) {
  const { 
    currentUser,
    instances,
    contacts,
    importWhatsAppBatch,
    importFileContacts,
    currentPipeline
  } = useCRM();
  
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'FILE'>('WHATSAPP');
  
  // Estados do WhatsApp Wizard
  const [historyDays, setHistoryDays] = useState<number>(0);
  const [onlyWithName, setOnlyWithName] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW_ONLY' | 'EXISTING_ONLY'>('ALL');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('ALL');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [previewChats, setPreviewChats] = useState<WhatsAppChatPreview[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedPhoneSet, setSelectedPhoneSet] = useState<Set<string>>(new Set());

  // Conjunto de telefones higienizados já cadastrados no CRM
  const existingPhoneDigits = useMemo(() => {
    return new Set(
      contacts.map(c => (c.phone || '').replace(/\D/g, '')).filter(Boolean)
    );
  }, [contacts]);

  const isChatInCRM = (phoneStr: string) => {
    const digits = (phoneStr || '').replace(/\D/g, '');
    if (!digits) return false;
    for (const existing of Array.from(existingPhoneDigits)) {
      if (existing === digits || existing.endsWith(digits) || digits.endsWith(existing)) {
        return true;
      }
    }
    return false;
  };

  // Contadores dinâmicos de Novos Leads vs Já Importados
  const counts = useMemo(() => {
    const valid = previewChats.filter(c => !c.isGroup);
    let newCount = 0;
    let existingCount = 0;
    valid.forEach(c => {
      if (isChatInCRM(c.phone)) existingCount++;
      else newCount++;
    });
    return { total: valid.length, newCount, existingCount };
  }, [previewChats, existingPhoneDigits]);
  
  // Estados de Execução em Lotes (Batch Progress)
  const [isBatchImporting, setIsBatchImporting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; percent: number; currentName?: string }>({
    current: 0,
    total: 0,
    percent: 0,
  });
  const [batchCompleted, setBatchCompleted] = useState<boolean>(false);
  const [importedCount, setImportedCount] = useState<number>(0);

  // Estados de Importação por Arquivo (VCF / CSV)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedFileRecords, setParsedFileRecords] = useState<ParsedContactRecord[]>([]);
  const [isFileProcessing, setIsFileProcessing] = useState<boolean>(false);
  const [fileImportSuccess, setFileImportSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configurações Gerais
  const [assignedBrokerId, setAssignedBrokerId] = useState<string>(currentUser.id);
  const [createDealsInKanban, setCreateDealsInKanban] = useState<boolean>(true);

  // 1. Carrega o Preview de Chats do WhatsApp ao abrir modal ou trocar período
  const loadWhatsAppPreview = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const brokerInst = instances.find(i => i.assignedUserId === currentUser.id) || instances[0];
      const res = await fetch('/api/v1/zapi/preview-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: brokerInst?.zapiInstanceId || brokerInst?.id,
          historyDays,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        setPreviewChats(data.chats);
        if (Array.isArray(data.availableLabels)) {
          setAvailableLabels(data.availableLabels);
        }
        // Pré-seleciona estritamente os contatos que AINDA NÃO estão no CRM (Novos Leads)
        const newChats = data.chats.filter((c: WhatsAppChatPreview) => !isChatInCRM(c.phone));
        setSelectedPhoneSet(new Set(newChats.map((c: WhatsAppChatPreview) => c.phone)));
      } else {
        setPreviewError(data.error || 'Nenhum chat individual encontrado no período selecionado.');
        setPreviewChats([]);
      }
    } catch (err: any) {
      setPreviewError('Falha ao conectar com o WhatsApp para buscar contatos.');
      setPreviewChats([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'WHATSAPP') {
      loadWhatsAppPreview();
    }
  }, [isOpen, activeTab, historyDays]);

  // Filtra chats pela busca, etiqueta, opção de "Apenas com nome" e status de importação
  const filteredChats = useMemo(() => {
    return previewChats.filter(chat => {
      if (chat.isGroup) return false;
      if (onlyWithName && !chat.hasRealName) return false;
      const isAlreadyImported = isChatInCRM(chat.phone);
      if (statusFilter === 'NEW_ONLY' && isAlreadyImported) return false;
      if (statusFilter === 'EXISTING_ONLY' && !isAlreadyImported) return false;
      if (selectedLabelFilter !== 'ALL') {
        if (!chat.whatsappLabels || !chat.whatsappLabels.includes(selectedLabelFilter)) return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        chat.name.toLowerCase().includes(term) ||
        chat.phone.includes(term) ||
        chat.phoneDisplay.includes(term) ||
        chat.lastMessagePreview.toLowerCase().includes(term) ||
        (chat.whatsappLabels && chat.whatsappLabels.some(l => l.toLowerCase().includes(term)))
      );
    });
  }, [previewChats, onlyWithName, statusFilter, selectedLabelFilter, searchTerm, existingPhoneDigits]);

  // Ações de Seleção
  const toggleSelectPhone = (phone: string) => {
    setSelectedPhoneSet(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const handleSelectOnlyNew = () => {
    const newPhones = filteredChats
      .filter(c => !isChatInCRM(c.phone))
      .map(c => c.phone);
    setSelectedPhoneSet(new Set(newPhones));
  };

  const handleSelectAllFiltered = () => {
    const allFilteredSelected = filteredChats.every(c => selectedPhoneSet.has(c.phone));
    if (allFilteredSelected) {
      setSelectedPhoneSet(prev => {
        const next = new Set(prev);
        filteredChats.forEach(c => next.delete(c.phone));
        return next;
      });
    } else {
      setSelectedPhoneSet(prev => {
        const next = new Set(prev);
        filteredChats.forEach(c => next.add(c.phone));
        return next;
      });
    }
  };

  // 2. Execução da Importação em Lotes com Histórico Leve e Tags
  const handleStartBatchImport = async () => {
    const selectedList = previewChats.filter(c => selectedPhoneSet.has(c.phone));
    if (selectedList.length === 0) return;

    setIsBatchImporting(true);
    setBatchCompleted(false);
    setImportedCount(0);

    const CHUNK_SIZE = 8; // Lotes de 8 contatos por vez
    const totalItems = selectedList.length;
    let processed = 0;

    setBatchProgress({
      current: 0,
      total: totalItems,
      percent: 0,
    });

    try {
      for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunk = selectedList.slice(i, i + CHUNK_SIZE);
        const currentItemName = chunk[0]?.name;

        setBatchProgress({
          current: Math.min(i + CHUNK_SIZE, totalItems),
          total: totalItems,
          percent: Math.round(((i + CHUNK_SIZE) / totalItems) * 100),
          currentName: currentItemName,
        });

        const brokerInst = instances.find(i => i.assignedUserId === currentUser.id) || instances[0];
        const res = await fetch('/api/v1/zapi/batch-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: chunk.map(c => ({
              phone: c.phone,
              name: c.name,
              lid: c.lid,
              avatarUrl: c.avatarUrl,
              whatsappLabels: c.whatsappLabels || [],
            })),
            historyLimit: 15, // Contexto inicial de 15 mensagens por conversa
            assignedUserId: assignedBrokerId,
            instanceId: brokerInst?.zapiInstanceId || brokerInst?.id,
          }),
        });

        const data = await res.json();
        if (data.success) {
          importWhatsAppBatch({
            contacts: data.contacts || [],
            conversations: data.conversations || [],
            messages: data.messages || [],
          });
          processed += (data.count || chunk.length);
        }

        // Pausa suave de 300ms entre lotes
        await new Promise(r => setTimeout(r, 300));
      }

      setImportedCount(processed);
      setBatchCompleted(true);
      if (onSuccess) onSuccess(processed);
    } catch (err) {
      console.error('Erro durante a importação em lotes:', err);
    } finally {
      setIsBatchImporting(false);
    }
  };

  // 3. Parser e Upload de Arquivo (VCF / CSV)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsFileProcessing(true);
    setFileImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || '';
      const isVCF = file.name.toLowerCase().endsWith('.vcf') || file.name.toLowerCase().endsWith('.vcard');
      
      let parsed: ParsedContactRecord[] = [];
      if (isVCF) {
        parsed = parseVCFContent(text);
      } else {
        parsed = parseCSVContent(text);
      }

      setParsedFileRecords(parsed);
      setIsFileProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleConfirmFileImport = () => {
    if (parsedFileRecords.length === 0) return;
    const result = importFileContacts(parsedFileRecords, assignedBrokerId, createDealsInKanban);
    setFileImportSuccess(true);
    setImportedCount(result.count);
    if (onSuccess) onSuccess(result.count);
  };

  // 4. Download de Modelo de Planilha CSV
  const handleDownloadTemplate = () => {
    const csvHeader = 'Nome;Telefone;Email;Renda_Mensal;Entrada_Disponivel;Orcamento_Maximo;Tipo_Imovel;Regioes;Temperatura;Origem;Tags;Notas';
    const sampleRows = [
      '"Rafael Sena";"+55 (48) 9107-9478";"rafael.sena@exemplo.com";"45000";"300000";"1200000";"Cobertura";"Batel; Ecoville";"HOT";"WhatsApp";"Alto Padrão; Investidor";"Procura cobertura duplex com 3 suítes"',
      '"Mariana Guimarães";"+55 (11) 98877-6655";"mariana.guimaraes@exemplo.com";"28000";"200000";"850000";"Casa";"Alphaville";"WARM";"Indicação";"Família; 3 Quartos";"Busca condomínio fechado"',
      '"Dr. Roberto Alencar";"+55 (41) 99122-3344";"dr.alencar@exemplo.com";"60000";"500000";"2500000";"Apartamento";"Graciosa";"HOT";"Instagram Ads";"Investidor";"Interesse em lançamento na planta"',
    ];
    const csvContent = '\uFEFF' + [csvHeader, ...sampleRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_leads_vanguard.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header do Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assistente de Importação de Leads & Etiquetas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Importe contatos com histórico e etiquetas do WhatsApp ou arquivos de agenda (VCF / CSV).
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Escolha */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('WHATSAPP')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'WHATSAPP'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Importar do WhatsApp (com Etiquetas & Histórico)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">
              Z-API Ao Vivo
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FILE')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'FILE'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. Arquivo de Agenda (VCF / Google Contatos / CSV)</span>
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* ========================================================================= */}
          {/* ABA 1: IMPORTAÇÃO DO WHATSAPP COM FILTROS & ETIQUETAS                     */}
          {/* ========================================================================= */}
          {activeTab === 'WHATSAPP' && (
            <div className="space-y-5">
              
              {/* Barra de Filtros Pré-Importação */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Seletor de Período */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Período:</span>
                    <select
                      value={historyDays}
                      onChange={(e) => setHistoryDays(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value={0}>Todo o Histórico (Todos os Leads)</option>
                      <option value={90}>Últimos 90 dias</option>
                      <option value={30}>Últimos 30 dias</option>
                      <option value={15}>Últimos 15 dias</option>
                      <option value={7}>Últimos 7 dias</option>
                    </select>
                  </div>

                  {/* Filtro de Etiquetas do WhatsApp */}
                  {availableLabels.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Etiqueta:</span>
                      <select
                        value={selectedLabelFilter}
                        onChange={(e) => setSelectedLabelFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="ALL">Todas as Etiquetas ({availableLabels.length})</option>
                        {availableLabels.map((lbl) => (
                          <option key={lbl} value={lbl}>{lbl}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filtro: Apenas com Nome */}
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white border border-slate-200 px-3 py-1 rounded-xl hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={onlyWithName}
                      onChange={(e) => setOnlyWithName(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Apenas contatos com nome</span>
                  </label>
                </div>

                {/* Campo de Busca Rápida */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome, número ou tag..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white text-xs rounded-xl pl-8 pr-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Status de Carregamento / Erro */}
              {isLoadingPreview ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Buscando contatos, etiquetas e histórico na Z-API...</p>
                  <p className="text-[11px] text-slate-400">Filtrando grupos e estruturando as etiquetas do WhatsApp Business.</p>
                </div>
              ) : previewError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">{previewError}</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Certifique-se de que a instância do WhatsApp está conectada em <strong>Configurações ➔ Z-API</strong>.
                  </p>
                  <button
                    onClick={loadWhatsAppPreview}
                    className="bg-white border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Cabeçalho da Lista, Filtro de Status e Seleção */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      {/* Abas de Status */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setStatusFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Todos ({counts.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('NEW_ONLY')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            statusFilter === 'NEW_ONLY' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-emerald-700 hover:text-emerald-800'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Novos ({counts.newCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('EXISTING_ONLY')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            statusFilter === 'EXISTING_ONLY' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Já no CRM ({counts.existingCount})</span>
                        </button>
                      </div>

                      {/* Ações de Seleção */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectOnlyNew}
                          className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] flex items-center gap-1"
                          title="Marca apenas leads que ainda não estão no CRM"
                        >
                          <span>✦ Apenas Novos ({counts.newCount})</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer text-[11px]"
                        >
                          {filteredChats.every(c => selectedPhoneSet.has(c.phone)) && filteredChats.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                        <span className="font-bold text-slate-800 text-[11px]">({selectedPhoneSet.size} selecionados)</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Conversas com Preview & Badges de Etiquetas */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {filteredChats.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Nenhuma conversa corresponde aos filtros aplicados.
                      </div>
                    ) : (
                      filteredChats.map((chat) => {
                        const isSelected = selectedPhoneSet.has(chat.phone);
                        const isAlreadyImported = isChatInCRM(chat.phone);
                        return (
                          <div
                            key={chat.phone}
                            onClick={() => toggleSelectPhone(chat.phone)}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                              isSelected 
                                ? 'bg-emerald-50/40' 
                                : isAlreadyImported 
                                ? 'bg-slate-50/30 hover:bg-slate-100/60 opacity-80' 
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                              />
                              <img
                                src={chat.avatarUrl}
                                alt={chat.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                              />
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`text-xs font-bold truncate ${isAlreadyImported ? 'text-slate-700' : 'text-slate-900'}`}>
                                    {chat.name}
                                  </span>
                                  {isAlreadyImported ? (
                                    <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-1">
                                      ✓ Já no CRM
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-1 shadow-2xs">
                                      ✦ Novo Lead
                                    </span>
                                  )}
                                  {chat.hasRealName && (
                                    <span className="text-[9px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full shrink-0">
                                      Agenda
                                    </span>
                                  )}

                                  {/* Badges de Etiquetas do WhatsApp Business */}
                                  {chat.whatsappLabels && chat.whatsappLabels.map((tag) => (
                                    <span 
                                      key={tag}
                                      className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0"
                                    >
                                      <Tag className="w-2.5 h-2.5" />
                                      <span>{tag}</span>
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate max-w-sm">
                                  {chat.lastMessagePreview}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-medium text-slate-600 block">
                                {chat.phoneDisplay}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(chat.lastMessageTimestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Barra de Progresso Durante a Importação em Lotes */}
              {isBatchImporting && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                      <span>Processando Importação em Lotes ({batchProgress.current} de {batchProgress.total} contatos)...</span>
                    </div>
                    <span>{batchProgress.percent}%</span>
                  </div>

                  <div className="w-full bg-emerald-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${batchProgress.percent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-emerald-700">
                    Baixando contexto, etiquetas e histórico de: <strong>{batchProgress.currentName || 'Leads em fila'}</strong>
                  </p>
                </div>
              )}

              {/* Mensagem de Conclusão */}
              {batchCompleted && (
                <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-5 flex items-center justify-between gap-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">Importação Concluída com Sucesso!</h4>
                      <p className="text-[11px] text-emerald-700">
                        {importedCount} leads importados com histórico e etiquetas do WhatsApp salvos no CRM.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Ver Contatos
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: IMPORTAÇÃO POR ARQUIVO (VCF / CSV / GOOGLE CONTATOS)                */}
          {/* ========================================================================= */}
          {activeTab === 'FILE' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Upload de Arquivo de Contatos</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Suporte a <strong>.vcf / .vcard</strong> (iPhone, Android, Google Contatos) e <strong>.csv</strong> (Excel).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-white border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Baixar Planilha Modelo (.CSV)</span>
                  </button>
                </div>

                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition bg-white space-y-2 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".vcf,.vcard,.csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {uploadedFile ? uploadedFile.name : 'Clique para selecionar o arquivo .vcf ou .csv'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Formatos suportados: Agenda Telefônica vCard (.vcf) ou Planilha Separada por Ponto e Vírgula (.csv).
                  </p>
                </div>
              </div>

              {/* Preview dos Contatos do Arquivo */}
              {parsedFileRecords.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                    <span>{parsedFileRecords.length} contatos identificados no arquivo:</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {parsedFileRecords.map((rec, i) => (
                      <div key={i} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">{rec.name}</span>
                          {rec.email && <span className="text-[11px] text-slate-400">{rec.email}</span>}
                        </div>
                        <span className="font-mono text-slate-600 font-semibold">{rec.phone}</span>
                      </div>
                    ))}
                  </div>

                  {fileImportSuccess ? (
                    <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>{importedCount} contatos importados com sucesso!</span>
                      <button
                        type="button"
                        onClick={onClose}
                        className="bg-emerald-700 text-white px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Concluir
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmFileImport}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {parsedFileRecords.length} Contatos</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer com Ação de Importar em Lotes (Aba WhatsApp) */}
        {activeTab === 'WHATSAPP' && !batchCompleted && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Etiquetas e contexto inicial de 15 mensagens por lead com zero risco de bloqueio.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleStartBatchImport}
                disabled={selectedPhoneSet.size === 0 || isBatchImporting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isBatchImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando Lotes...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Iniciar Importação em Lote ({selectedPhoneSet.size} Leads)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
