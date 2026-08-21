'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Users, 
  Search, 
  Plus, 
  MessageSquare, 
  Tag, 
  Building, 
  Phone, 
  Mail, 
  ShieldCheck, 
  DollarSign, 
  Flame, 
  Trash2, 
  Edit,
  Download,
  Upload,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImportLeadsModal } from './ImportLeadsModal';

interface ContactsListProps {
  onOpenNewLead: () => void;
  onOpenChat: (contactId: string) => void;
}

export function ContactsList({ onOpenNewLead, onOpenChat }: ContactsListProps) {
  const { contacts, deleteContact, users } = useCRM();
  const [search, setSearch] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filtered = contacts.filter(c => {
    const matchesSearch = !search.trim() || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (temperatureFilter !== 'ALL' && c.temperature !== temperatureFilter) return false;
    if (sourceFilter !== 'ALL' && c.source !== sourceFilter) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Temperatura', 'Origem', 'Entrada (R$)', 'Orcamento Max (R$)', 'Regioes', 'Tags', 'LGPD Opt-in'];
    const rows = filtered.map(c => [
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      `"${c.temperature}"`,
      `"${c.source}"`,
      `"${c.downPaymentAvailable || 0}"`,
      `"${c.maxPropertyValue || 0}"`,
      `"${c.targetRegions.join('; ')}"`,
      `"${c.tags.join('; ')}"`,
      `"${!c.hasOptedOut ? 'Sim' : 'Nao'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_vanguard_crm_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Leads & Contatos Imobiliários</h1>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {filtered.length} contatos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Base de dados unificada com perfil financeiro 360º, consentimento LGPD e importação de planilhas
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botão Importar Planilha */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
            title="Importar leads de planilha CSV ou migrar de outro CRM"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Importar Planilha (.CSV)</span>
          </button>

          {/* Botão Exportar CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
            title="Baixar lista atual em arquivo CSV"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>

          {/* Botão Cadastrar Lead */}
          <button
            onClick={onOpenNewLead}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Lead</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar por nome, telefone, email ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Temperature Filter */}
        <select
          value={temperatureFilter}
          onChange={(e) => setTemperatureFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none cursor-pointer"
        >
          <option value="ALL">Todas as Temperaturas</option>
          <option value="HOT">🔥 Quentes</option>
          <option value="WARM">⚡ Mornos</option>
          <option value="COLD">❄️ Frios</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none cursor-pointer"
        >
          <option value="ALL">Todas as Origens</option>
          <option value="WHATSAPP">WhatsApp Direto</option>
          <option value="INSTAGRAM_ADS">Instagram Ads</option>
          <option value="FACEBOOK_ADS">Facebook Ads</option>
          <option value="PORTAL_ZAP">Portal ZAP</option>
          <option value="GOOGLE">Google Ads</option>
        </select>
      </div>

      {/* Contacts Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Lead / Contato</th>
                <th className="py-3 px-4">Qualificação Financeira</th>
                <th className="py-3 px-4">Interesse & Região</th>
                <th className="py-3 px-4">Origem & Tags</th>
                <th className="py-3 px-4">Corretor</th>
                <th className="py-3 px-4">LGPD</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((contact) => {
                const broker = users.find(u => u.id === contact.assignedUserId);

                return (
                  <tr key={contact.id} className="hover:bg-slate-50/80 transition group">
                    {/* Contato */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={contact.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(contact.name)}
                          alt={contact.name}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 group-hover:text-emerald-700">
                              {contact.name}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              contact.temperature === 'HOT' ? 'bg-rose-100 text-rose-700' :
                              contact.temperature === 'WARM' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {contact.temperature === 'HOT' ? '🔥 Quente' : contact.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{contact.phone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Qualificação Financeira */}
                    <td className="py-3 px-4 font-mono">
                      {contact.downPaymentAvailable || contact.maxPropertyValue ? (
                        <div>
                          <span className="block font-bold text-slate-800">
                            Orç: R$ {(contact.maxPropertyValue || 0).toLocaleString('pt-BR')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Entrada: R$ {(contact.downPaymentAvailable || 0).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Não qualificado</span>
                      )}
                    </td>

                    {/* Interesse */}
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{contact.preferredPropertyType || 'Imóvel Geral'}</p>
                      <p className="text-[11px] text-slate-500">{contact.targetRegions.join(', ')}</p>
                    </td>

                    {/* Origem e Tags */}
                    <td className="py-3 px-4">
                      <span className="inline-block text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mb-1">
                        {contact.source}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-medium">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Corretor */}
                    <td className="py-3 px-4">
                      {broker ? (
                        <div className="flex items-center gap-1.5">
                          <img
                            src={broker.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(broker.name)}
                            alt={broker.name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-slate-700 font-medium">{broker.name.split(' ')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                          Não atribuído
                        </span>
                      )}
                    </td>

                    {/* LGPD */}
                    <td className="py-3 px-4">
                      {contact.hasOptedOut ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Opt-Out
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Opt-In
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenChat(contact.id)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Abrir WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Excluir Contato"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Importação de Leads */}
      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => showToast(`🎉 ${count} leads importados com sucesso para o CRM!`)}
      />
    </div>
  );
}
