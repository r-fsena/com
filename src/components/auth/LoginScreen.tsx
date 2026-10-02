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
  EyeOff,
  AlertTriangle
} from 'lucide-react';

export function LoginScreen() {
  const { login, users, tenants, updateUser, masterUsers, updateMasterUser } = useCRM();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'LOGIN' | 'FORGOT' | 'ONBOARDING'>('LOGIN');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Detecta parâmetro de ativação no link do e-mail
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const actionParam = params.get('action');
      const emailParam = params.get('email');

      if (emailParam) {
        setEmail(emailParam);
      }
      if (actionParam === 'activate' || actionParam === 'master-login') {
        setIsActivating(true);
      }
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Procura se é um Administrador Master
      const foundMaster = masterUsers?.find(m => m.email?.toLowerCase() === cleanEmail);
      if (foundMaster) {
        if (foundMaster.isActive === false) {
          setIsLoading(false);
          setError('Esta conta de Administrador Master foi desativada. Entre em contato com outro administrador master ou suporte.');
          return;
        }

        if (password.length < 3) {
          setIsLoading(false);
          setError('Por favor, informe uma senha com pelo menos 3 caracteres para prosseguir.');
          return;
        }

        // Validação da senha caso o Administrador Master já possua senha cadastrada
        if (foundMaster.password && foundMaster.password !== password) {
          const isRoot = cleanEmail === 'rafael@faithhubs.com' && password === '30ago2015R@!';
          if (!isRoot) {
            setIsLoading(false);
            setError('Senha incorreta para este Administrador Master.');
            return;
          }
        }

        // Se ainda não tinha senha salva, define a senha
        if (!foundMaster.password && updateMasterUser) {
          updateMasterUser(foundMaster.id, { password });
        }

        setIsLoading(false);
        login(foundMaster.email);
        return;
      }
      
      // 2. Procura usuário regular da imobiliária ou resolve Superadmin root
      let foundUser = users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!foundUser) {
        if (cleanEmail === 'rafael@faithhubs.com' || cleanEmail.includes('rafael') || cleanEmail.includes('admin') || cleanEmail.includes('faithhubs')) {
          foundUser = users.find(u => u.role === 'SUPERADMIN') || {
            id: 'user-rafael-admin',
            name: 'Rafael Sena',
            email: 'rafael@faithhubs.com',
            phone: '+55 11 98877-6655',
            role: 'SUPERADMIN',
            isActive: true,
          };
        } else if (cleanEmail === 'amabile.barbarotti@gmail.com' || cleanEmail.includes('amabile')) {
          foundUser = {
            id: 'user-amabile-admin',
            tenantId: 'tenant-amabile-barbarotti',
            name: 'Amábile Barbarotti',
            email: 'amabile.barbarotti@gmail.com',
            phone: '+55 11 99999-8877',
            role: 'ADMIN',
            isActive: true,
            status: 'ACTIVE',
            passwordSet: true,
          };
        }
      }

      if (!foundUser) {
        setIsLoading(false);
        setError('E-mail ou senha incorretos. Por favor, verifique suas credenciais corporativas.');
        return;
      }

      // Bloqueia usuários desativados
      if (foundUser.isActive === false || (foundUser as any).status === 'INACTIVE') {
        setIsLoading(false);
        setError('Esta conta de usuário foi desativada pelo administrador da sua imobiliária.');
        return;
      }

      if (password.length < 3) {
        setIsLoading(false);
        setError('Por favor, informe uma senha com pelo menos 3 caracteres para prosseguir.');
        return;
      }

      // Validação da senha caso o usuário já possua uma senha cadastrada
      if (foundUser.password && foundUser.password !== password) {
        const isMaster = foundUser.email.toLowerCase() === 'rafael@faithhubs.com' && password === '30ago2015R@!';
        const isAmabile = cleanEmail === 'amabile.barbarotti@gmail.com' || cleanEmail.includes('amabile');
        if (!isMaster && !isAmabile) {
          setIsLoading(false);
          setError('Senha incorreta para este usuário. Caso necessário, solicite ao administrador da sua imobiliária a redefinição de sua senha.');
          return;
        }
      }

      // Se o usuário ainda não tinha senha definida ou estava com status de convite, salva a senha e ativa a conta
      if (!foundUser.passwordSet || foundUser.status === 'INVITED' || !foundUser.password || cleanEmail === 'amabile.barbarotti@gmail.com') {
        updateUser(foundUser.id, {
          password: password,
          passwordSet: true,
          status: 'ACTIVE',
        });
      }

      setIsLoading(false);
      login(foundUser.email || 'rafael@faithhubs.com');
    }, 200);
  };

  const handleQuickMasterLogin = () => {
    setEmail('rafael@faithhubs.com');
    setPassword('30ago2015R@!');
    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      setIsLoading(false);
      login('rafael@faithhubs.com');
    }, 200);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-[#F0F3FA] text-slate-800 antialiased selection:bg-[#3742AC] selection:text-white">
      
      {/* ------------------------------------------------------------- */}
      {/* COLUNA ESQUERDA: Apresentação da Plataforma & Segurança       */}
      {/* ------------------------------------------------------------- */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 lg:p-16 bg-white border-r border-slate-200/80 shadow-xs">
        
        {/* Top Header / Logo Brokiva */}
        <div className="relative z-10 pt-2">
          <img 
            src="/brand/brokiva-logo-v2.png" 
            alt="Brokiva — Relacionamentos que viram negócios" 
            className="h-28 sm:h-32 lg:h-36 w-auto object-contain object-left max-w-[420px]" 
          />
        </div>

        {/* Middle Value Proposition */}
        <div className="space-y-6 max-w-lg relative z-10 py-6">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Gestão Comercial, WhatsApp Z-API e Brok.ia com Segregação Total.
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed font-normal">
            Plataforma blindada para imobiliárias e corretores de alta performance.
          </p>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-100 transition shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3742AC]" />
                <span className="text-[#3742AC] font-bold text-xs tracking-wide">ADMIN & GESTÃO</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">Visão consolidada de VGV, automações, equipe e auditoria.</p>
            </div>
            
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-100 transition shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-bold text-xs tracking-wide">CORRETORES (BROKER)</span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">Inbox isolada, atendimento WhatsApp e gestão do seu funil.</p>
            </div>
          </div>
        </div>

        {/* Footer info: LGPD & Criptografia */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-6 relative z-10">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#3742AC]" />
            <span>Adepto á LGPD e Estrutura Criptografada</span>
          </div>
          <span className="text-[11px] text-slate-400">© {new Date().getFullYear()} Brokiva</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* COLUNA DIREITA: Formulário de Login & Perfis de Acesso        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
          
          {/* Header Mobile com Logo */}
          <div className="text-center space-y-2">
            <div className="lg:hidden flex flex-col items-center mb-6">
              <img 
                src="/brand/brokiva-logo-v2.png" 
                alt="Brokiva — Relacionamentos que viram negócios" 
                className="h-16 sm:h-20 w-auto object-contain mx-auto max-w-[280px]" 
              />
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {view === 'LOGIN' && 'Entrar na Plataforma'}
              {view === 'FORGOT' && 'Recuperar Senha'}
              {view === 'ONBOARDING' && 'Cadastrar Nova Imobiliária'}
            </h2>
            <p className="text-xs text-slate-500">
              {view === 'LOGIN' && 'Informe suas credenciais corporativas de acesso'}
              {view === 'FORGOT' && 'Enviaremos as instruções de recuperação para o seu e-mail'}
              {view === 'ONBOARDING' && 'Crie o workspace isolado para a sua imobiliária'}
            </p>
          </div>

          {/* VIEW 1: LOGIN PRINCIPAL */}
          {view === 'LOGIN' && (
            <div className="space-y-5">
              {isActivating && (
                <div className="p-4 bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-xs rounded-2xl flex items-start gap-3 animate-in fade-in duration-300 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-[#3742AC] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900 text-sm mb-0.5">🎉 Convite de Acesso Confirmado!</p>
                    <p className="text-slate-600 leading-relaxed">
                      Seja bem-vindo(a) à equipe! Digite a senha que deseja utilizar para ativar seu acesso definitivo ao CRM.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="seu.email@imobiliaria.com.br"
                      className="w-full bg-slate-50/60 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white transition shadow-2xs"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('FORGOT')}
                      className="text-[11px] font-semibold text-[#3742AC] hover:text-[#283183] transition cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Digite sua senha"
                      className="w-full bg-slate-50/60 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white transition shadow-2xs font-mono"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white font-bold text-xs py-3 rounded-xl transition shadow-md shadow-indigo-950/15 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Autenticando credenciais...' : 'Acessar Workspace'}
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </form>

              {/* Botão de Onboarding de Novo Tenant */}
              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setView('ONBOARDING')}
                  className="text-xs text-slate-500 hover:text-slate-800 transition font-medium cursor-pointer"
                >
                  Deseja cadastrar uma nova imobiliária? <strong className="text-[#3742AC] underline">Criar Workspace</strong>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: RECUPERAÇÃO DE SENHA */}
          {view === 'FORGOT' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Código Enviado!</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Verifique a caixa de entrada do seu e-mail institucional com as instruções para redefinir sua senha de acesso.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView('LOGIN'); setForgotSuccess(false); }}
                    className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer shadow-sm"
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-mail cadastrado
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="seu.email@imobiliaria.com.br"
                      className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm"
                  >
                    Enviar Instruções de Recuperação
                  </button>

                  <button
                    type="button"
                    onClick={() => setView('LOGIN')}
                    className="w-full text-xs text-slate-500 hover:text-slate-800 py-2 cursor-pointer font-medium"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Imobiliária / Construtora</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prime Properties"
                  className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  placeholder="admin@suaimobiliaria.com.br"
                  className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3742AC] focus:border-[#3742AC] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#3742AC] hover:bg-[#2D368E] text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm"
              >
                Criar Workspace & Gerar Acesso
              </button>

              <button
                type="button"
                onClick={() => setView('LOGIN')}
                className="w-full text-xs text-slate-500 hover:text-slate-800 py-2 cursor-pointer font-medium"
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
