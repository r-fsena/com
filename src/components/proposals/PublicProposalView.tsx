'use client';

import React, { useState } from 'react';
import { Proposal } from '@/types/crm';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink,
  QrCode,
  User,
  MapPin,
  Sparkles,
  ArrowRight,
  Download,
  AlertCircle
} from 'lucide-react';

interface PublicProposalViewProps {
  proposal: Proposal;
  onClose?: () => void;
}

export function PublicProposalView({ proposal, onClose }: PublicProposalViewProps) {
  const { acceptProposal, currentTenant, users } = useCRM();
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(proposal.status === 'ACCEPTED');
  const [copiedPix, setCopiedPix] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const brokerUser = users.find(u => u.id === proposal.assignedUserId);

  const handleAccept = async () => {
    if (!agreedTerms) return;
    setIsAccepting(true);
    try {
      await acceptProposal(proposal.id, '189.40.72.115');
      setHasAccepted(true);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCopyPix = () => {
    if (proposal.asaasQrCode) {
      navigator.clipboard.writeText(proposal.asaasQrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header Elegante */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white relative">
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-slate-300 hover:text-white"
            >
              ✕
            </button>
          )}

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              {currentTenant.name} • Proposta Oficial de Compra e Venda
            </span>
          </div>

          <h2 className="text-xl font-black tracking-tight text-white">
            {proposal.propertyName}
          </h2>
          <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{proposal.unit} — {proposal.propertyAddress}</span>
          </p>

          {/* Status Badge */}
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-xs border border-white/20">
            {hasAccepted ? (
              <span className="text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Proposta Aceita & Confirmada pelo Cliente
              </span>
            ) : (
              <span className="text-amber-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Aguardando Aceite do Cliente (Válida até {new Date(proposal.expiresAt).toLocaleDateString('pt-BR')})
              </span>
            )}
          </div>
        </div>

        {/* Corpo da Proposta */}
        <div className="p-6 space-y-6 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
          {/* Dados do Cliente e Corretor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold text-[10px] uppercase block">Proponente Comprador</span>
              <p className="font-bold text-slate-900 text-sm">{proposal.contactName}</p>
              <p className="text-slate-500 font-mono">{proposal.contactPhone}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold text-[10px] uppercase block">Corretor de Imóveis Responsável</span>
              <p className="font-bold text-slate-900 text-sm">{brokerUser?.name || 'Corretor Vanguard Prime'}</p>
              <p className="text-slate-500 font-mono">{brokerUser?.phone || '+55 11 98877-6655'}</p>
            </div>
          </div>

          {/* Fluxo Financeiro Detalhado */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Condições e Fluxo de Pagamento</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Valor Total</span>
                <p className="text-base font-black text-emerald-950 mt-0.5">
                  R$ {proposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sinal / Entrada</span>
                <p className="text-base font-black text-slate-900 mt-0.5">
                  R$ {proposal.downPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-emerald-700 font-bold">Via {proposal.downPaymentMethod}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Parcelamento Mensal</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {proposal.installmentCount}x de R$ {proposal.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Financiamento / Saldo</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  R$ {(proposal.bankFinancingValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {proposal.baloonValue && proposal.baloonValue > 0 && (
              <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">Balões / Parcelas Intermediárias Anuais:</span>
                <span className="font-bold font-mono">
                  {proposal.baloonCount}x de R$ {proposal.baloonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Seção Asaas PIX para Sinal de Entrada */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sinal de Entrada Instantâneo via PIX Asaas
                </h4>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                Chave Dinâmica Segura
              </span>
            </div>

            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/10 font-mono text-xs">
              <div className="truncate mr-3 text-slate-300">
                {proposal.asaasQrCode || '00020126580014br.gov.bcb.pix0136...'}
              </div>
              <button
                type="button"
                onClick={handleCopyPix}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? 'Copiado!' : 'Copiar PIX'}</span>
              </button>
            </div>

            {proposal.asaasInvoiceUrl && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Deseja pagar via boleto bancário ou cartão?</span>
                <a
                  href={proposal.asaasInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 font-bold"
                >
                  <span>Abrir Fatura Asaas</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Área de Aceite e Assinatura Digital */}
          {!hasAccepted ? (
            <div className="bg-emerald-50/70 border border-emerald-300 p-5 rounded-2xl space-y-4">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="agreeTerms" className="text-xs text-slate-700 cursor-pointer leading-relaxed">
                  Declaro que revisei e concordo expressamente com os valores, memorial e fluxo financeiro acima discriminados para a aquisição da unidade <strong>{proposal.unit}</strong> no empreendimento <strong>{proposal.propertyName}</strong>.
                </label>
              </div>

              <button
                type="button"
                disabled={!agreedTerms || isAccepting}
                onClick={handleAccept}
                className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                  agreedTerms && !isAccepting
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98 shadow-emerald-900/20'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isAccepting ? 'Confirmando Aceite...' : '✍️ Aceitar e Assinar Proposta Comercial'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-100/80 border border-emerald-300 p-5 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-emerald-950">
                Proposta Aceita com Sucesso! 🎉
              </h4>
              <p className="text-xs text-emerald-800">
                Aceite registrado em <strong>{new Date(proposal.clientAcceptedAt || Date.now()).toLocaleString('pt-BR')}</strong> (IP: {proposal.clientIp || '189.40.72.115'}).
              </p>
              <p className="text-[11px] text-emerald-700">
                A comissão do corretor e a baixa de sinal já foram sincronizadas no painel financeiro.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
