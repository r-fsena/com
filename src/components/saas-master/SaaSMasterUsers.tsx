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
  KeyRound
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
  const { masterUsers, createMasterUser, updateMasterUser, deleteMasterUser, currentUser } = useCRM();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MasterUser | null>(null);

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

  const togglePermission = (permId: string) => {
    if (permId === 'ALL_PERMISSIONS') {
      if (selectedPermissions.includes('ALL_PERMISSIONS')) {
        setSelectedPermissions([]);
      } else {
        setSelectedPermissions(AVAILABLE_PERMISSIONS.map(p => p.id));
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
        email: email.trim(),
        phone: phone.trim(),
        role,
        permissions: selectedPermissions,
      });
    } else {
      createMasterUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        permissions: selectedPermissions,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0f172a&color=38bdf8`,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Gestão de Usuários Admins Masters</h2>
            <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
              {masterUsers.length} administradores
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de acesso à plataforma SaaS Master. Defina permissões granulares para suporte, financeiro e superadministradores.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewUserModal}
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          <span>+ Convidar Admin Master</span>
        </button>
      </div>

      {/* Tabela de Usuários Masters */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
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
                          src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                            {isSuperAdmin && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{user.email}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        user.role === 'SUPERADMIN_GLOBAL' ? 'bg-amber-50 text-amber-800 border-amber-300 font-black' :
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
                          <span className="text-[10px] bg-slate-900 text-amber-300 font-bold px-2 py-0.5 rounded-full">
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
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Ativo</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {user.id !== 'master-01' && (
                          <button
                            type="button"
                            onClick={() => deleteMasterUser(user.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remover Acesso Master"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingUser ? 'Editar Administrador Master' : 'Convidar Novo Admin Master'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Atribua permissões e nível de acesso</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Email Corporativo *</label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@faithhubs.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+55 11 99999-8888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Papel / Cargo</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as MasterUserRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer font-semibold"
                  >
                    <option value="SUPERADMIN_GLOBAL">👑 SuperAdmin Global (Acesso Total)</option>
                    <option value="SUPPORT_LEAD">🎧 Suporte & Operações SaaS</option>
                    <option value="FINANCE_ADMIN">💰 Financeiro & Assinaturas SaaS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-2">Matriz de Permissões Granulares:</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map(perm => {
                    const isChecked = selectedPermissions.includes(perm.id) || selectedPermissions.includes('ALL_PERMISSIONS');

                    return (
                      <label key={perm.id} className="flex items-start gap-2.5 p-1.5 hover:bg-white rounded-lg transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5"
                        />
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{perm.label}</p>
                          <p className="text-[10.5px] text-slate-500">{perm.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Salvar Administrador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
