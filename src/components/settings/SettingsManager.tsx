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
  X
} from 'lucide-react';
import { UserRole } from '@/types/crm';

interface SettingsManagerProps {
  onOpenQrCodeModal?: () => void;
}

export function SettingsManager({ onOpenQrCodeModal }: SettingsManagerProps) {
  const { currentTenant, updateTenant, instances, syncZapiInstance, users, updateUser, createUser, deleteUser } = useCRM();
  
  // 4 Submenus solicitados: Empresa, Usuários, Permissões, SLAs (+ Z-API)
  const [activeTab, setActiveTab] = useState<'TENANT' | 'USERS' | 'PERMISSIONS' | 'SLA' | 'ZAPI'>('TENANT');

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

  // Estados de Modal de Novo Usuário
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('BROKER');

  // Estados Z-API
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testPhone, setTestPhone] = useState('+55 11 99123-4567');
  const [testSent, setTestSent] = useState(false);

  const webhookUrl = `https://crm.faithhubs.com/api/v1/webhooks/zapi/${currentTenant.id}/${instances[0]?.zapiInstanceId || 'instance-01'}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
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
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    createUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      phone: newUserPhone.trim() || '+55 11 99999-0000',
      role: newUserRole,
      isActive: true,
    });

    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setIsNewUserModalOpen(false);
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
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
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
      <div className="bg-white border-b border-slate-200 px-6 flex gap-2 sm:gap-6 text-xs font-semibold text-slate-500 overflow-x-auto no-scrollbar">
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
      </div>

      {/* Conteúdo dos Submenus */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-6">

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
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Gestão de Usuários & Corretores da Equipe ({users.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adicione, edite cargos e gerencie o acesso de cada corretor e gestor do CRM.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Convidar Novo Usuário</span>
              </button>
            </div>

            {/* Tabela de Usuários */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Usuário / Corretor</th>
                    <th className="py-3 px-4">Cargo / Perfil</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=059669&color=fff`}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === 'SUPERADMIN' || u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{u.phone}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ● Ativo
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="MANAGER">Gestor</option>
                            <option value="BROKER">Corretor</option>
                            <option value="VIEWER">Visualizador</option>
                          </select>
                          {users.length > 1 && u.id !== 'user-rafael-admin' && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal de Cadastro de Novo Usuário */}
            {isNewUserModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <span>Convidar / Cadastrar Novo Corretor</span>
                    </h3>
                    <button onClick={() => setIsNewUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateNewUser} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        placeholder="Ex: Lucas Brandão"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">E-mail Comercial *</label>
                      <input
                        type="email"
                        placeholder="corretor@vanguardprime.com.br"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp / Telefone</label>
                      <input
                        type="text"
                        placeholder="+55 11 99999-8888"
                        value={newUserPhone}
                        onChange={(e) => setNewUserPhone(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Cargo / Papel no CRM</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none"
                      >
                        <option value="BROKER">Corretor (Acessa seus leads e atende no WhatsApp)</option>
                        <option value="MANAGER">Gestor Comercial (Acessa toda a equipe e funis)</option>
                        <option value="ADMIN">Administrador (Controle total do sistema)</option>
                        <option value="VIEWER">Visualizador (Apenas leitura)</option>
                      </select>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsNewUserModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs"
                      >
                        Salvar e Convidar
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
          </div>
        )}

      </div>
    </div>
  );
}
