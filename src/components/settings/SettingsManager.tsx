'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Building2, 
  Settings, 
  QrCode, 
  Wifi, 
  ShieldCheck, 
  Clock, 
  Users, 
  Copy, 
  Check, 
  RefreshCw, 
  Lock,
  Smartphone,
  Send,
  Sliders,
  Calendar,
  UserPlus,
  Shield,
  Palette,
  Globe,
  Plus,
  Trash2,
  Edit3,
  Save,
  CheckCircle2,
  X,
  Crown,
  Mail,
  Phone,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Flag,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { UserRole, User, TenantFeatureFlags, TenantAIConfig, AIProvider, AITone, AIObjective } from '@/types/crm';

interface SettingsManagerProps {
  onOpenQrCodeModal?: () => void;
}

export function SettingsManager({ onOpenQrCodeModal }: SettingsManagerProps) {
  const { 
    currentTenant, 
    updateTenant, 
    instances, 
    syncZapiInstance, 
    users, 
    updateUser, 
    createUser, 
    deleteUser, 
    resendUserInvite, 
    resetUserPassword,
    isFeatureEnabled,
    updateTenantFeatureFlags,
    resetCRMDatabase
  } = useCRM();
  
  // 7 Submenus: Empresa, Usuários, Permissões, SLAs, Z-API, Módulos (Feature Flags), Inteligência Artificial
  const [activeTab, setActiveTab] = useState<'TENANT' | 'USERS' | 'PERMISSIONS' | 'SLA' | 'ZAPI' | 'FLAGS' | 'AI'>('TENANT');
  const [flagsSavedMessage, setFlagsSavedMessage] = useState<string | null>(null);
  const [isResettingData, setIsResettingData] = useState(false);
  const [resetDataSuccess, setResetDataSuccess] = useState(false);
  const [showConfirmResetDataModal, setShowConfirmResetDataModal] = useState(false);

  // Estados de IA (Copiloto Multiprovedor BYOK)
  const [aiConfigState, setAiConfigState] = useState<TenantAIConfig>({
    provider: currentTenant.aiConfig?.provider || 'PLATFORM_DEFAULT',
    apiKey: currentTenant.aiConfig?.apiKey || '',
    model: currentTenant.aiConfig?.model || 'gpt-4o-mini',
    tone: currentTenant.aiConfig?.tone || 'CONSULTATIVE',
    objective: currentTenant.aiConfig?.objective || 'EQUILIBRADO',
    customInstructions: currentTenant.aiConfig?.customInstructions || '',
    enabled: currentTenant.aiConfig?.enabled ?? true,
  });
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [isTestingAiKey, setIsTestingAiKey] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveAiSuccess, setSaveAiSuccess] = useState(false);

  const handleTestAiConnection = async () => {
    setIsTestingAiKey(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/v1/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfigState.provider,
          apiKey: aiConfigState.apiKey,
          model: aiConfigState.model,
        }),
      });
      const data = await res.json();
      setAiTestResult({
        success: data.success,
        message: data.message || data.error || 'Teste de conexão concluído.',
      });
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: `Falha ao conectar com o provedor: ${err.message}`,
      });
    } finally {
      setIsTestingAiKey(false);
    }
  };

  const handleSaveAiConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateTenant({
      aiConfig: aiConfigState,
    });
    setSaveAiSuccess(true);
    setTimeout(() => setSaveAiSuccess(false), 3000);
  };

  // Estados locais da Empresa
  const [companyName, setCompanyName] = useState(currentTenant.name);
  const [documentCnpj, setDocumentCnpj] = useState(currentTenant.documentCnpj);
  const [primaryColor, setPrimaryColor] = useState(currentTenant.primaryColor || '#059669');
  const [timezone, setTimezone] = useState(currentTenant.timezone || 'America/Sao_Paulo');
  const [logoUrl, setLogoUrl] = useState(currentTenant.logoUrl || '');
  const [saveTenantSuccess, setSaveTenantSuccess] = useState(false);

  // Estados de SLAs & Horário Comercial
  const [slaFirstResponse, setSlaFirstResponse] = useState(currentTenant.settings?.slaFirstResponseMinutes || 15);
  const [slaInactivity, setSlaInactivity] = useState(currentTenant.settings?.slaInactivityHours || 24);
  const [autoAssignRule, setAutoAssignRule] = useState<'ROUND_ROBIN' | 'UNASSIGNED_QUEUE' | 'BY_REGION'>(currentTenant.settings?.autoAssignRule || 'ROUND_ROBIN');
  const [workStart, setWorkStart] = useState(currentTenant.businessHours?.start || '08:30');
  const [workEnd, setWorkEnd] = useState(currentTenant.businessHours?.end || '19:00');
  const [workDays, setWorkDays] = useState<number[]>(currentTenant.businessHours?.workDays || [1, 2, 3, 4, 5, 6]);
  const [saveSlaSuccess, setSaveSlaSuccess] = useState(false);

  // Estados de Modal de Novo Usuário & Notificações
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('BROKER');
  const [passwordMode, setPasswordMode] = useState<'LINK' | 'MANUAL'>('LINK');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserMustChangePassword, setNewUserMustChangePassword] = useState(false);

  const [userSuccessMessage, setUserSuccessMessage] = useState<string | null>(null);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [copiedUserEmail, setCopiedUserEmail] = useState<string | null>(null);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);

  // Estados do Modal de Redefinir Senha
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPasswordValue, setShowResetPasswordValue] = useState(true);
  const [resetNotifyEmail, setResetNotifyEmail] = useState(true);
  const [resetMustChangePassword, setResetMustChangePassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [copiedResetCredentials, setCopiedResetCredentials] = useState(false);

  // Estados Z-API
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testPhone, setTestPhone] = useState('+55 11 99123-4567');
  const [testSent, setTestSent] = useState(false);

  const webhookUrl = `https://crm.faithhubs.com/api/v1/webhooks/zapi/${currentTenant.id}/${instances[0]?.zapiInstanceId || 'instance-01'}`;

  // Gerador de senhas aleatórias seguras
  const generateRandomPassword = () => {
    const prefixes = ['Corretor', 'Vanguard', 'Prime', 'Imovel', 'Gestor', 'Acesso'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const symbols = ['@', '#', '$', '!'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    return `${prefix}${symbol}${randomNum}`;
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyInviteLink = (userEmail: string, userName: string) => {
    const inviteText = `Olá ${userName}! Seu acesso ao CRM da ${currentTenant.name} foi liberado.\n\nAcesse: https://crm.faithhubs.com\nSeu e-mail cadastrado: ${userEmail}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedUserEmail(userEmail);
    setTimeout(() => setCopiedUserEmail(null), 2500);
  };

  const handleCopyFullCredentials = (email: string, pass: string, name: string) => {
    const text = `🔑 *Dados de Acesso ao CRM - ${currentTenant.name}*\n\nOlá ${name}!\nSeu acesso foi configurado:\n\n🌐 *Portal:* https://crm.faithhubs.com\n📧 *E-mail:* ${email}\n🔐 *Senha Inicial:* ${pass}\n\nRecomendamos alterar sua senha após o primeiro login.`;
    navigator.clipboard.writeText(text);
    setCopiedResetCredentials(true);
    setTimeout(() => setCopiedResetCredentials(false), 2500);
  };

  const handleOpenResetModal = (user: User) => {
    setSelectedUserForReset(user);
    setResetPasswordValue(generateRandomPassword());
    setShowResetPasswordValue(true);
    setResetNotifyEmail(true);
    setResetMustChangePassword(false);
    setResetModalError(null);
    setCopiedResetCredentials(false);
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;

    const cleanPass = resetPasswordValue.trim();
    if (cleanPass.length < 3) {
      setResetModalError('A senha deve ter pelo menos 3 caracteres.');
      return;
    }

    try {
      setIsResettingPassword(true);
      setResetModalError(null);

      const res = await resetUserPassword(selectedUserForReset.id, cleanPass, {
        notifyEmail: resetNotifyEmail,
        mustChangePassword: resetMustChangePassword,
      });

      setUserSuccessMessage(`🔑 ${res.message} (Nova senha: ${cleanPass})`);
      setIsResetPasswordModalOpen(false);
      setTimeout(() => setUserSuccessMessage(null), 8000);
    } catch (err: any) {
      setResetModalError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleSaveTenant = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant({
      name: companyName,
      documentCnpj: documentCnpj,
      primaryColor: primaryColor,
      timezone: timezone,
      logoUrl: logoUrl,
    });
    setSaveTenantSuccess(true);
    setTimeout(() => setSaveTenantSuccess(false), 3000);
  };

  const handleSaveSla = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant({
      settings: {
        ...currentTenant.settings,
        slaFirstResponseMinutes: Number(slaFirstResponse),
        slaInactivityHours: Number(slaInactivity),
        autoAssignRule: autoAssignRule,
      },
      businessHours: {
        start: workStart,
        end: workEnd,
        workDays: workDays,
      }
    });
    setSaveSlaSuccess(true);
    setTimeout(() => setSaveSlaSuccess(false), 3000);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const cleanName = newUserName.trim();
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanPhone = newUserPhone.trim() || '+55 11 99999-0000';

    if (!cleanName) {
      setUserModalError('Por favor, informe o nome completo do usuário.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setUserModalError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    // Validação estrita de unicidade de e-mail
    const alreadyExists = users.some(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (alreadyExists) {
      setUserModalError(`Já existe um usuário cadastrado com o e-mail "${cleanEmail}". Cada usuário deve ter um e-mail único.`);
      return;
    }

    if (passwordMode === 'MANUAL' && newUserPassword.trim().length < 3) {
      setUserModalError('A senha inicial deve ter pelo menos 3 caracteres.');
      return;
    }

    try {
      const created = createUser({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: newUserRole,
        isActive: true,
        password: passwordMode === 'MANUAL' ? newUserPassword.trim() : undefined,
        mustChangePassword: passwordMode === 'MANUAL' ? newUserMustChangePassword : false,
      });

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserPassword('');
      setUserModalError(null);
      setIsNewUserModalOpen(false);

      if (passwordMode === 'MANUAL') {
        setUserSuccessMessage(`✅ Usuário "${created.name}" (${created.email}) cadastrado com a senha inicial: "${newUserPassword}"!`);
      } else {
        setUserSuccessMessage(`✅ Usuário "${created.name}" (${created.email}) cadastrado e convidado por e-mail com sucesso!`);
      }
      setTimeout(() => setUserSuccessMessage(null), 8000);
    } catch (err: any) {
      setUserModalError(err.message || 'Erro ao cadastrar usuário.');
    }
  };

  const toggleWorkDay = (day: number) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day));
    } else {
      setWorkDays([...workDays, day].sort());
    }
  };

  const DAYS_MAP = [
    { label: 'Dom', value: 0 },
    { label: 'Seg', value: 1 },
    { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 },
    { label: 'Qui', value: 4 },
    { label: 'Sex', value: 5 },
    { label: 'Sáb', value: 6 },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header com 100% de Aproveitamento de Tela */}
      <div className="bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
              <Settings className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Configurações & Painel de Controle</h1>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie dados da empresa, equipe de corretores, matriz de permissões, SLAs e integração com WhatsApp
          </p>
        </div>
      </div>

      {/* Submenus Solicitados */}
      <div className="bg-white border-b border-slate-200 px-6 sm:px-8 flex gap-2 sm:gap-6 text-xs font-semibold text-slate-500 overflow-x-auto no-scrollbar">
        {/* 1. CONFIGURAÇÕES DA EMPRESA */}
        <button
          onClick={() => setActiveTab('TENANT')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'TENANT'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Configurações da Empresa</span>
        </button>

        {/* 2. USUÁRIOS */}
        <button
          onClick={() => setActiveTab('USERS')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'USERS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Usuários & Corretores</span>
        </button>

        {/* 3. PERMISSÕES */}
        <button
          onClick={() => setActiveTab('PERMISSIONS')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'PERMISSIONS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>3. Permissões (RBAC)</span>
        </button>

        {/* 4. SLAS E HORÁRIO COMERCIAL */}
        <button
          onClick={() => setActiveTab('SLA')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'SLA'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>4. SLAs & Horário Comercial</span>
        </button>

        {/* 5. WHATSAPP & Z-API */}
        <button
          onClick={() => setActiveTab('ZAPI')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'ZAPI'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>5. Conexão WhatsApp & Z-API</span>
        </button>

        {/* 6. MÓDULOS & FEATURE FLAGS */}
        <button
          onClick={() => setActiveTab('FLAGS')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'FLAGS'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Flag className="w-4 h-4 text-emerald-600" />
          <span>6. Módulos & Features (Flags)</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">
            Ativo
          </span>
        </button>

        {/* 7. INTELIGÊNCIA ARTIFICIAL (COPILOTO) */}
        <button
          onClick={() => setActiveTab('AI')}
          className={`py-3.5 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'AI'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
          <span>7. Inteligência Artificial (Copiloto)</span>
          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
            <span>BYOK</span>
          </span>
        </button>
      </div>

      {/* Conteúdo dos Submenus com 100% de Aproveitamento Fluido */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 w-full space-y-6">

        {/* ========================================================================= */}
        {/* SUBMENU 1: CONFIGURAÇÕES DA EMPRESA                                      */}
        {/* ========================================================================= */}
        {activeTab === 'TENANT' && (
          <form onSubmit={handleSaveTenant} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Dados Cadastrais da Imobiliária / Tenant</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informações institucionais exibidas no cabeçalho, relatórios e mensagens automáticas.
                </p>
              </div>

              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveTenantSuccess ? 'Salvo com Sucesso! ✨' : 'Salvar Alterações'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome Fantasia da Empresa *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">CNPJ Oficial *</label>
                <input
                  type="text"
                  value={documentCnpj}
                  onChange={(e) => setDocumentCnpj(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Cor Primária da Marca (Hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Fuso Horário Padrão</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="America/Sao_Paulo">Horário de Brasília (America/Sao_Paulo - GMT-3)</option>
                  <option value="America/Manaus">Horário de Manaus (America/Manaus - GMT-4)</option>
                  <option value="America/Cuiaba">Horário de Cuiabá (America/Cuiaba - GMT-4)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">URL do Logotipo da Imobiliária</label>
              <input
                type="url"
                placeholder="https://suaempresa.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 2: USUÁRIOS & CORRETORES                                         */}
        {/* ========================================================================= */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Gestão de Usuários & Corretores ({users.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adicione, edite perfis e gerencie o acesso de cada corretor e gestor do CRM.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUserModalError(null);
                  setIsNewUserModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Convidar Novo Usuário</span>
              </button>
            </div>

            {/* Banner de Sucesso pós-convite */}
            {userSuccessMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold">{userSuccessMessage}</span>
                </div>
                <button 
                  onClick={() => setUserSuccessMessage(null)} 
                  className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tabela de Usuários com Aproveitamento Fluido 100% */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-[28%]">Usuário / Corretor</th>
                    <th className="py-3.5 px-4 w-[16%]">Cargo / Perfil</th>
                    <th className="py-3.5 px-4 w-[18%]">WhatsApp / Telefone</th>
                    <th className="py-3.5 px-4 w-[18%]">Status de Acesso</th>
                    <th className="py-3.5 px-4 text-right w-[20%]">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium">Nenhum usuário cadastrado.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map(u => {
                      const isMaster = u.role === 'SUPERADMIN' || u.role === 'ADMIN_MASTER';
                      const isCurrent = u.id === 'user-rafael-admin';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=059669&color=fff`}
                                alt={u.name}
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/20 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 truncate">{u.name}</p>
                                  {isMaster && (
                                    <span title="SuperAdmin Master" className="shrink-0">
                                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono truncate">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" /> {u.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 border whitespace-nowrap ${
                              isMaster ? 'bg-amber-50 text-amber-900 border-amber-300 font-black' :
                              u.role === 'ADMIN' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                              u.role === 'MANAGER' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {isMaster ? '👑 SUPERADMIN' :
                               u.role === 'ADMIN' ? '🛡️ ADMIN' :
                               u.role === 'MANAGER' ? '💼 GESTOR' :
                               u.role === 'VIEWER' ? '👁️ VISUALIZADOR' :
                               '👤 CORRETOR'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {u.phone ? (
                              <span className="flex items-center gap-1.5 whitespace-nowrap">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {u.phone}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Não informado</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {u.passwordSet || u.status === 'ACTIVE' ? (
                              <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>Ativo</span>
                              </span>
                            ) : (
                              <span className="text-[10.5px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-300 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                <span>Convite Pendente</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                              {/* Botão de Redefinir Senha */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetModal(u)}
                                className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200 transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                                title="Definir ou redefinir senha do usuário"
                              >
                                <Key className="w-3.5 h-3.5 text-blue-700" />
                                <span>Senha</span>
                              </button>

                              {/* Botão de Reenviar E-mail de Convite */}
                              {(!u.passwordSet || u.status === 'INVITED') && !isMaster && (
                                <button
                                  type="button"
                                  disabled={resendingUserId === u.id}
                                  onClick={async () => {
                                    try {
                                      setResendingUserId(u.id);
                                      const res = await resendUserInvite(u.id);
                                      setUserSuccessMessage(`✉️ ${res.message}`);
                                      setTimeout(() => setUserSuccessMessage(null), 6000);
                                    } catch (err: any) {
                                      setUserModalError(err.message || 'Erro ao reenviar convite');
                                    } finally {
                                      setResendingUserId(null);
                                    }
                                  }}
                                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs active:scale-95 whitespace-nowrap"
                                  title="Reenviar e-mail com instruções de acesso"
                                >
                                  {resendingUserId === u.id ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                                      <span>Enviando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Convite</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Botão de Copiar Instruções de Acesso */}
                              <button
                                type="button"
                                onClick={() => handleCopyInviteLink(u.email, u.name)}
                                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                                  copiedUserEmail === u.email
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                                title="Copiar mensagem com instruções de login"
                              >
                                {copiedUserEmail === u.email ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>

                              {!isMaster && (
                                <select
                                  value={u.role}
                                  onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                                  className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none cursor-pointer text-slate-700 shadow-2xs"
                                >
                                  <option value="ADMIN">Admin</option>
                                  <option value="MANAGER">Gestor</option>
                                  <option value="BROKER">Corretor</option>
                                  <option value="VIEWER">Visualizador</option>
                                </select>
                              )}

                              {!isMaster && !isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Deseja realmente remover o acesso de ${u.name}?`)) {
                                      deleteUser(u.id);
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Cadastro de Novo Usuário */}
            {isNewUserModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <span>Convidar / Cadastrar Novo Usuário</span>
                    </h3>
                    <button 
                      type="button"
                      onClick={() => {
                        setUserModalError(null);
                        setIsNewUserModalOpen(false);
                      }} 
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Seletor de Modo de Definição de Senha */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPasswordMode('LINK')}
                      className={`py-2 px-3 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        passwordMode === 'LINK'
                          ? 'bg-white text-emerald-800 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Convite por E-mail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordMode('MANUAL');
                        if (!newUserPassword) setNewUserPassword(generateRandomPassword());
                      }}
                      className={`py-2 px-3 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        passwordMode === 'MANUAL'
                          ? 'bg-white text-emerald-800 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Definir Senha Padrão</span>
                    </button>
                  </div>

                  {/* Info contextual */}
                  {passwordMode === 'LINK' ? (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        Um <strong>e-mail de convite oficial</strong> com link seguro para definição de senha e ativação da conta será enviado automaticamente.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start gap-2.5">
                      <Key className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        Você está definindo uma <strong>senha inicial padrão</strong>. O usuário já poderá acessar o CRM imediatamente com essa senha.
                      </span>
                    </div>
                  )}

                  {userModalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-shake">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{userModalError}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateNewUser} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        placeholder="Ex: Corretor Amábile"
                        value={newUserName}
                        onChange={(e) => {
                          setNewUserName(e.target.value);
                          if (userModalError) setUserModalError(null);
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        E-mail Comercial (Único) *
                      </label>
                      <input
                        type="email"
                        placeholder="corretor@empresa.com.br"
                        value={newUserEmail}
                        onChange={(e) => {
                          setNewUserEmail(e.target.value);
                          if (userModalError) setUserModalError(null);
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Este e-mail será a chave única de login.
                      </p>
                    </div>

                    {/* Campo de Senha Manual se ativado */}
                    {passwordMode === 'MANUAL' && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">Senha Inicial Definida *</label>
                          <button
                            type="button"
                            onClick={() => setNewUserPassword(generateRandomPassword())}
                            className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Gerar Automática</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showNewUserPassword ? 'text' : 'password'}
                            placeholder="Ex: Corretor@2026"
                            value={newUserPassword}
                            onChange={(e) => {
                              setNewUserPassword(e.target.value);
                              if (userModalError) setUserModalError(null);
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-3.5 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                            className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <label className="flex items-center gap-2 text-slate-600 text-[11px] cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={newUserMustChangePassword}
                            onChange={(e) => setNewUserMustChangePassword(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span>Exigir alteração de senha no primeiro login</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp / Telefone</label>
                      <input
                        type="text"
                        placeholder="+55 11 99999-8888"
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Cargo / Papel no CRM</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="BROKER">Corretor (Acessa seus leads e atende no WhatsApp)</option>
                        <option value="MANAGER">Gestor Comercial (Acessa toda a equipe e funis)</option>
                        <option value="ADMIN">Administrador (Controle total do ambiente)</option>
                        <option value="VIEWER">Visualizador (Apenas leitura)</option>
                      </select>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUserModalError(null);
                          setIsNewUserModalOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer active:scale-98 flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{passwordMode === 'MANUAL' ? 'Cadastrar com Senha' : 'Salvar e Enviar Convite'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal de Redefinição de Senha de Usuário */}
            {isResetPasswordModalOpen && selectedUserForReset && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Key className="w-4 h-4 text-blue-600" />
                      <span>Redefinir Senha do Usuário</span>
                    </h3>
                    <button 
                      type="button"
                      onClick={() => {
                        setResetModalError(null);
                        setIsResetPasswordModalOpen(false);
                      }} 
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Informações do Usuário Selecionado */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                        {selectedUserForReset.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{selectedUserForReset.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{selectedUserForReset.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {selectedUserForReset.role}
                    </span>
                  </div>

                  {resetModalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-shake">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{resetModalError}</span>
                    </div>
                  )}

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">Nova Senha de Acesso *</label>
                        <button
                          type="button"
                          onClick={() => setResetPasswordValue(generateRandomPassword())}
                          className="text-[10px] text-blue-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          <span>Gerar Senha Automática</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showResetPasswordValue ? 'text' : 'password'}
                          value={resetPasswordValue}
                          onChange={(e) => {
                            setResetPasswordValue(e.target.value);
                            if (resetModalError) setResetModalError(null);
                          }}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPasswordValue(!showResetPasswordValue)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showResetPasswordValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Opções de Envio e Segurança */}
                    <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                      <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={resetNotifyEmail}
                          onChange={(e) => setResetNotifyEmail(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>Enviar e-mail de notificação com a nova senha</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={resetMustChangePassword}
                          onChange={(e) => setResetMustChangePassword(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>Exigir alteração de senha no próximo login</span>
                      </label>
                    </div>

                    {/* Botão de Copiar Acesso Rápido */}
                    <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs">
                      <span className="text-blue-900 font-medium text-[11px]">Deseja enviar direto no WhatsApp?</span>
                      <button
                        type="button"
                        onClick={() => handleCopyFullCredentials(selectedUserForReset.email, resetPasswordValue, selectedUserForReset.name)}
                        className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedResetCredentials ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-blue-600" />}
                        <span>{copiedResetCredentials ? 'Copiado!' : 'Copiar Acesso'}</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetModalError(null);
                          setIsResetPasswordModalOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isResettingPassword}
                        className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer active:scale-98 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isResettingPassword ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Key className="w-3.5 h-3.5" />
                            <span>Salvar Nova Senha</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 3: PERMISSÕES (RBAC)                                             */}
        {/* ========================================================================= */}
        {activeTab === 'PERMISSIONS' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Matriz de Permissões por Papel (RBAC)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle granular de visualização, edição, exportação e disparo de mensagens para cada nível de acesso.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10.5px]">
                  <tr>
                    <th className="py-3 px-4">Permissão Comercial</th>
                    <th className="py-3 px-4 text-center">SuperAdmin / Admin</th>
                    <th className="py-3 px-4 text-center">Gestor (Manager)</th>
                    <th className="py-3 px-4 text-center">Corretor (Broker)</th>
                    <th className="py-3 px-4 text-center">Visualizador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-semibold">Visualizar Todos os Leads e Conversas do CRM</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-400">Apenas Próprios</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Editar e Mover Cards de Oportunidades no Funil</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Cadastrar e Vincular Imóveis Apresentados</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Disparar Campanhas em Lote no WhatsApp</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Configurar Etapas do Funil Kanban & SLAs</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Configurar Chaves Z-API e Integrações de Sistema</td>
                    <td className="py-3 px-4 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                    <td className="py-3 px-4 text-center text-slate-300">✖</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 4: SLAS E HORÁRIO COMERCIAL                                      */}
        {/* ========================================================================= */}
        {activeTab === 'SLA' && (
          <form onSubmit={handleSaveSla} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Configuração de SLAs & Horário de Funcionamento</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina os tempos limites de resposta e o período de plantão comercial para alertas e distribuição.
                </p>
              </div>

              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveSlaSuccess ? 'Salvo com Sucesso! ✨' : 'Salvar SLAs'}</span>
              </button>
            </div>

            {/* Tempos de SLA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  SLA de Primeiro Atendimento (Minutos)
                </label>
                <p className="text-[10.5px] text-slate-500 mb-2">
                  Tempo máximo aceitável para um corretor responder a um novo lead antes de disparar alerta crítico.
                </p>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={slaFirstResponse}
                  onChange={(e) => setSlaFirstResponse(Number(e.target.value))}
                  className="w-full text-xs font-bold font-mono bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  SLA de Inatividade / Lead Parado (Horas)
                </label>
                <p className="text-[10.5px] text-slate-500 mb-2">
                  Tempo sem interação com o cliente para marcar o lead como 'Estagnado' no funil.
                </p>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={slaInactivity}
                  onChange={(e) => setSlaInactivity(Number(e.target.value))}
                  className="w-full text-xs font-bold font-mono bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {/* Regra de Distribuição Automática */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Regra de Distribuição Automática de Leads (Roleta)
              </label>
              <select
                value={autoAssignRule}
                onChange={(e) => setAutoAssignRule(e.target.value as any)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer"
              >
                <option value="ROUND_ROBIN">🔄 Round-Robin (Roleta Equitativa entre Corretores Ativos)</option>
                <option value="UNASSIGNED_QUEUE">📥 Fila de Espera Não Atribuída (Puxar por Demanda)</option>
                <option value="BY_REGION">📍 Distribuição por Especialidade / Região de Atuação</option>
              </select>
            </div>

            {/* Horário Comercial e Dias de Funcionamento */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="text-xs font-bold text-slate-800 block">
                Horário de Atendimento Comercial
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10.5px] text-slate-500 block mb-1">Início do Expediente</label>
                  <input
                    type="time"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] text-slate-500 block mb-1">Término do Expediente</label>
                  <input
                    type="time"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] text-slate-500 block mb-1.5">Dias da Semana com Plantão Ativo:</label>
                <div className="flex gap-2">
                  {DAYS_MAP.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWorkDay(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        workDays.includes(d.value)
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 5: WHATSAPP & Z-API                                              */}
        {/* ========================================================================= */}
        {activeTab === 'ZAPI' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-300">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Instância WhatsApp Ativa
                    </span>
                    <h2 className="text-lg font-bold text-white">Z-API Gateway Oficial</h2>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  OPERACIONAL
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                Todas as mensagens recebidas e enviadas pelos corretores passam por esta instância oficial da Z-API com fila SQS e criptografia.
              </p>
            </div>

            {/* Card da Instância com Ações */}
            {instances.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-slate-900">Nenhuma Linha WhatsApp Conectada</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Conecte o WhatsApp Oficial de Captação da <strong>{currentTenant.name}</strong> para receber leads automaticamente e habilitar o atendimento da equipe comercial.
                  </p>
                </div>
                {onOpenQrCodeModal && (
                  <button
                    type="button"
                    onClick={onOpenQrCodeModal}
                    className="inline-flex items-center gap-2 text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-bold px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Conectar WhatsApp via QR Code</span>
                  </button>
                )}
              </div>
            ) : (
              instances.map(inst => (
                <div key={inst.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 font-bold">
                        WA
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{inst.name}</h3>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            ● Conectado
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-500">{inst.phoneNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onOpenQrCodeModal && (
                        <button
                          onClick={onOpenQrCodeModal}
                          className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 py-2 transition font-bold shadow-xs active:scale-95 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Abrir QR Code / Reconectar</span>
                        </button>
                      )}
                      <button
                        onClick={() => syncZapiInstance(inst.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-xl px-3 py-2 transition font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Testar Conexão</span>
                      </button>
                    </div>
                  </div>

                  {/* Chaves de Acesso */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase font-bold">Instance ID</span>
                      <span className="font-bold text-slate-800">{inst.zapiInstanceId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase font-bold">Token de Segurança</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> AWS Secrets Manager (Encriptado)
                      </span>
                    </div>
                  </div>

                  {/* Webhook Endpoint */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      URL de Webhook (Configure no painel Z-API em "Ao Receber Mensagem")
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 text-xs bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-700 focus:outline-none"
                      />
                      <button
                        onClick={handleCopyWebhook}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer"
                      >
                        {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulário de Envio de Teste */}
                  <form onSubmit={handleSendTestMessage} className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Disparar Mensagem de Teste Direto
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="+55 11 90000-0000"
                        className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{testSent ? 'Enviado!' : 'Enviar Teste'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ))
            )}

            {/* Card de Higienização e Limpeza da Base */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Higienização e Reset da Base de Testes</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Limpe todos os contatos e conversas antigas e recarregue uma base 100% nova diretamente do WhatsApp conectado.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmResetDataModal(true)}
                  disabled={isResettingData}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResettingData ? 'animate-spin' : ''}`} />
                  <span>{isResettingData ? 'Higienizando...' : 'Zerar Base & Resincronizar'}</span>
                </button>
              </div>

              {resetDataSuccess && (
                <div className="bg-emerald-100 text-emerald-800 text-xs font-bold p-3 rounded-xl border border-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Base de dados resetada com sucesso e sincronização limpa concluída!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 6: MÓDULOS & FEATURE FLAGS                                       */}
        {/* ========================================================================= */}
        {activeTab === 'FLAGS' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-emerald-600" />
                    <span>Módulos & Feature Flags do Ambiente ({currentTenant.name})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Habilite ou desabilite recursos em tempo real para personalizar a experiência da sua equipe.
                  </p>
                </div>

                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                  ⚡ Atualização Instantânea
                </span>
              </div>

              {flagsSavedMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{flagsSavedMessage}</span>
                </div>
              )}

              {/* Categorias de Flags */}
              {[
                {
                  category: '📲 WhatsApp & Mensageria Omnichannel',
                  description: 'Recursos de conexão, sincronização e inteligência de atendimento via WhatsApp.',
                  items: [
                    {
                      key: 'whatsappAutoSync' as keyof TenantFeatureFlags,
                      title: 'Sincronização Automática de Histórico',
                      description: 'Puxa conversas, mensagens recentes e fotos de perfil assim que o corretor lê o QR Code.',
                      badge: 'Essencial',
                    },
                    {
                      key: 'whatsappVoiceTranscription' as keyof TenantFeatureFlags,
                      title: 'Transcrição de Áudios por IA',
                      description: 'Transcreve mensagens de voz do WhatsApp em texto corrido com 1 clique.',
                      badge: 'IA',
                    },
                    {
                      key: 'whatsappLabelsSync' as keyof TenantFeatureFlags,
                      title: 'Sincronização de Etiquetas do WhatsApp Business',
                      description: 'Importa e mapeia as etiquetas do WhatsApp Business diretamente como Tags dos Leads.',
                      badge: 'Business',
                    },
                    {
                      key: 'whatsappMultiBroker' as keyof TenantFeatureFlags,
                      title: 'Linhas Individuais por Corretor',
                      description: 'Permite que cada corretor conecte seu próprio número de WhatsApp diretamente ao CRM.',
                      badge: 'Multi-Linha',
                    },
                  ],
                },
                {
                  category: '🧠 Inteligência Artificial & Copiloto',
                  description: 'Recursos de aprendizado comercial, sugestão de respostas e qualificação preditiva.',
                  items: [
                    {
                      key: 'aiCopilot' as keyof TenantFeatureFlags,
                      title: 'Copiloto Comercial de Respostas',
                      description: 'Sugere respostas táticas, quebra de objeções e resumos 360º em tempo real.',
                      badge: 'Claude 3.5',
                    },
                    {
                      key: 'aiAutoScoring' as keyof TenantFeatureFlags,
                      title: 'Pontuação Preditiva de Leads (Scoring)',
                      description: 'Calcula a temperatura (HOT/WARM/COLD) e prioridade de atendimento automaticamente.',
                      badge: 'Scoring',
                    },
                    {
                      key: 'aiRequireHumanApproval' as keyof TenantFeatureFlags,
                      title: 'Aprovação Humana Obrigatória',
                      description: 'Exige que o corretor clique em aprovar/enviar antes de disparar qualquer sugestão da IA.',
                      badge: 'Segurança',
                    },
                  ],
                },
                {
                  category: '💼 Vendas & Funil Imobiliário',
                  description: 'Gestão visual do pipeline de oportunidades e perfil financeiro completo dos clientes.',
                  items: [
                    {
                      key: 'kanbanDeals' as keyof TenantFeatureFlags,
                      title: 'Funil Visual de Oportunidades (Kanban)',
                      description: 'Quadro visual de etapas com cards arrastáveis, valores totais e taxas de conversão.',
                      badge: 'Vendas',
                    },
                    {
                      key: 'financialQualification' as keyof TenantFeatureFlags,
                      title: 'Qualificação Financeira 360º',
                      description: 'Campos estruturados de Renda Mensal, Entrada Disponível, Orçamento e Financiamento.',
                      badge: 'Financeiro',
                    },
                    {
                      key: 'presentedProperties' as keyof TenantFeatureFlags,
                      title: 'Rastreador de Imóveis Apresentados',
                      description: 'Módulo lateral para registrar edifícios, unidades e propostas vinculadas a cada lead.',
                      badge: 'Imóveis',
                    },
                    {
                      key: 'leadImportExport' as keyof TenantFeatureFlags,
                      title: 'Importação & Migração de Planilhas CSV',
                      description: 'Permite carregar arquivos .CSV com validação de dados ou exportar a base de contatos.',
                      badge: 'Migração',
                    },
                  ],
                },
                {
                  category: '💳 Cobrança, Faturamento & Compliance',
                  description: 'Módulos de integração financeira com gateway Asaas e governança de dados.',
                  items: [
                    {
                      key: 'asaasBilling' as keyof TenantFeatureFlags,
                      title: 'Integração & Faturamento Asaas',
                      description: 'Emissão de cobranças, links de pagamento, PIX e boletos vinculados a transações.',
                      badge: 'Asaas Gateway',
                    },
                    {
                      key: 'lgpdCompliance' as keyof TenantFeatureFlags,
                      title: 'Governança & Consentimento LGPD',
                      description: 'Registro de opt-in, data de consentimento e termos de privacidade para cada lead.',
                      badge: 'Compliance',
                    },
                  ],
                },
              ].map((group, gIdx) => (
                <div key={gIdx} className="pt-4 border-t border-slate-100 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{group.category}</h4>
                    <p className="text-[11px] text-slate-500">{group.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map(item => {
                      const isEnabled = isFeatureEnabled(item.key);
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            updateTenantFeatureFlags({ [item.key]: !isEnabled });
                            setFlagsSavedMessage(`Recurso "${item.title}" ${!isEnabled ? 'habilitado' : 'desabilitado'} com sucesso!`);
                            setTimeout(() => setFlagsSavedMessage(null), 3500);
                          }}
                          className={`p-4 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                            isEnabled
                              ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/80 shadow-2xs'
                              : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 opacity-75'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900">{item.title}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{item.description}</p>
                          </div>

                          <button
                            type="button"
                            className={`w-11 h-6 rounded-full transition relative shrink-0 mt-1 cursor-pointer ${
                              isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                                isEnabled ? 'left-5.5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBMENU 7: INTELIGÊNCIA ARTIFICIAL (COPILOTO MULTIPROVEDOR BYOK)         */}
        {/* ========================================================================= */}
        {activeTab === 'AI' && (
          <form onSubmit={handleSaveAiConfig} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-8">
            {/* Header da Aba */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Configuração de IA do Espaço (Copiloto)</h3>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                    Tenant: {currentTenant.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Conecte a inteligência artificial favorita da sua imobiliária com chave própria (BYOK). Reduza custos para zero e personalize o tom de voz e os argumentos de vendas do seu time de corretores.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {saveAiSuccess && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Configurações salvas!</span>
                  </span>
                )}
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Configurações de IA</span>
                </button>
              </div>
            </div>

            {/* Status do Módulo */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900">Ativar Copiloto de IA no Inbox</h4>
                <p className="text-[11px] text-slate-500">
                  Quando ativo, sugere respostas de vendas e qualifica os 4 pilares do lead em tempo real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiConfigState(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-7 rounded-full transition relative cursor-pointer ${
                  aiConfigState.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-1 transition-transform ${
                    aiConfigState.enabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Seleção do Provedor de IA */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 block">
                1. Escolha o Provedor de Inteligência Artificial:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Opção OpenAI */}
                <div
                  onClick={() => setAiConfigState(prev => ({
                    ...prev,
                    provider: 'OPENAI',
                    model: prev.provider === 'OPENAI' ? prev.model : 'gpt-4o-mini',
                  }))}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                    aiConfigState.provider === 'OPENAI'
                      ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      OA
                    </span>
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                      Mais Popular
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">OpenAI (ChatGPT)</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Modelos <strong>GPT-4o Mini</strong> e <strong>GPT-4o</strong>. Ultra rápido e com fração de centavo por conversa.
                  </p>
                </div>

                {/* Opção Anthropic Claude */}
                <div
                  onClick={() => setAiConfigState(prev => ({
                    ...prev,
                    provider: 'ANTHROPIC',
                    model: prev.provider === 'ANTHROPIC' ? prev.model : 'claude-3-5-haiku-20241022',
                  }))}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                    aiConfigState.provider === 'ANTHROPIC'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      CL
                    </span>
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                      Alta Persuasão
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Anthropic (Claude)</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Modelos <strong>Claude 3.5 Haiku</strong> e <strong>Sonnet</strong>. Excelente sofisticação em redação comercial.
                  </p>
                </div>

                {/* Opção Google Gemini */}
                <div
                  onClick={() => setAiConfigState(prev => ({
                    ...prev,
                    provider: 'GEMINI',
                    model: prev.provider === 'GEMINI' ? prev.model : 'gemini-1.5-flash',
                  }))}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                    aiConfigState.provider === 'GEMINI'
                      ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      GE
                    </span>
                    <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">
                      Econômico
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Google Gemini</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Modelos <strong>Gemini 1.5 Flash</strong> e <strong>Pro</strong>. Custo quase zero e tier gratuito generoso.
                  </p>
                </div>

                {/* Opção Nativa da Plataforma */}
                <div
                  onClick={() => setAiConfigState(prev => ({
                    ...prev,
                    provider: 'PLATFORM_DEFAULT',
                    model: 'default-semantic',
                  }))}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                    aiConfigState.provider === 'PLATFORM_DEFAULT'
                      ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      CRM
                    </span>
                    <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md">
                      Sem Chave
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Nativo da Plataforma</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Motor de inferência local sem custos adicionais. Pronto para uso imediato.
                  </p>
                </div>
              </div>
            </div>

            {/* Credenciais e Modelo (quando não for Nativo) */}
            {aiConfigState.provider !== 'PLATFORM_DEFAULT' && (
              <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900">Chave de Acesso & Modelo ({aiConfigState.provider})</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Campo de API Key */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Chave de API (API Key do Provedor):
                    </label>
                    <div className="relative">
                      <input
                        type={showAiApiKey ? 'text' : 'password'}
                        value={aiConfigState.apiKey || ''}
                        onChange={(e) => setAiConfigState(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder={
                          aiConfigState.provider === 'OPENAI'
                            ? 'sk-proj-...'
                            : aiConfigState.provider === 'ANTHROPIC'
                            ? 'sk-ant-api03-...'
                            : 'AIzaSy...'
                        }
                        className="w-full bg-white text-xs rounded-xl pl-3 pr-24 py-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowAiApiKey(!showAiApiKey)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          title={showAiApiKey ? 'Ocultar' : 'Exibir'}
                        >
                          {showAiApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          disabled={isTestingAiKey || !aiConfigState.apiKey}
                          onClick={handleTestAiConnection}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-indigo-200/80 transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {isTestingAiKey ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Testando...</span>
                            </>
                          ) : (
                            <span>Testar</span>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sua chave é armazenada de forma isolada para este espaço ({currentTenant.name}) e nunca é compartilhada com outras imobiliárias.
                    </p>
                  </div>

                  {/* Seletor de Modelo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Modelo Específico:
                    </label>
                    <select
                      value={aiConfigState.model || ''}
                      onChange={(e) => setAiConfigState(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full bg-white text-xs rounded-xl px-3 py-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {aiConfigState.provider === 'OPENAI' && (
                        <>
                          <option value="gpt-4o-mini">gpt-4o-mini (Recomendado / Mais Rápido & Econômico)</option>
                          <option value="gpt-4o">gpt-4o (Máxima Capacidade de Raciocínio)</option>
                        </>
                      )}
                      {aiConfigState.provider === 'ANTHROPIC' && (
                        <>
                          <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Recomendado / Ágil)</option>
                          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Topo de Linha)</option>
                        </>
                      )}
                      {aiConfigState.provider === 'GEMINI' && (
                        <>
                          <option value="gemini-1.5-flash">gemini-1.5-flash (Recomendado / Custo Mínimo)</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro (Raciocínio Profundo)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Feedback do Teste de Conexão */}
                {aiTestResult && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                    aiTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{aiTestResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Persona & Estratégia Comercial da Imobiliária */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>2. Personalização Comercial & Tom de Voz</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tom de Voz */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tom de Voz dos Corretores:
                  </label>
                  <select
                    value={aiConfigState.tone}
                    onChange={(e) => setAiConfigState(prev => ({ ...prev, tone: e.target.value as AITone }))}
                    className="w-full bg-white text-xs rounded-xl px-3 py-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="CONSULTATIVE">🎯 Consultivo & Especialista (Recomendado para Vendas Consultivas)</option>
                    <option value="CLOSER">⚡ Focado em Fechamento (Direto e focado em marcar visitas)</option>
                    <option value="ELEGANT">💎 Sofisticado & Exclusivo (Ideal para Imóveis de Alto Padrão)</option>
                    <option value="FRIENDLY">🤝 Amigável & Descontraído (Acolhedor e caloroso)</option>
                  </select>
                </div>

                {/* Foco Comercial Principal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Objetivo Principal do Copiloto:
                  </label>
                  <select
                    value={aiConfigState.objective}
                    onChange={(e) => setAiConfigState(prev => ({ ...prev, objective: e.target.value as AIObjective }))}
                    className="w-full bg-white text-xs rounded-xl px-3 py-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="EQUILIBRADO">⚖️ Equilibrado (Responde dúvidas e avança para visita ou simulação)</option>
                    <option value="AGENDAR_VISITA">📅 Prioridade: Agendar Visita Presencial no Decorado</option>
                    <option value="SIMULAR_FINANCIAMENTO">🏦 Prioridade: Coleta de Renda/Entrada para Simulação</option>
                    <option value="QUALIFICAR">🔍 Prioridade: Triagem e Mapeamento Completo dos 4 Pilares</option>
                  </select>
                </div>
              </div>

              {/* Instruções Personalizadas da Imobiliária (Prompt do Corretor) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Diretrizes e Regras Específicas da Imobiliária (Instruções Adicionais):
                </label>
                <textarea
                  rows={4}
                  value={aiConfigState.customInstructions || ''}
                  onChange={(e) => setAiConfigState(prev => ({ ...prev, customInstructions: e.target.value }))}
                  placeholder="Exemplo: Somos especialistas no litoral catarinense (Balneário Camboriú e Itapema). Sempre mencione que facilitamos o parcelamento direto com a construtora em até 100x e aceitamos permuta sob análise. Não dê descontos maiores que 5% sem consulta prévia."
                  className="w-full bg-white text-xs rounded-xl p-3 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Essas regras são injetadas automaticamente no cérebro da IA para todas as conversas deste espaço imobiliário.
                </p>
              </div>
            </div>

            {/* Rodapé de Ação */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Dados de conversas analisados sob estrito sigilo e conformidade LGPD.</span>
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configurações de IA</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Modal de Confirmação para Zerar Base em Settings */}
      {showConfirmResetDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Confirmar Limpeza da Base?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Todos os contatos, conversas e mensagens antigas serão excluídos do cache do CRM. O sistema fará uma nova puxada limpa diretamente da instância oficial do WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetDataModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmResetDataModal(false);
                  setIsResettingData(true);
                  await resetCRMDatabase(true);
                  setIsResettingData(false);
                  setResetDataSuccess(true);
                  setTimeout(() => setResetDataSuccess(false), 4000);
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                Sim, Limpar e Resincronizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
