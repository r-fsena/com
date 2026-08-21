'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { FinancialTransaction, TransactionStatus, TransactionCategory } from '@/types/crm';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter, 
  CreditCard, 
  QrCode, 
  FileText, 
  Download, 
  ExternalLink, 
  RefreshCw,
  Building,
  User,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart
} from 'lucide-react';

export function FinancialDashboard() {
  const { 
    transactions, 
    currentTenant, 
    users, 
    createFinancialTransaction, 
    markTransactionPaid, 
    syncAsaasTransactions 
  } = useCRM();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TransactionCategory>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);

  // Form State para Novo Lançamento
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(10000);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<TransactionCategory>('ENTRADA');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'TRANSFER'>('PIX');
  const [contactName, setContactName] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.contactName && t.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (t.recipientName && t.recipientName.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    return true;
  });

  // Métricas Financeiras
  const totalPaid = transactions
    .filter(t => t.status === 'PAID' && t.type === 'PROPERTY_PAYMENT')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalPending = transactions
    .filter(t => t.status === 'PENDING' && t.type === 'PROPERTY_PAYMENT')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalOverdue = transactions
    .filter(t => t.status === 'OVERDUE' && t.type === 'PROPERTY_PAYMENT')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalCommissionsPaid = transactions
    .filter(t => t.status === 'PAID' && t.type === 'COMMISSION_PAYOUT')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalCommissionsPending = transactions
    .filter(t => t.status === 'PENDING' && t.type === 'COMMISSION_PAYOUT')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncAsaasTransactions();
    setIsSyncing(false);
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const selUser = users.find(u => u.id === recipientUserId);

    createFinancialTransaction({
      description: description.trim(),
      amount,
      dueDate,
      category,
      type: category === 'COMISSAO_CORRETOR' ? 'COMMISSION_PAYOUT' : 'PROPERTY_PAYMENT',
      paymentMethod,
      contactName: contactName.trim() || undefined,
      recipientUserId: recipientUserId || undefined,
      recipientName: selUser?.name,
      status: 'PENDING',
      asaasInvoiceUrl: `https://sandbox.asaas.com/i/${Date.now()}`,
    });

    setDescription('');
    setContactName('');
    setIsNewTxModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header Financeiro */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/20">
              <DollarSign className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Painel Financeiro & Fluxo de Caixa</h1>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-emerald-600" />
              <span>Gateway Asaas Integrado</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento em tempo real de sinais, parcelas, comissões de corretores e baixas automáticas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Sincronizar baixas com o gateway Asaas"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Asaas'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewTxModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Cards Financeiros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Pago / Recebido */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Recebido (Pago)</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">
                R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Receita Confirmada no Asaas</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
          </div>

          {/* Em Aberto / Pendente */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Aberto / A Receber</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Cobranças Ativas dentro do Prazo</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Vencidos / Inadimplência */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Títulos Vencidos</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Cobranças Expiradas no Asaas</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Comissões de Corretores */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissões Pagas</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1">
                R$ {totalCommissionsPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
                R$ {totalCommissionsPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a pagar
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6" />
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
                placeholder="Buscar por descrição, cliente ou corretor..."
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
              Todos ({transactions.length})
            </button>
            <button
              onClick={() => setStatusFilter('PAID')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'PAID' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Pagos
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'PENDING' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Em Aberto
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'OVERDUE' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ● Vencidos
            </button>
          </div>
        </div>

        {/* Tabela de Extrato de Transações */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Descrição do Lançamento</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4">Forma</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(tx => {
                  const isPaid = tx.status === 'PAID';
                  const isOverdue = tx.status === 'OVERDUE';
                  const isPending = tx.status === 'PENDING';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900">{tx.description}</p>
                          <p className="text-[11px] text-slate-500">
                            {tx.contactName ? `Cliente: ${tx.contactName}` : tx.recipientName ? `Beneficiário: ${tx.recipientName}` : 'Geral'}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tx.category === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' :
                          tx.category === 'COMISSAO_CORRETOR' ? 'bg-purple-100 text-purple-800' :
                          tx.category === 'COMISSAO_IMOBILIARIA' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {tx.category.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-sm">
                        <span className={tx.type === 'COMMISSION_PAYOUT' ? 'text-purple-700' : 'text-slate-900'}>
                          R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {new Date(tx.dueDate).toLocaleDateString('pt-BR')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {tx.paymentMethod}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${
                          isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                           isOverdue ? <AlertCircle className="w-3 h-3 text-rose-600" /> :
                           <Clock className="w-3 h-3 text-amber-500" />}
                          <span>{isPaid ? 'Pago / Liquidado' : isOverdue ? 'Vencido' : 'Em Aberto'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => markTransactionPaid(tx.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              title="Dar baixa manual nesta cobrança"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Dar Baixa</span>
                            </button>
                          )}

                          {tx.asaasInvoiceUrl && (
                            <a
                              href={tx.asaasInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                              title="Abrir fatura no gateway Asaas"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Fatura</span>
                            </a>
                          )}
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

      {/* Modal: Novo Lançamento Manual */}
      {isNewTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Novo Lançamento Financeiro</h3>
                  <p className="text-[11px] text-slate-400">Gere cobrança Asaas ou registre entrada/comissão</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewTxModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sinal de Reserva - Casa 04"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-sm text-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
                  >
                    <option value="ENTRADA">Sinal de Entrada</option>
                    <option value="PARCELA">Parcela Mensal</option>
                    <option value="BALAO">Balão Anual</option>
                    <option value="COMISSAO_CORRETOR">Comissão Corretor</option>
                    <option value="COMISSAO_IMOBILIARIA">Comissão Imobiliária</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
                  >
                    <option value="PIX">PIX Dinâmico</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="TRANSFER">Transferência Bancária</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Nome do Cliente / Pagador</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo Ramos"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTxModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Registrar e Emitir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
