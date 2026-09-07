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
  FileText,
  Menu,
  X,
  Layers
} from 'lucide-react';

interface SaaSAdminHubProps {
  onEnterTenant: (tenant: Tenant) => void;
}

export function SaaSAdminHub({ onEnterTenant }: SaaSAdminHubProps) {
  const { currentUser, logout, tenants, currentTenant } = useCRM();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'new-tenant' | 'tenants' | 'plans' | 'master-users' | 'apis'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('brokiva_master_active_tab') || localStorage.getItem('faithhubs_master_active_tab');
        if (saved && ['dashboard', 'new-tenant', 'tenants', 'plans', 'master-users', 'apis'].includes(saved)) {
          return saved as any;
        }
      } catch {}
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: 'dashboard' | 'new-tenant' | 'tenants' | 'plans' | 'master-users' | 'apis') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('brokiva_master_active_tab', tab);
    } catch {}
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Estratégico',
      icon: BarChart3,
      badge: 'MRR',
      badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    },
    {
      id: 'new-tenant',
      label: 'Proposta & Provisionar',
      icon: FileText,
      badge: 'Novo',
      badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    },
    {
      id: 'tenants',
      label: 'Ambientes Produtivos',
      icon: Building2,
      badge: String(tenants.length),
      badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200'
    },
    {
      id: 'plans',
      label: 'Catálogo de Planos',
      icon: Tag,
      badge: null,
    },
    {
      id: 'master-users',
      label: 'Admins Masters',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'apis',
      label: 'Configurações de APIs',
      icon: Key,
      badge: 'Z-API',
      badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200'
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F3FA] text-slate-800 antialiased select-none flex-col md:flex-row relative">
      {/* Topbar no Mobile */}
      <div className="md:hidden h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 z-20 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            title="Menu do Portal Master"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img 
              src="/brand/brokiva-icon.png" 
              alt="Brokiva" 
              className="w-7 h-7 object-contain" 
            />
            <span className="text-xs font-black text-slate-900">Brokiva Master</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentTenant && (
            <button
              type="button"
              onClick={() => onEnterTenant(currentTenant)}
              className="text-[11px] font-bold bg-[#3742AC] hover:bg-[#2D368E] text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition"
              title={`Voltar ao CRM de ${currentTenant.name}`}
            >
              <span>↩ CRM</span>
            </button>
          )}
          <span className="text-[10px] font-mono font-bold bg-[#3742AC]/10 text-[#3742AC] px-2.5 py-0.5 rounded-full border border-[#3742AC]/20">
            SaaS
          </span>
        </div>
      </div>

      {/* Backdrop no Mobile */}
      {isMobileNavOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-40 md:hidden animate-fadeIn"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Dedicada do Portal SaaS Master */}
      <aside className={`w-64 bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 justify-between fixed md:static inset-y-0 left-0 z-50 md:z-10 transition-transform duration-200 ease-in-out ${
        isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex-1 overflow-y-auto">
          {/* Header da Sidebar */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 flex items-center min-w-0">
                <img 
                  src="/brand/brokiva-logo-dark.png" 
                  alt="Brokiva — Relacionamentos que viram negócios" 
                  className="h-14 sm:h-16 w-auto object-contain object-left max-w-[215px] drop-shadow-2xs" 
                />
              </div>

              {/* Fechar no Mobile */}
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="Fechar menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tenant Master Badge */}
            <div className="mt-3 flex items-center justify-between px-3 py-1.5 bg-indigo-50/70 border border-indigo-100/90 rounded-xl">
              <div className="flex items-center gap-1.5 min-w-0">
                <Crown className="w-3.5 h-3.5 text-[#3742AC] shrink-0" />
                <span className="text-[11px] font-extrabold text-[#3742AC] truncate">
                  Portal Master Global
                </span>
              </div>
              <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded bg-white text-[#3742AC] border border-indigo-200/60 shadow-2xs">
                SaaS
              </span>
            </div>

            {/* Atalho Rápido para Voltar ao CRM da Imobiliária Ativa */}
            {currentTenant && (
              <button
                type="button"
                onClick={() => {
                  onEnterTenant(currentTenant);
                  setIsMobileNavOpen(false);
                }}
                className="mt-2.5 w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/90 to-blue-50/70 hover:from-indigo-100 hover:to-blue-100/90 border border-indigo-200/80 text-[#3742AC] rounded-xl text-xs font-bold transition cursor-pointer group shadow-2xs"
                title={`Ir para o CRM de ${currentTenant.name}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs group-hover:-translate-x-0.5 transition-transform">↩</span>
                  <span className="truncate text-[11px]">Voltar ao CRM</span>
                </div>
                <span className="text-[10px] font-mono font-extrabold max-w-[85px] truncate bg-white text-[#3742AC] px-1.5 py-0.5 rounded border border-indigo-200/60 shadow-2xs">
                  {currentTenant.name.split(' ')[0]}
                </span>
              </button>
            )}
          </div>

          {/* Menus de Navegação */}
          <div className="p-3 space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 py-2">
              Gestão da Plataforma
            </p>

            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition duration-150 cursor-pointer group ${
                    isActive 
                      ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 whitespace-nowrap ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-600'
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser?.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#3742AC]/30 shadow-2xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.name || 'Rafael Sena'}</p>
              <span className="inline-block text-[10px] font-extrabold text-[#3742AC] bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 rounded-md">
                👑 SuperAdmin
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 rounded-xl py-2 text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Sair do Portal</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal do SaaS Master */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F0F3FA]">
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
