'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCRM } from '@/lib/crm-context';
import { isWhatsAppChannelOrGroup } from '@/lib/whatsapp-filter';
import { 
  Smartphone,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  Check,
  Tag,
  Clock,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Users,
  Sparkles,
  MessageSquare,
  Building,
  UserCheck,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { Contact } from '@/types/crm';
import { parseCSVContent, parseVCFContent, normalizePhoneNumber, ParsedContactRecord } from '@/lib/vcf-parser';

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

interface WhatsAppImportViewProps {
  onGoToInbox?: () => void;
}

export function WhatsAppImportView({ onGoToInbox }: WhatsAppImportViewProps) {
  const { 
    currentUser,
    users,
    instances,
    importWhatsAppBatch,
    importFileContacts,
    activeSyncJob,
    startBackgroundSync,
  } = useCRM();
  
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'FILE'>('WHATSAPP');
  
  // Estados do WhatsApp Wizard
  const [historyDays, setHistoryDays] = useState<number>(30);
  const [onlyWithName, setOnlyWithName] = useState<boolean>(false);
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('ALL');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [previewChats, setPreviewChats] = useState<WhatsAppChatPreview[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedPhoneSet, setSelectedPhoneSet] = useState<Set<string>>(new Set());
  
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

  // 1. Carrega o Preview de Chats do WhatsApp ao montar ou alterar filtros de dias
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
        // Pré-seleciona todos os contatos inicialmente
        setSelectedPhoneSet(new Set(data.chats.map((c: WhatsAppChatPreview) => c.phone)));
      } else {
        setPreviewError(data.error || 'Nenhuma conversa individual encontrada para o período selecionado.');
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
    if (activeTab === 'WHATSAPP') {
      loadWhatsAppPreview();
    }
  }, [activeTab, historyDays]);

  // Filtra chats pela busca, etiqueta e opção de "Apenas com nome"
  const filteredChats = useMemo(() => {
    return previewChats.filter(chat => {
      if (isWhatsAppChannelOrGroup(chat)) return false;
      if (onlyWithName && !chat.hasRealName) return false;
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
  }, [previewChats, onlyWithName, selectedLabelFilter, searchTerm]);

  // Ações de Seleção
  const toggleSelectPhone = (phone: string) => {
    setSelectedPhoneSet(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
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

    const CHUNK_SIZE = 8;
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
              lastMessagePreview: c.lastMessagePreview,
              lastMessageTimestamp: c.lastMessageTimestamp,
            })),
            historyLimit: 15,
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

        await new Promise(r => setTimeout(r, 250));
      }

      setImportedCount(processed);
      setBatchCompleted(true);
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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-[#F0F3FA]">
      
      {/* Header Principal da Tela de Importação Sovereign */}
      <div className="bg-transparent px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3742AC] text-white flex items-center justify-center shadow-md shadow-indigo-950/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900">Importação de Contatos & Histórico</h1>
                <span className="text-xs font-bold bg-white text-[#3742AC] border border-indigo-100 px-3 py-0.5 rounded-full shadow-2xs">
                  Brokiva WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Importe conversas com etiquetas e contexto de mensagens do WhatsApp ou arquivos de agenda telefônica.
              </p>
            </div>
          </div>
        </div>

        {/* Abas de Navegação Superiores (Estilo Sovereign Pills) */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('WHATSAPP')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'WHATSAPP'
                ? 'bg-[#3742AC] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. WhatsApp Z-API (Histórico & Tags)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FILE')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'FILE'
                ? 'bg-[#3742AC] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. Arquivo de Agenda (VCF / CSV)</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal Fluid com 100% de Tela */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        
        {/* ========================================================================= */}
        {/* ABA 1: IMPORTAÇÃO Z-API WHATSAPP COM FILTROS, ETIQUETAS E LOTES           */}
        {/* ========================================================================= */}
        {activeTab === 'WHATSAPP' && (
          <div className="space-y-6">
            
            {/* Banner de Sincronização Completa em Segundo Plano */}
            <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 z-10 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    ⚡ Recomendado para Corretores
                  </span>
                  {activeSyncJob && (activeSyncJob.status === 'RUNNING' || activeSyncJob.status === 'PENDING') && (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Processando no Servidor...</span>
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Sincronização Completa em Segundo Plano
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Varre 100% das páginas de conversas e contatos do WhatsApp de uma só vez no servidor, sem risco de perder clientes. Você não precisa ficar esperando nesta tela: navegue livremente pelo CRM enquanto o Brokiva importa tudo.
                </p>

                {/* Barra de Progresso Ativa em Tempo Real */}
                {activeSyncJob && (activeSyncJob.status === 'RUNNING' || activeSyncJob.status === 'PENDING') && (
                  <div className="mt-3 bg-white/10 rounded-2xl p-3 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{activeSyncJob.currentStepText}</span>
                      </span>
                      <span className="font-mono text-white font-bold">{activeSyncJob.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                        style={{ width: `${activeSyncJob.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Páginas lidas: <strong>{activeSyncJob.pagesScanned}</strong></span>
                      <span>Conversas qualificadas: <strong className="text-emerald-400">{activeSyncJob.contactsImported}</strong></span>
                    </div>
                  </div>
                )}

                {activeSyncJob && activeSyncJob.status === 'COMPLETED' && (
                  <div className="mt-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Última sincronização concluída: {activeSyncJob.contactsImported} contatos importados com sucesso!</span>
                  </div>
                )}
              </div>

              <div className="z-10 shrink-0 flex flex-col items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  disabled={activeSyncJob?.status === 'RUNNING' || activeSyncJob?.status === 'PENDING'}
                  onClick={async () => {
                    await startBackgroundSync({ historyDays, importMode: 'CHATS' });
                  }}
                  className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-7 py-3.5 rounded-full text-xs transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${activeSyncJob?.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                  <span>
                    {activeSyncJob?.status === 'RUNNING' ? 'Sincronizando em Segundo Plano...' : 'Sincronizar Tudo em Background'}
                  </span>
                </button>
                <span className="text-[10px] text-slate-400 text-center">
                  Executa no servidor sem travar a interface
                </span>
              </div>
            </div>
            
            {/* Barra de Filtros e Painel de Controle */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                
                {/* Filtros à Esquerda */}
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Seletor de Período */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Período de Atividade:</span>
                    <select
                      value={historyDays}
                      onChange={(e) => setHistoryDays(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value={7}>Últimos 7 dias</option>
                      <option value={15}>Últimos 15 dias</option>
                      <option value={30}>Últimos 30 dias</option>
                      <option value={90}>Últimos 90 dias</option>
                      <option value={0}>Todo o Histórico</option>
                    </select>
                  </div>

                  {/* Filtro de Etiquetas */}
                  {availableLabels.length > 0 && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Etiqueta:</span>
                      <select
                        value={selectedLabelFilter}
                        onChange={(e) => setSelectedLabelFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="ALL">Todas as Etiquetas ({availableLabels.length})</option>
                        {availableLabels.map((lbl) => (
                          <option key={lbl} value={lbl}>{lbl}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Checkbox Apenas com Nome */}
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 cursor-pointer select-none hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={onlyWithName}
                      onChange={(e) => setOnlyWithName(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Apenas contatos salvos na agenda</span>
                  </label>
                </div>

                {/* Busca Dinâmica */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone ou tag..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 text-xs rounded-xl pl-10 pr-4 py-2.5 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Informações Rápidas e Selecionar Todos */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    {filteredChats.every(c => selectedPhoneSet.has(c.phone)) && filteredChats.length > 0
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos'}
                  </button>
                  <span className="font-bold text-slate-800">
                    {selectedPhoneSet.size} de {filteredChats.length} contatos selecionados
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Grupos de WhatsApp são descartados automaticamente para manter a base limpa.</span>
                </div>
              </div>
            </div>

            {/* Visualização da Lista de Chats / Carregamento */}
            {isLoadingPreview ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center space-y-4 shadow-xs">
                <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">Buscando conversas, etiquetas e histórico na Z-API...</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Organizando os contatos recentes da sua linha e mapeando as etiquetas do WhatsApp Business.
                </p>
              </div>
            ) : previewError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
                <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">{previewError}</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Verifique se a sua instância do WhatsApp está conectada no menu <strong>WhatsApp ➔ Conexão & API</strong>.
                </p>
                <button
                  type="button"
                  onClick={loadWhatsAppPreview}
                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={filteredChats.length > 0 && filteredChats.every(c => selectedPhoneSet.has(c.phone))}
                            onChange={handleSelectAllFiltered}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-4 px-3">Lead / Contato</th>
                        <th className="py-4 px-3">Telefone Formatado</th>
                        <th className="py-4 px-3">Etiquetas do WhatsApp</th>
                        <th className="py-4 px-3">Última Mensagem</th>
                        <th className="py-4 px-4 text-right">Data / Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredChats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Nenhum contato individual encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredChats.map((chat) => {
                          const isSelected = selectedPhoneSet.has(chat.phone);
                          return (
                            <tr
                              key={chat.phone}
                              onClick={() => toggleSelectPhone(chat.phone)}
                              className={`transition cursor-pointer ${
                                isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectPhone(chat.phone)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={chat.avatarUrl}
                                    alt={chat.name}
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{chat.name}</span>
                                      {chat.hasRealName ? (
                                        <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                                          Agenda
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full">
                                          Chat
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400">ID: {chat.phone}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-3 font-mono font-medium text-slate-700">
                                {chat.phoneDisplay}
                              </td>

                              <td className="py-3.5 px-3">
                                <div className="flex flex-wrap items-center gap-1">
                                  {chat.whatsappLabels && chat.whatsappLabels.length > 0 ? (
                                    chat.whatsappLabels.map((lbl) => (
                                      <span
                                        key={lbl}
                                        className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                                      >
                                        <Tag className="w-2.5 h-2.5" />
                                        <span>{lbl}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Sem etiquetas</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-3 text-slate-600 max-w-xs truncate">
                                {chat.lastMessagePreview}
                              </td>

                              <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                                {new Date(chat.lastMessageTimestamp).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Barra de Progresso em Tempo Real Durante a Importação */}
            {isBatchImporting && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span className="text-sm">
                      Processando Importação em Lotes ({batchProgress.current} de {batchProgress.total} contatos)...
                    </span>
                  </div>
                  <span className="text-sm font-extrabold">{batchProgress.percent}%</span>
                </div>

                <div className="w-full bg-emerald-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${batchProgress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-emerald-700">
                  <span>
                    Baixando contexto e histórico inicial de: <strong>{batchProgress.currentName || 'Leads em fila'}</strong>
                  </span>
                  <span>Lotes de 8 contatos por requisição • Zero bloqueio Z-API</span>
                </div>
              </div>
            )}

            {/* Card de Conclusão com Sucesso */}
            {batchCompleted && (
              <div className="bg-emerald-100 border border-emerald-300 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-3.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">Importação Concluída com Sucesso!</h3>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {importedCount} leads importados com histórico leve, fotos e etiquetas salvas no CRM.
                    </p>
                  </div>
                </div>

                {onGoToInbox && (
                  <button
                    type="button"
                    onClick={onGoToInbox}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ir para o Inbox do WhatsApp</span>
                  </button>
                )}
              </div>
            )}

            {/* Painel Inferior de Ação e Lançamento da Importação */}
            {!batchCompleted && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                
                {/* Atribuição de Corretor */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-700">Atribuir Leads a:</span>
                    <select
                      value={assignedBrokerId}
                      onChange={(e) => setAssignedBrokerId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Botão de Disparo da Importação em Lotes */}
                <button
                  type="button"
                  onClick={handleStartBatchImport}
                  disabled={selectedPhoneSet.size === 0 || isBatchImporting}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-7 py-3 rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  {isBatchImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importando Lotes...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Iniciar Importação em Lotes ({selectedPhoneSet.size} Leads Selecionados)</span>
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: IMPORTAÇÃO POR ARQUIVOS DE AGENDA (VCF / CSV)                      */}
        {/* ========================================================================= */}
        {activeTab === 'FILE' && (
          <div className="space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload de Arquivos de Contatos & Agenda</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Exporte a agenda telefônica do seu iPhone/Android (formato <strong>.vcf / .vcard</strong>) ou planilhas do Excel (<strong>.csv</strong>).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 text-xs text-emerald-800 hover:text-emerald-900 font-bold bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Baixar Planilha Modelo (.CSV)</span>
                </button>
              </div>

              {/* Dropzone de Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-12 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/20 space-y-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,.vcard,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-105 transition shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {uploadedFile ? uploadedFile.name : 'Clique para selecionar ou arraste o arquivo .vcf ou .csv'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Formatos aceitos: Agenda do Celular / Google Contatos (.vcf) ou Planilhas separadas por ponto e vírgula (.csv).
                </p>
              </div>
            </div>

            {/* Tabela de Pré-visualização do Arquivo */}
            {parsedFileRecords.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{parsedFileRecords.length} contatos válidos identificados no arquivo:</span>
                  <span className="text-slate-400 font-normal">Normalização automática com DDI +55 e DDD</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Nome</th>
                        <th className="p-3">Telefone Formatado</th>
                        <th className="p-3">E-mail</th>
                        <th className="p-3">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedFileRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{rec.name}</td>
                          <td className="p-3 font-mono text-slate-700">{rec.phone}</td>
                          <td className="p-3 text-slate-500">{rec.email || '-'}</td>
                          <td className="p-3">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                              {rec.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {fileImportSuccess ? (
                  <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-5 flex items-center justify-between text-xs font-bold text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      <span>{importedCount} contatos importados com sucesso para a base do CRM!</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmFileImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-8 py-3 rounded-2xl shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {parsedFileRecords.length} Contatos</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
