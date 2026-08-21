'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Proposal, ProposalStatus } from '@/types/crm';
import { PublicProposalView } from './PublicProposalView';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Edit3, 
  Building2, 
  Eye, 
  Zap, 
  Send,
  UserCheck,
  Building,
  QrCode,
  Sparkles
} from 'lucide-react';

export function ProposalManager() {
  const { 
    proposals, 
    contacts, 
    deals, 
    users, 
    currentUser, 
    currentTenant, 
    createProposal, 
    deleteProposal,
    acceptProposal
  } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProposalStatus>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State para Nova Proposta
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [propertyName, setPropertyName] = useState('Edifício Lumina Batel');
  const [unit, setUnit] = useState('Apto 1502 - Torre Solar');
  const [propertyAddress, setPropertyAddress] = useState('Av. Batel, 1550 - Batel, Curitiba - PR');
  const [totalValue, setTotalValue] = useState<number>(1450000);
  const [downPayment, setDownPayment] = useState<number>(290000);
  const [downPaymentMethod, setDownPaymentMethod] = useState<'PIX' | 'BOLETO' | 'TRANSFER' | 'CREDIT_CARD'>('PIX');
  const [installmentCount, setInstallmentCount] = useState<number>(36);
  const [installmentValue, setInstallmentValue] = useState<number>(18055.55);
  const [baloonValue, setBaloonValue] = useState<number>(150000);
  const [baloonCount, setBaloonCount] = useState<number>(3);
  const [bankFinancingValue, setBankFinancingValue] = useState<number>(510000);
  const [brokerCommissionPercent, setBrokerCommissionPercent] = useState<number>(50); // 50% de 6%
  const [notes, setNotes] = useState('');

  // Sincroniza cálculo ao alterar total
  const handleTotalChange = (val: number) => {
    setTotalValue(val);
    const down = val * 0.2;
    setDownPayment(down);
    const balance = val - down;
    const installments = balance * 0.5;
    setInstallmentValue(Number((installments / installmentCount).toFixed(2)));
    setBankFinancingValue(balance * 0.5);
  };

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.unit && p.unit.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return true;
  });

  // Métricas
  const totalProposalsCount = proposals.length;
  const acceptedProposals = proposals.filter(p => p.status === 'ACCEPTED');
  const totalVolume = proposals.reduce((acc, p) => acc + p.totalValue, 0);
  const totalAcceptedVolume = acceptedProposals.reduce((acc, p) => acc + p.totalValue, 0);
  const totalCommissionsEarned = acceptedProposals.reduce((acc, p) => acc + p.brokerCommissionValue + p.agencyCommissionValue, 0);

  const handleCopyProposalLink = (p: Proposal) => {
    const fakeLink = `https://crm.faithhubs.com/proposta/${p.id}`;
    navigator.clipboard.writeText(fakeLink);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selContact = contacts.find(c => c.id === contactId) || contacts[0];
    const selDeal = deals.find(d => d.contactId === contactId);

    await createProposal({
      contactId: selContact?.id || 'contact-01',
      contactName: selContact?.name || 'Cliente',
      contactPhone: selContact?.phone || '+55 11 99999-0000',
      dealId: selDeal?.id,
      assignedUserId: selContact?.assignedUserId || currentUser.id,
      propertyName,
      unit,
      propertyAddress,
      totalValue,
      downPayment,
      downPaymentMethod,
      installmentCount,
      installmentValue,
      baloonValue,
      baloonCount,
      bankFinancingValue,
      brokerCommissionPercent,
      notes,
    });

    setIsCreateModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/20">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Propostas Comerciais & Aceite Digital</h1>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Assinatura Digital & Split Asaas</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gere propostas personalizadas, envie o link de aceite via WhatsApp e receba o sinal com baixa automática.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>+ Gerar Nova Proposta</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume em Propostas</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                R$ {totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{totalProposalsCount} propostas emitidas</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Propostas Aceitas</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">
                R$ {totalAcceptedVolume.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{acceptedProposals.length} vendas confirmadas</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissões Geradas (6%)</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                R$ {totalCommissionsEarned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Split Imobiliária & Corretores</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Asaas</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>PIX Dinâmico Ativo</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Baixa Automática Sincronizada</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por empreendimento, cliente ou unidade..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todas ({proposals.length})
            </button>
            <button
              onClick={() => setStatusFilter('SENT')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'SENT' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Enviadas
            </button>
            <button
              onClick={() => setStatusFilter('ACCEPTED')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'ACCEPTED' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Aceitas ({acceptedProposals.length})
            </button>
          </div>
        </div>

        {/* Tabela de Propostas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Empreendimento / Unidade</th>
                  <th className="py-3.5 px-4">Cliente Proponente</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Sinal / Entrada</th>
                  <th className="py-3.5 px-4">Comissão Corretor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProposals.map(proposal => {
                  const isAccepted = proposal.status === 'ACCEPTED';
                  return (
                    <tr key={proposal.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{proposal.propertyName}</p>
                            <p className="text-[11px] text-slate-500">{proposal.unit}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{proposal.contactName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{proposal.contactPhone}</p>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        R$ {proposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-emerald-700">
                          R$ {proposal.downPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] text-slate-500">via {proposal.downPaymentMethod}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-purple-800">
                          R$ {proposal.brokerCommissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">({proposal.brokerCommissionPercent}% de 6%)</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${
                          isAccepted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isAccepted ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-500" />}
                          <span>{isAccepted ? 'Aceita pelo Cliente' : 'Aguardando Aceite'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Visualizar Lâmina */}
                          <button
                            type="button"
                            onClick={() => setViewingProposal(proposal)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            title="Visualizar Proposta Oficial"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Lâmina</span>
                          </button>

                          {/* Copiar Link WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleCopyProposalLink(proposal)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            title="Copiar link para envio no WhatsApp"
                          >
                            {copiedId === proposal.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === proposal.id ? 'Copiado!' : 'Copiar Link'}</span>
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => deleteProposal(proposal.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Excluir Proposta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Modal de Criação de Proposta */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Gerador de Proposta Comercial Oficial</h3>
                  <p className="text-[11px] text-slate-400">Emita a proposta com fluxo de pagamento e cobrança Asaas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Seleção do Cliente */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Cliente / Proponente *</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                >
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dados do Imóvel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Nome do Empreendimento *</label>
                  <input
                    type="text"
                    required
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Unidade / Torre *</label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Fluxo Financeiro */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Condições Financeiras</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Valor Total de Venda (R$) *</label>
                    <input
                      type="number"
                      required
                      value={totalValue}
                      onChange={(e) => handleTotalChange(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Sinal de Entrada (R$) *</label>
                    <input
                      type="number"
                      required
                      value={downPayment}
                      onChange={(e) => setDownPayment(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm text-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Qtd. Parcelas</label>
                    <input
                      type="number"
                      value={installmentCount}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        setInstallmentCount(count);
                        if (count > 0) setInstallmentValue(Number(((totalValue - downPayment) * 0.5 / count).toFixed(2)));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Valor Parcela (R$)</label>
                    <input
                      type="number"
                      value={installmentValue}
                      onChange={(e) => setInstallmentValue(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Financiamento (R$)</label>
                    <input
                      type="number"
                      value={bankFinancingValue}
                      onChange={(e) => setBankFinancingValue(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Split de Comissão */}
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-950">Split de Comissão de Venda (6% = R$ {(totalValue * 0.06).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                    <span className="font-bold text-purple-800 font-mono">{brokerCommissionPercent}% Corretor</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    step="5"
                    value={brokerCommissionPercent}
                    onChange={(e) => setBrokerCommissionPercent(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-purple-800">
                    <span>Corretor: <strong>R$ {((totalValue * 0.06) * (brokerCommissionPercent / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Imobiliária: <strong>R$ {((totalValue * 0.06) * (1 - brokerCommissionPercent / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Emitir e Gerar Link Asaas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização da Proposta Oficial */}
      {viewingProposal && (
        <PublicProposalView 
          proposal={viewingProposal} 
          onClose={() => setViewingProposal(null)} 
        />
      )}
    </div>
  );
}
