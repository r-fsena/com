'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { MasterUser, MasterUserRole } from '@/types/crm';
import { 
  ShieldCheck, 
  UserPlus, 
  CheckCircle2, 
  Mail, 
  Phone, 
  Trash2, 
  Edit3, 
  Lock, 
  Crown, 
  Sparkles,
  KeyRound,
  X,
  Send,
  Copy,
  Check,
  RefreshCw,
  UserX,
  AlertCircle
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { id: 'ALL_PERMISSIONS', label: 'Acesso Total (Root SuperAdmin)', desc: 'Controle irrestrito sobre todo o ecossistema SaaS' },
  { id: 'MANAGE_TENANTS', label: 'Gerenciar Imobiliárias / Ambientes', desc: 'Criar, suspender, alterar limites e ativar ambientes' },
  { id: 'IMPERSONATE_CRM', label: 'Acessar CRM das Imobiliárias', desc: 'Entrar no CRM dos clientes em modo de gestão' },
  { id: 'MANAGE_PLANS', label: 'Gerenciar Planos & Preços', desc: 'Criar e editar catálogo comercial de planos SaaS' },
  { id: 'VIEW_FINANCIALS', label: 'Visualizar Faturamento Asaas', desc: 'Ver MRR, extratos de cobrança e inadimplência' },
  { id: 'MANAGE_APIS', label: 'Configurações de APIs & IAs', desc: 'Editar chaves mestras de Z-API, Asaas e LLMs' },
  { id: 'MANAGE_MASTERS', label: 'Gerenciar Admins Masters', desc: 'Convidar e gerenciar operadores do SaaS' },
];

export function SaaSMasterUsers() {
  const { 
    masterUsers, 
    createMasterUser, 
    updateMasterUser, 
    deleteMasterUser, 
    toggleMasterUserStatus, 
    resendMasterUserInvite, 
    currentUser 
  } = useCRM();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MasterUser | null>(null);

  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<MasterUserRole>('SUPERADMIN_GLOBAL');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['MANAGE_TENANTS', 'IMPERSONATE_CRM']);

  const openNewUserModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('SUPPORT_LEAD');
    setSelectedPermissions(['MANAGE_TENANTS', 'IMPERSONATE_CRM', 'VIEW_FINANCIALS']);
    setIsModalOpen(true);
  };

  const openEditModal = (u: MasterUser) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone);
    setRole(u.role);
    setSelectedPermissions(u.permissions || []);
    setIsModalOpen(true);
  };

  const handleResendAccess = async (u: MasterUser) => {
    try {
      setResendingUserId(u.id);
      setErrorMessage(null);
      const res = await resendMasterUserInvite(u.id);
      setFeedbackMessage(`✉️ ${res.message}`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível reenviar o acesso.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setResendingUserId(null);
    }
  };

  const handleCopyAccessLink = (u: MasterUser) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm.faithhubs.com';
    const link = `${baseUrl}?action=master-login&email=${encodeURIComponent(u.email)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedUserId(u.id);
      setFeedbackMessage(`🔗 Link de acesso master copiado para a área de transferência!`);
      setTimeout(() => {
        setCopiedUserId(null);
        setFeedbackMessage(null);
      }, 3000);
    }
  };

  const handleToggleActive = (u: MasterUser) => {
    const willDeactivate = u.isActive !== false;
    const msg = willDeactivate
      ? `Deseja realmente desativar o acesso do Administrador Master "${u.name}"? Ele não poderá operar no painel master até ser reativado.`
      : `Deseja reativar o acesso do Administrador Master "${u.name}"?`;

    if (confirm(msg)) {
      toggleMasterUserStatus(u.id);
      setFeedbackMessage(willDeactivate ? `⚠️ Admin Master ${u.name} desativado com sucesso.` : `✅ Admin Master ${u.name} reativado com sucesso.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const togglePermission = (permId: string) => {
    if (permId === 'ALL_PERMISSIONS') {
      if (selectedPermissions.includes('ALL_PERMISSIONS')) {
        setSelectedPermissions([]);
      } else {
        setSelectedPermissions(['ALL_PERMISSIONS']);
      }
      return;
    }

    setSelectedPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingUser) {
      updateMasterUser(editingUser.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        permissions: selectedPermissions,
      });
      setFeedbackMessage(`Admin Master ${name.trim()} atualizado com sucesso.`);
    } else {
      createMasterUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        permissions: selectedPermissions,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=3742AC&color=ffffff`,
      });
      setFeedbackMessage(`Novo Admin Master ${name.trim()} convidado com sucesso.`);
    }

    setTimeout(() => setFeedbackMessage(null), 4000);
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3742AC]/10 text-[#3742AC] flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Usuários Administradores Masters</h2>
            <span className="text-xs font-bold font-mono bg-indigo-50 text-[#3742AC] border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              {masterUsers.length} administradores
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Controle de acesso à infraestrutura global do SaaS. Conceda privilégios para suporte, operações e superadministradores.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewUserModal}
          className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-indigo-950/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Convidar Admin Master</span>
        </button>
      </div>

      {/* Feedback Alert Banners */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabela de Usuários Masters */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-4 px-6">Administrador Master</th>
                <th className="py-4 px-6">Papel / Nível</th>
                <th className="py-4 px-6">Permissões Habilitadas</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {masterUsers.map(user => {
                const isSuperAdmin = user.role === 'SUPERADMIN_GLOBAL';

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3742AC&color=ffffff`}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#3742AC]/20 shadow-2xs"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-slate-900 text-sm">{user.name}</p>
                            {isSuperAdmin && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <p className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{user.email}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        user.role === 'SUPERADMIN_GLOBAL' ? 'bg-indigo-50 text-[#3742AC] border-indigo-200/80 font-black' :
                        user.role === 'SUPPORT_LEAD' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {user.role === 'SUPERADMIN_GLOBAL' ? '👑 SuperAdmin Global' :
                         user.role === 'SUPPORT_LEAD' ? '🎧 Suporte & Operações' :
                         '💰 Financeiro SaaS'}
                      </span>
                    </td>

                    <td className="py-4 px-6 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {user.permissions?.includes('ALL_PERMISSIONS') ? (
                          <span className="text-[10px] bg-[#3742AC] text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                            ★ Controle Total
                          </span>
                        ) : (
                          user.permissions?.slice(0, 3).map(p => (
                            <span key={p} className="text-[9px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                              {p.replace('MANAGE_', '').replace('VIEW_', '')}
                            </span>
                          ))
                        )}
                        {user.permissions && user.permissions.length > 3 && !user.permissions.includes('ALL_PERMISSIONS') && (
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                            +{user.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {user.isActive !== false ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 w-fit shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 w-fit shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Desativado</span>
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                        {/* Botão de Reenviar Acesso Master */}
                        <button
                          type="button"
                          disabled={resendingUserId === user.id || user.isActive === false}
                          onClick={() => handleResendAccess(user)}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-indigo-50 hover:bg-indigo-100 text-[#3742AC] border-indigo-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-2xs active:scale-95 whitespace-nowrap"
                          title="Reenviar e-mail com instruções e link de acesso"
                        >
                          {resendingUserId === user.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3742AC]" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 text-[#3742AC]" />
                              <span>Acesso</span>
                            </>
                          )}
                        </button>

                        {/* Botão de Copiar Link de Acesso Master */}
                        <button
                          type="button"
                          onClick={() => handleCopyAccessLink(user)}
                          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                            copiedUserId === user.id
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title="Copiar link direto de login master"
                        >
                          {copiedUserId === user.id ? (
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

                        {/* Botão de Desativar / Ativar */}
                        {user.id !== currentUser?.id && user.email?.toLowerCase() !== currentUser?.email?.toLowerCase() && (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(user)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                              user.isActive !== false
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                            title={user.isActive !== false ? 'Desativar acesso deste Admin Master' : 'Reativar acesso'}
                          >
                            {user.isActive !== false ? (
                              <>
                                <UserX className="w-3.5 h-3.5 text-amber-700" />
                                <span>Desativar</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Ativar</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Botão de Editar */}
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Editar permissões"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Botão de Excluir */}
                        {user.id !== currentUser?.id && user.email?.toLowerCase() !== currentUser?.email?.toLowerCase() && user.email?.toLowerCase() !== 'rafael@faithhubs.com' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja realmente remover permanentemente o Admin Master ${user.name}?`)) {
                                deleteMasterUser(user.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remover Admin Master"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal: Convidar / Editar Admin Master */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-2xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-[#3742AC] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingUser ? 'Editar Administrador Master' : 'Convidar Novo Admin Master'}
                  </h3>
                  <p className="text-[11px] text-indigo-200">Defina papel e permissões de acesso ao sistema</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">E-mail Profissional *</label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Papel Global *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MasterUserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                >
                  <option value="SUPERADMIN_GLOBAL">👑 SuperAdmin Global (Acesso Total irrestrito)</option>
                  <option value="SUPPORT_LEAD">🎧 Suporte & Operações (Acesso CRM & Gestão de Ambientes)</option>
                  <option value="FINANCE_LEAD">💰 Financeiro SaaS (Relatórios Asaas & Cobranças)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-2">Permissões Granulares</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_PERMISSIONS.map(perm => {
                    const isChecked = selectedPermissions.includes(perm.id);

                    return (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isChecked ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-50 border-slate-200/80 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{perm.label}</p>
                          <p className="text-[10.5px] text-slate-500">{perm.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                          isChecked ? 'bg-[#3742AC] border-[#3742AC] text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold px-5 py-2 rounded-xl transition shadow-md shadow-indigo-950/10 cursor-pointer"
                >
                  {editingUser ? 'Salvar Alterações' : 'Convidar Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
