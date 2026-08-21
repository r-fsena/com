'use client';

import React from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  MessageSquare, 
  Kanban, 
  Users, 
  CheckSquare, 
  Send, 
  BarChart3, 
  Settings, 
  Building2, 
  Wifi, 
  ChevronDown,
  Sparkles,
  Bot,
  Zap,
  QrCode,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenZapiSimulator: () => void;
  onOpenQrCodeModal?: () => void;
}

export function Sidebar({ currentTab, setCurrentTab, onOpenZapiSimulator, onOpenQrCodeModal }: SidebarProps) {
  const { 
    currentTenant, 
    tenants, 
    setCurrentTenant, 
    currentUser, 
    users, 
    setCurrentUser,
    conversations,
    tasks,
    alerts,
    instances,
    logout
  } = useCRM();

  const totalUnreadMessages = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingTasksCount = tasks.filter(t => !t.isCompleted).length;
  const criticalAlertsCount = alerts.filter(a => !a.isDismissed && a.severity === 'CRITICAL').length;
  const isZapiConnected = instances.some(i => i.status === 'CONNECTED');

  const navItems = [
    {
      id: 'inbox',
      label: 'Inbox WhatsApp',
      icon: MessageSquare,
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : null,
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      id: 'kanban',
      label: 'Funil & Negócios',
      icon: Kanban,
      badge: null,
    },
    {
      id: 'contacts',
      label: 'Leads & Clientes',
      icon: Users,
      badge: null,
    },
    {
      id: 'tasks',
      label: 'Tarefas & SLAs',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'automations',
      label: 'Automações & Regras',
      icon: Zap,
      badge: null,
    },
    {
      id: 'campaigns',
      label: 'Campanhas em Lote',
      icon: Send,
      badge: null,
    },
    {
      id: 'dashboard',
      label: 'Dashboard & Vendas',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Configurações & Z-API',
      icon: Settings,
      badge: criticalAlertsCount > 0 ? criticalAlertsCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* Tenant Selector Header */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                SaaS Multi-tenant
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight truncate max-w-[130px]">
                {currentTenant.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Tenant Switcher Pill */}
        <div className="relative mt-2">
          <select
            value={currentTenant.id}
            onChange={(e) => {
              const selected = tenants.find(t => t.id === e.target.value);
              if (selected) setCurrentTenant(selected);
            }}
            className="w-full text-xs font-medium bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none appearance-none cursor-pointer hover:bg-slate-800 transition"
          >
            {tenants.map(t => (
              <option key={t.id} value={t.id}>
                🏢 {t.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Módulos Comerciais
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Z-API Live Testing Trigger Box */}
        <div className="pt-4 px-1">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/60 rounded-xl p-3 shadow-inner">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {isZapiConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isZapiConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <span className="text-[11px] font-semibold text-slate-200">Z-API Gateway</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                {isZapiConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="space-y-1.5">
              {onOpenQrCodeModal && (
                <button
                  onClick={onOpenQrCodeModal}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Vincular WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* User Switcher / Profile Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2.5">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <img
            src={currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name)}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
            <span className="inline-block text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/40">
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* User Role Testing Switcher */}
        <div className="px-0.5">
          <select
            value={currentUser.id}
            onChange={(e) => {
              const u = users.find(x => x.id === e.target.value);
              if (u) setCurrentUser(u);
            }}
            className="w-full text-[11px] bg-slate-900 text-slate-300 border border-slate-700/80 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer hover:text-white transition"
            title="Alternar usuário logado"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                👤 {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Botão de Logoff Destacado */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-800/50 rounded-xl py-2 text-xs font-bold transition shadow-xs active:scale-98"
          title="Encerrar sessão e voltar para a tela de login"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Sair da Conta (Logoff)</span>
        </button>
      </div>
    </aside>
  );
}
