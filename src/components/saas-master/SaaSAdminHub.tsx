'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Tenant } from '@/types/crm';
import { SaaSDashboard } from './SaaSDashboard';
import { SaaSNewTenantPage } from './SaaSNewTenantPage';
import { SaaSProductionTenants } from './SaaSProductionTenants';
import { SaaSPlansManager } from './SaaSPlansManager';
import { SaaSMasterUsers } from './SaaSMasterUsers';
import { SaaSApiSettings } from './SaaSApiSettings';
import { 
  BarChart3, 
  Building2, 
  Tag, 
  ShieldCheck, 
  Key, 
  Crown, 
  LogOut, 
  PlusCircle, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

interface SaaSAdminHubProps {
  onEnterTenant: (tenant: Tenant) => void;
}

export function SaaSAdminHub({ onEnterTenant }: SaaSAdminHubProps) {
  const { currentUser, logout, tenants } = useCRM();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-tenant' | 'tenants' | 'plans' | 'master-users' | 'apis'>('dashboard');

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Estratégico',
      icon: BarChart3,
      badge: 'MRR',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    },
    {
      id: 'new-tenant',
      label: 'Proposta Comercial',
      icon: FileText,
      badge: 'Nova',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    },
    {
      id: 'tenants',
      label: 'Ambientes Produtivos',
      icon: Building2,
      badge: String(tenants.length),
      badgeColor: 'bg-slate-800 text-slate-300 border border-slate-700'
    },
    {
      id: 'plans',
      label: 'Configuração de Planos',
      icon: Tag,
      badge: null,
    },
    {
      id: 'master-users',
      label: 'Usuários Admins Masters',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'apis',
      label: 'Configurações de APIs',
      icon: Key,
      badge: 'Z-API / Asaas',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased select-none">
      {/* Sidebar Dedicada do Portal SaaS Master */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col flex-shrink-0 justify-between relative z-10">
        <div>
          {/* Header da Sidebar */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <Crown className="w-5 h-5 text-slate-950 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white tracking-tight">FaithHubs Master</h1>
                <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  SaaS Hub
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400">Portal do Dono do CRM</p>
            </div>
          </div>

          {/* Menus de Navegação */}
          <div className="p-3 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 py-2">
              Menu Executivo & Gestão
            </p>

            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition cursor-pointer group ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rodapé da Sidebar: Perfil Master & Logoff */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser?.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/50"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Rafael Sena'}</p>
              <span className="inline-block text-[9px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/40">
                👑 SuperAdmin Global
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 border border-rose-800/40 rounded-xl py-2 text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Portal</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal do SaaS Master */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
        {activeTab === 'dashboard' && <SaaSDashboard onNavigateToTab={(t) => setActiveTab(t as any)} />}
        {activeTab === 'new-tenant' && <SaaSNewTenantPage onSuccess={() => setActiveTab('tenants')} />}
        {activeTab === 'tenants' && (
          <SaaSProductionTenants 
            onEnterTenant={onEnterTenant} 
            onNavigateToNewTenant={() => setActiveTab('new-tenant')} 
          />
        )}
        {activeTab === 'plans' && <SaaSPlansManager />}
        {activeTab === 'master-users' && <SaaSMasterUsers />}
        {activeTab === 'apis' && <SaaSApiSettings />}
      </main>
    </div>
  );
}
