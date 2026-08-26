'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Phone
} from 'lucide-react';
import { Contact, Deal } from '@/types/crm';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface ParsedLeadRow {
  name: string;
  phone: string;
  email?: string;
  monthlyIncome?: number;
  downPaymentAvailable?: number;
  maxPropertyValue?: number;
  preferredPropertyType?: 'APARTMENT' | 'HOUSE' | 'PENTHOUSE' | 'COMMERCIAL';
  targetRegions: string[];
  temperature: 'HOT' | 'WARM' | 'COLD';
  source: string;
  tags: string[];
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export function ImportLeadsModal({ isOpen, onClose, onSuccess }: ImportLeadsModalProps) {
  const { 
    addContact, 
    createDeal, 
    currentPipeline, 
    contacts, 
    users, 
    currentUser,
    instances,
    syncWhatsAppChats,
    isSyncingWhatsApp
  } = useCRM();
  
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'CSV'>('WHATSAPP');
  const [file, setFile] = useState<File | null>(null);
  const [parsedLeads, setParsedLeads] = useState<ParsedLeadRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [assignedBrokerId, setAssignedBrokerId] = useState<string>(currentUser.id);
  const [createDealsInKanban, setCreateDealsInKanban] = useState(true);
  const [whatsappPreviewContacts, setWhatsappPreviewContacts] = useState<any[]>([]);
  const [isLoadingWhatsAppContacts, setIsLoadingWhatsAppContacts] = useState(false);
  const [selectedWhatsAppPhones, setSelectedWhatsAppPhones] = useState<Set<string>>(new Set());
  const [historyDays, setHistoryDays] = useState<number>(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega preview dos contatos do WhatsApp ao abrir modal na aba WhatsApp
  useEffect(() => {
    if (isOpen && activeTab === 'WHATSAPP') {
      const fetchPreview = async () => {
        try {
          setIsLoadingWhatsAppContacts(true);
          const brokerInst = instances.find(i => i.assignedUserId === currentUser.id) || instances[0];
          const res = await fetch('/api/v1/zapi/sync-chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instanceId: brokerInst?.zapiInstanceId || brokerInst?.id,
              fetchHistoryMessages: false,
              historyDays,
            }),
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.contacts)) {
            setWhatsappPreviewContacts(data.contacts);
            setSelectedWhatsAppPhones(new Set(data.contacts.map((c: any) => c.phone)));
          }
        } catch {} finally {
          setIsLoadingWhatsAppContacts(false);
        }
      };
      fetchPreview();
    }
  }, [isOpen, activeTab, currentUser.id, instances, historyDays]);

  if (!isOpen) return null;

  // 1. Ação de Importar Contatos do WhatsApp
  const handleConfirmWhatsAppSync = async () => {
    setIsProcessing(true);
    try {
      const brokerInst = instances.find(i => i.assignedUserId === assignedBrokerId) || instances[0];
      const result = await syncWhatsAppChats(brokerInst?.zapiInstanceId || brokerInst?.id, historyDays);
      
      // Cria deals no Kanban para os contatos selecionados se marcado
      if (createDealsInKanban && currentPipeline.stages.length > 0 && whatsappPreviewContacts.length > 0) {
        const firstStage = currentPipeline.stages[0];
        whatsappPreviewContacts.forEach(c => {
          if (selectedWhatsAppPhones.has(c.phone)) {
            createDeal({
              contactId: c.id,
              pipelineId: currentPipeline.id,
              stageId: firstStage.id,
              assignedUserId: assignedBrokerId,
              title: `Oportunidade - ${c.name}`,
              expectedValue: 850000,
              manualProbability: 40,
            });
          }
        });
      }

      onSuccess(selectedWhatsAppPhones.size || result.count || whatsappPreviewContacts.length);
      onClose();
    } catch {
      alert('Erro ao sincronizar com o WhatsApp');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectPhone = (phone: string) => {
    setSelectedWhatsAppPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const toggleSelectAllWhatsApp = () => {
    if (selectedWhatsAppPhones.size === whatsappPreviewContacts.length) {
      setSelectedWhatsAppPhones(new Set());
    } else {
      setSelectedWhatsAppPhones(new Set(whatsappPreviewContacts.map(c => c.phone)));
    }
  };

  // 2. Download do Template Base Oficial (.CSV)
  const handleDownloadTemplate = () => {
    const csvHeader = 'Nome,Telefone,Email,Renda_Mensal,Entrada_Disponivel,Orcamento_Maximo,Tipo_Imovel,Regioes,Temperatura,Origem,Tags,Notas';
    
    const sampleRows = [
      '"Rafael Sena","+55 (48) 9107-9478","rafael.sena@exemplo.com","45000","300000","1200000","Cobertura","Batel; Ecoville","HOT","WhatsApp","Alto Padrão; Investidor","Procura cobertura duplex com 3 suítes"',
      '"Mariana Guimarães","+55 (11) 98877-6655","mariana.guimaraes@exemplo.com","28000","200000","850000","Casa","Alphaville; Tamboré","WARM","Instagram Ads","Família; 3 Quartos","Busca condomínio fechado com área de lazer"',
      '"Dr. Roberto Alencar","+55 (41) 99122-3344","dr.alencar@exemplo.com","60000","500000","2500000","Apartamento","Graciosa; Cabral","HOT","Indicação","Investidor; À Vista","Interesse em lançamento na planta"',
      '"Camila Vasconcelos","+55 (21) 97766-5544","camila.v@exemplo.com","18000","120000","600000","Apartamento","Barra da Tijuca","COLD","Portal Imobiliário","1º Imóvel","Financiamento pela Caixa"',
    ];

    const csvContent = '\uFEFF' + [csvHeader, ...sampleRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'planilha_modelo_importacao_leads_crm.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Parser de arquivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        alert('O arquivo CSV parece estar vazio ou não possui linhas de dados.');
        return;
      }

      const firstLine = lines[0];
      const separator = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

      const dataLines = lines.slice(1);
      const parsed: ParsedLeadRow[] = [];

      dataLines.forEach((line) => {
        const regex = new RegExp(`(?:^|${separator})(?:"([^"]*)"|([^${separator}]*))`, 'g');
        const cols: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          cols.push(match[1] !== undefined ? match[1].trim() : match[2].trim());
        }

        if (cols.length === 0 || (!cols[0] && !cols[1])) return;

        const rawName = cols[0] || 'Lead Importado';
        const rawPhone = cols[1] || '';
        const rawEmail = cols[2] || '';
        const rawIncome = cols[3] ? Number(cols[3].replace(/\D/g, '')) : undefined;
        const rawDownPayment = cols[4] ? Number(cols[4].replace(/\D/g, '')) : undefined;
        const rawBudget = cols[5] ? Number(cols[5].replace(/\D/g, '')) : undefined;
        const rawType = (cols[6] || '').toLowerCase();
        const rawRegions = cols[7] ? cols[7].split(/[;,]/).map(r => r.trim()).filter(Boolean) : ['Região Central'];
        const rawTemp = (cols[8] || '').toUpperCase();
        const rawSource = cols[9] || 'PLANILHA_IMPORTADA';
        const rawTags = cols[10] ? cols[10].split(/[;,]/).map(t => t.trim()).filter(Boolean) : ['Lead Importado'];
        const rawNotes = cols[11] || '';

        const cleanPhone = rawPhone.replace(/\D/g, '');
        const isValid = rawName.length > 1 && cleanPhone.length >= 8;

        let formattedPhone = rawPhone;
        if (cleanPhone.length >= 10 && !rawPhone.startsWith('+')) {
          formattedPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`;
        }

        let propertyType: 'APARTMENT' | 'HOUSE' | 'PENTHOUSE' | 'COMMERCIAL' = 'APARTMENT';
        if (rawType.includes('cobert')) propertyType = 'PENTHOUSE';
        else if (rawType.includes('casa')) propertyType = 'HOUSE';
        else if (rawType.includes('comerc')) propertyType = 'COMMERCIAL';

        let temperature: 'HOT' | 'WARM' | 'COLD' = 'WARM';
        if (rawTemp.includes('HOT') || rawTemp.includes('QUENTE') || rawTemp.includes('ALTA')) temperature = 'HOT';
        else if (rawTemp.includes('COLD') || rawTemp.includes('FRIO') || rawTemp.includes('BAIXA')) temperature = 'COLD';

        parsed.push({
          name: rawName,
          phone: formattedPhone,
          email: rawEmail || undefined,
          monthlyIncome: rawIncome,
          downPaymentAvailable: rawDownPayment,
          maxPropertyValue: rawBudget || (rawIncome ? rawIncome * 30 : 800000),
          preferredPropertyType: propertyType,
          targetRegions: rawRegions.length > 0 ? rawRegions : ['Região Central'],
          temperature,
          source: rawSource,
          tags: rawTags,
          notes: rawNotes,
          isValid,
          validationError: !isValid ? 'Telefone ou Nome incompleto' : undefined,
        });
      });

      setParsedLeads(parsed);
    };

    reader.readAsText(uploadedFile, 'UTF-8');
  };

  // 4. Confirmação CSV
  const handleConfirmCSVImport = async () => {
    const validLeads = parsedLeads.filter(l => l.isValid);
    if (validLeads.length === 0) {
      alert('Nenhum lead válido para importar.');
      return;
    }

    setIsProcessing(true);
    let importedCount = 0;

    for (const item of validLeads) {
      const newContact = addContact({
        name: item.name,
        phone: item.phone,
        email: item.email,
        source: item.source as any,
        temperature: item.temperature,
        assignedUserId: assignedBrokerId,
        monthlyIncome: item.monthlyIncome,
        downPaymentAvailable: item.downPaymentAvailable,
        maxPropertyValue: item.maxPropertyValue,
        preferredPropertyType: item.preferredPropertyType,
        targetRegions: item.targetRegions,
        tags: [...item.tags, 'Importado via Planilha'],
      });

      if (createDealsInKanban && currentPipeline.stages.length > 0) {
        const firstStage = currentPipeline.stages[0];
        createDeal({
          contactId: newContact.id,
          pipelineId: currentPipeline.id,
          stageId: firstStage.id,
          assignedUserId: assignedBrokerId,
          title: `Oportunidade - ${item.name}`,
          expectedValue: item.maxPropertyValue || 800000,
          manualProbability: item.temperature === 'HOT' ? 70 : item.temperature === 'WARM' ? 40 : 20,
        });
      }

      importedCount++;
    }

    setIsProcessing(false);
    onSuccess(importedCount);
    onClose();
  };

  const validCount = parsedLeads.filter(l => l.isValid).length;
  const invalidCount = parsedLeads.filter(l => !l.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Importação & Migração de Leads</h3>
              <p className="text-xs text-slate-500">
                Puxe contatos do seu WhatsApp conectado ou carregue uma planilha CSV/Excel.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seletor de Abas */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('WHATSAPP')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'WHATSAPP'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Sincronizar do WhatsApp Conectado</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">
              Instantâneo
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CSV')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'CSV'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Importar Planilha CSV / Excel</span>
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'WHATSAPP' ? (
            /* ABA 1: SINCRONIZAR WHATSAPP */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Captura Automática com Fotos & Nomes Salvos</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    O CRM puxa a agenda do corretor salvando o nome identificado no celular, a foto pública do WhatsApp e as conversas ativas.
                  </p>
                </div>
              </div>

              {isLoadingWhatsAppContacts ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Carregando contatos da sessão do WhatsApp...</p>
                </div>
              ) : whatsappPreviewContacts.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>{whatsappPreviewContacts.length} contatos encontrados:</span>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {selectedWhatsAppPhones.size} selecionados
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={toggleSelectAllWhatsApp}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer underline"
                    >
                      {selectedWhatsAppPhones.size === whatsappPreviewContacts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {whatsappPreviewContacts.map((contact, idx) => {
                      const isSelected = selectedWhatsAppPhones.has(contact.phone);
                      return (
                        <div
                          key={contact.id || idx}
                          onClick={() => toggleSelectPhone(contact.phone)}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-white hover:bg-slate-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <img
                              src={contact.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=059669&color=fff`}
                              alt={contact.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">{contact.name}</p>
                              <p className="text-[10.5px] text-slate-500 font-mono">{contact.phone}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              WhatsApp Live
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Opções de Atribuição, Histórico e Funil */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Corretor Responsável:
                        </label>
                        <select
                          value={assignedBrokerId}
                          onChange={(e) => setAssignedBrokerId(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none cursor-pointer font-medium"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>👤 {u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Janela de Histórico:
                        </label>
                        <select
                          value={historyDays}
                          onChange={(e) => setHistoryDays(Number(e.target.value))}
                          className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none cursor-pointer font-medium text-slate-800"
                        >
                          <option value={7}>⚡ 7 dias (Rápido)</option>
                          <option value={15}>📅 15 dias (Padrão)</option>
                          <option value={25}>📅 25 dias</option>
                          <option value={35}>📅 35 dias</option>
                          <option value={45}>📅 45 dias</option>
                          <option value={60}>📅 60 dias (2 meses)</option>
                          <option value={70}>📅 70 dias</option>
                          <option value={90}>🗄️ 90 dias (3 meses)</option>
                          <option value={0}>♾️ Histórico Completo</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createDealsInKanban}
                            onChange={(e) => setCreateDealsInKanban(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>🚀 Criar no Kanban</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <Smartphone className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">
                    Nenhum chat pré-carregado. Conecte sua linha do WhatsApp via QR Code para sincronizar contatos e históricos.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ABA 2: IMPORTAR CSV */
            <div className="space-y-4">
              {/* Passo 1: Download da Planilha Base */}
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Baixar Planilha Modelo Base (.CSV)</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Estruturada com cabeçalhos padrão (Renda, Entrada, Orçamento, Imóvel e Regiões).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Planilha Modelo</span>
                </button>
              </div>

              {/* Passo 2: Upload do Arquivo CSV */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  2. Selecione ou arraste seu arquivo preenchido (.CSV):
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80 rounded-2xl p-6 text-center cursor-pointer transition"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  {file ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-700">{file.name}</p>
                      <p className="text-[11px] text-slate-500">{(file.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Clique para selecionar o arquivo .CSV</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Suporta delimitadores por vírgula (,) ou ponto-e-vírgula (;)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pré-visualização dos Dados Parseados */}
              {parsedLeads.length > 0 && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>Pré-visualização:</span>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {validCount} válidos
                      </span>
                      {invalidCount > 0 && (
                        <span className="text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                          {invalidCount} com erro
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2">Nome</th>
                          <th className="p-2">Telefone</th>
                          <th className="p-2">Renda/Orçamento</th>
                          <th className="p-2">Imóvel</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {parsedLeads.map((lead, idx) => (
                          <tr key={idx} className={!lead.isValid ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
                            <td className="p-2 font-medium truncate max-w-[120px]">{lead.name}</td>
                            <td className="p-2 font-mono text-[10px]">{lead.phone}</td>
                            <td className="p-2 font-mono text-emerald-700">
                              {lead.monthlyIncome ? `R$ ${(lead.monthlyIncome / 1000).toFixed(0)}k/mês` : `R$ ${((lead.maxPropertyValue || 0) / 1000).toFixed(0)}k`}
                            </td>
                            <td className="p-2 truncate max-w-[100px]">{lead.preferredPropertyType || 'Geral'}</td>
                            <td className="p-2">
                              {lead.isValid ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Pronto
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold flex items-center gap-0.5 text-[10px]" title={lead.validationError}>
                                  <AlertTriangle className="w-3 h-3" /> Inválido
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Opções de Atribuição e Funil */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Corretor Responsável pelos Leads:
                        </label>
                        <select
                          value={assignedBrokerId}
                          onChange={(e) => setAssignedBrokerId(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.id}>👤 {u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createDealsInKanban}
                            onChange={(e) => setCreateDealsInKanban(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>🚀 Criar cards no Funil (Kanban)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          {activeTab === 'WHATSAPP' ? (
            <button
              type="button"
              onClick={handleConfirmWhatsAppSync}
              disabled={selectedWhatsAppPhones.size === 0 || isProcessing || isSyncingWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>{isProcessing || isSyncingWhatsApp ? 'Sincronizando Leads...' : `Sincronizar ${selectedWhatsAppPhones.size} Leads do WhatsApp`}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmCSVImport}
              disabled={validCount === 0 || isProcessing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'Importando...' : `Confirmar Importação (${validCount} Leads)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
