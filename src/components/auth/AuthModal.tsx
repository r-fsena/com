'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  Lock, 
  Mail, 
  User, 
  X, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  KeyRound,
  Sparkles
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { currentUser, setCurrentUser, users, currentTenant, setCurrentTenant, tenants } = useCRM();

  const [mode, setMode] = useState<'LOGIN' | 'FORGOT_PASSWORD' | 'REGISTER_TENANT'>('LOGIN');
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  // Register Tenant Fields
  const [tenantName, setTenantName] = useState('');
  const [documentCnpj, setDocumentCnpj] = useState('');
  const [adminName, setAdminName] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase()) || users[0];
    setCurrentUser(foundUser);
    onClose();
  };

  const handleRegisterTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) return;

    const newTenant = {
      id: `tenant-${Date.now()}`,
      name: tenantName.trim(),
      slug: tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      documentCnpj: documentCnpj || '00.000.000/0001-00',
      primaryColor: '#059669',
      timezone: 'America/Sao_Paulo',
      status: 'ACTIVE' as const,
      plan: 'PROFESSIONAL' as const,
      monthlyFee: 890.00,
      maxBrokers: 15,
      maxInstances: 3,
      businessHours: { start: '08:30', end: '19:00', workDays: [1, 2, 3, 4, 5, 6] },
      settings: {
        slaFirstResponseMinutes: 15,
        slaInactivityHours: 24,
        autoAssignRule: 'ROUND_ROBIN' as const,
        aiCopilotEnabled: true,
        requireHumanApprovalForAI: true,
      }
    };

    setCurrentTenant(newTenant);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-900/50">
            <Building2 className="w-6 h-6 text-slate-950" />
          </div>

          <h2 className="text-base font-bold">
            {mode === 'LOGIN' ? 'Autenticação de Usuário' :
             mode === 'FORGOT_PASSWORD' ? 'Recuperação de Acesso' :
             'Onboarding da Imobiliária'}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {mode === 'LOGIN' ? 'Acesse seu painel com isolamento seguro por tenant' :
             mode === 'FORGOT_PASSWORD' ? 'Enviaremos um código de verificação via SMS/E-mail' :
             'Cadastre sua imobiliária e comece a converter leads'}
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6">
          {mode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Profissional</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Senha</label>
                  <button
                    type="button"
                    onClick={() => setMode('FORGOT_PASSWORD')}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Entrar no CRM</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMode('REGISTER_TENANT')}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                >
                  Novo por aqui? <strong>Cadastrar Nova Imobiliária</strong>
                </button>
              </div>
            </form>
          )}

          {mode === 'FORGOT_PASSWORD' && (
            <form onSubmit={(e) => { e.preventDefault(); setMode('LOGIN'); }} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Cadastrado</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              {step === 2 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código de Confirmação</label>
                  <input
                    type="text"
                    placeholder="123456"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                {step === 1 ? 'Enviar Código de Recuperação' : 'Redefinir Senha'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {mode === 'REGISTER_TENANT' && (
            <form onSubmit={handleRegisterTenant} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Imobiliária *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nova Era Real Estate"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ da Empresa</label>
                <input
                  type="text"
                  placeholder="12.345.678/0001-90"
                  value={documentCnpj}
                  onChange={(e) => setDocumentCnpj(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Administrador</label>
                <input
                  type="text"
                  required
                  placeholder="Seu Nome Completo"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Concluir Onboarding & Iniciar
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Já possui conta? <strong>Fazer Login</strong>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
