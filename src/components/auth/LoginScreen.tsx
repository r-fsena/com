'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  User, 
  Users, 
  CheckCircle2,
  Key,
  Shield,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';

export function LoginScreen() {
  const { login, users, tenants } = useCRM();
  const [email, setEmail] = useState('rafael.sena@vanguardprime.com.br');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'LOGIN' | 'FORGOT' | 'ONBOARDING'>('LOGIN');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      login(email);
    }, 600);
  };

  const handleQuickLogin = (userEmail: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      login(userEmail);
    }, 400);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-slate-950 text-slate-100 antialiased overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* ------------------------------------------------------------- */}
      {/* COLUNA ESQUERDA: Apresentação da Plataforma & Segurança       */}
      {/* ------------------------------------------------------------- */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border-r border-slate-800/80">
        {/* Background glow orb */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/20 font-bold">
            <Building2 className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              SaaS B2B Multi-tenant
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Vanguard CRM Imobiliário
            </h1>
          </div>
        </div>

        {/* Middle Value Proposition */}
        <div className="space-y-6 max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autenticação Segura via Amazon Cognito & RBAC</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
            Gestão Comercial, WhatsApp Z-API e IA Copiloto com Segregação Total.
          </h2>

          <p className="text-sm text-slate-400 leading-relaxed">
            Plataforma blindada para imobiliárias e corretores de alta performance. Cada usuário acessa estritamente o seu nível de permissão comercial.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-emerald-400 font-bold text-sm block">ADMIN & GESTÃO</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Visão consolidada de VGV, automações, equipe e auditoria.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-emerald-400 font-bold text-sm block">CORRETORES (BROKER)</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Inbox isolada, atendimento WhatsApp e gestão do seu funil.</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-6 relative z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Conformidade LGPD & Criptografia KMS</span>
          </div>
          <span className="font-mono text-[11px] text-slate-600">crm.faithhubs.com</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* COLUNA DIREITA: Formulário de Login & Perfis de Acesso        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          
          {/* Header Mobile / Brand */}
          <div className="text-center lg:text-left space-y-1.5">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {view === 'LOGIN' && 'Entrar na Plataforma'}
              {view === 'FORGOT' && 'Recuperar Senha'}
              {view === 'ONBOARDING' && 'Cadastrar Nova Imobiliária'}
            </h2>
            <p className="text-xs text-slate-400">
              {view === 'LOGIN' && 'Informe suas credenciais corporativas do Amazon Cognito'}
              {view === 'FORGOT' && 'Enviaremos um código de autenticação para o seu e-mail'}
              {view === 'ONBOARDING' && 'Crie o workspace isolado para a sua imobiliária'}
            </p>
          </div>

          {/* VIEW 1: LOGIN PRINCIPAL */}
          {view === 'LOGIN' && (
            <div className="space-y-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@imobiliaria.com.br"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('FORGOT')}
                      className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs py-3 rounded-xl transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {isLoading ? 'Autenticando no Cognito...' : 'Acessar Workspace CRM'}
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </form>

              {/* ----------------------------------------------------------- */}
              {/* ACESSO RÁPIDO PARA TESTES DE PAPÉIS & SEGREGAÇÃO (RBAC)     */}
              {/* ----------------------------------------------------------- */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Acesso Rápido por Papel (Segregação RBAC)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">1-Click Test</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* ADMIN */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('rafael.sena@vanguardprime.com.br')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">Rafael Sena</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/40">ADMIN</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Diretoria & Acesso Total</p>
                  </button>

                  {/* MANAGER */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('camila.gestora@vanguardprime.com.br')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">Camila M.</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/40">GESTORA</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Supervisão & Relatórios</p>
                  </button>

                  {/* BROKER 1 */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('lucas.corretor@vanguardprime.com.br')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">Lucas B.</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">CORRETOR</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Leads Jardins / Coberturas</p>
                  </button>

                  {/* BROKER 2 */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('juliana.corretora@vanguardprime.com.br')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-left transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">Juliana P.</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">CORRETORA</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Leads Pinheiros / Moema</p>
                  </button>
                </div>
              </div>

              {/* Botão de Onboarding de Novo Tenant */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setView('ONBOARDING')}
                  className="text-xs text-slate-400 hover:text-white transition font-medium"
                >
                  Deseja cadastrar uma nova imobiliária? <strong className="text-emerald-400 underline">Criar Workspace</strong>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: RECUPERAÇÃO DE SENHA */}
          {view === 'FORGOT' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Código Enviado!</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Verifique a caixa de entrada do seu e-mail institucional com as instruções para redefinir sua senha no Cognito.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView('LOGIN'); setForgotSuccess(false); }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold py-2.5 rounded-xl transition"
                  >
                    Voltar para o Login
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setForgotSuccess(true);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      E-mail cadastrado
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="seu.email@imobiliaria.com.br"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-3 rounded-xl transition"
                  >
                    Enviar Código de Recuperação
                  </button>

                  <button
                    type="button"
                    onClick={() => setView('LOGIN')}
                    className="w-full text-xs text-slate-400 hover:text-white py-2"
                  >
                    ← Voltar ao Login
                  </button>
                </form>
              )}
            </div>
          )}

          {/* VIEW 3: ONBOARDING DE NOVA IMOBILIÁRIA */}
          {view === 'ONBOARDING' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsLoading(true);
                setTimeout(() => {
                  setIsLoading(false);
                  setView('LOGIN');
                }, 800);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome da Imobiliária / Construtora</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prime Properties"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">CNPJ</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  placeholder="admin@suaimobiliaria.com.br"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-3 rounded-xl transition"
              >
                Criar Workspace & Gerar Acesso
              </button>

              <button
                type="button"
                onClick={() => setView('LOGIN')}
                className="w-full text-xs text-slate-400 hover:text-white py-2"
              >
                ← Voltar ao Login
              </button>
            </form>
          )}

        </div>
      </div>

    </div>
  );
}
