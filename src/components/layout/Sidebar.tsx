'use client';

import React, { useState, useEffect } from 'react';
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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight
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

  // Estado do Menu Retrátil (Expandido / Recolhido)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vanguard_crm_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('vanguard_crm_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const totalUnreadMessages = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingTasksCount = tasks.filter(t => !t.isCompleted).length;
  const criticalAlertsCount = alerts.filter(a => !a.isDismissed && a.severity === 'CRITICAL').length;
  const isZapiConnected = instances.some(i => i.status === 'CONNECTED');

  // Ordem comercial solicitada:
  // 1. Dashboard e Vendas
  // 2. Inbox WhatsApp
  // 3. Funil e Negócios
  // 4. Tarefas e SLAs
  // 5. Leads e Clientes
  // 6. Campanhas em Lotes
  // 7. Automações e Regras
  // 8. Configurações e Z-API
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Vendas',
      icon: BarChart3,
      badge: null,
    },
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
      id: 'tasks',
      label: 'Tarefas & SLAs',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'contacts',
      label: 'Leads & Clientes',
      icon: Users,
      badge: null,
    },
    {
      id: 'campaigns',
      label: 'Campanhas em Lote',
      icon: Send,
      badge: null,
    },
    {
      id: 'automations',
      label: 'Automações & Regras',
      icon: Zap,
      badge: null,
    },
    {
      id: 'copilot',
      label: 'IA Copiloto',
      icon: Bot,
      badge: 'IA',
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      badge: criticalAlertsCount > 0 ? criticalAlertsCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
  ];

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-slate-950 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 select-none transition-all duration-200 ease-in-out relative`}
    >
      {/* Header com Tenant e Botão de Recolher/Expandir */}
      <div className="p-3 border-b border-slate-800/80">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Logo Centralizado no modo reduzido */}
            <div 
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30"
              title={`${currentTenant.name} (SaaS Multi-tenant)`}
            >
              <Building2 className="w-5 h-5" />
            </div>

            {/* Botão de Expandir Centralizado e Separado */}
            <button
              onClick={toggleCollapsed}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition cursor-pointer shadow-2xs"
              title="Expandir menu lateral"
            >
              <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              {/* Logo & Marca */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate">
                    SaaS Multi-tenant
                  </div>
                  <h2 className="text-xs font-bold text-white tracking-tight truncate">
                    {currentTenant.name}
                  </h2>
                </div>
              </div>

              {/* Botão de Recolher */}
              <button
                onClick={toggleCollapsed}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer flex-shrink-0"
                title="Reduzir menu lateral (apenas ícones)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Tenant Switcher */}
            <div className="relative mt-2.5">
              <select
                value={currentTenant.id}
                onChange={(e) => {
                  const selected = tenants.find(t => t.id === e.target.value);
                  if (selected) setCurrentTenant(selected);
                }}
                className="w-full text-xs font-medium bg-slate-900 text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none appearance-none cursor-pointer hover:bg-slate-850 transition"
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
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Módulos Comerciais
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
              } py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group relative cursor-pointer ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon className={`w-4 h-4 transition flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {/* Badge Expandido */}
              {!isCollapsed && item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}

              {/* Dot Badge quando Recolhido */}
              {isCollapsed && item.badge && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar: Z-API Widget Mini + Usuário Logado */}
      <div className="p-2.5 border-t border-slate-800/80 bg-slate-950 space-y-2">
        {/* ---------------------------------------------------- */}
        {/* MINI WIDGET Z-API: REDUZIDO E LOGO ACIMA DO USUÁRIO */}
        {/* ---------------------------------------------------- */}
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              onClick={onOpenQrCodeModal}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer relative"
              title={`Z-API Gateway (${isZapiConnected ? 'Online / Conectado' : 'Offline / Clique para vincular'})`}
            >
              <QrCode className="w-4 h-4" />
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${isZapiConnected ? 'bg-emerald-500 ring-2 ring-slate-950' : 'bg-rose-500'}`} />
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  {isZapiConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isZapiConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <span className="text-[11px] font-semibold text-slate-200 truncate">
                  Z-API {isZapiConnected ? 'Online' : 'Offline'}
                </span>
              </div>

              {onOpenQrCodeModal && (
                <button
                  onClick={onOpenQrCodeModal}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                    isZapiConnected 
                      ? 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800/60'
                      : 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border-amber-800/60'
                  }`}
                  title="Gerenciar conexão do WhatsApp via Z-API"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{isZapiConnected ? 'Conectado' : 'Conectar'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* PERFIL DO USUÁRIO LOGADO                             */}
        {/* ---------------------------------------------------- */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <img
              src={currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name)}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/50"
              title={`${currentUser.name} (${currentUser.role})`}
            />
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
              title="Sair da Conta (Logoff)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2.5 px-1">
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

            {/* Alternador Rápido de Usuário para Testes */}
            <div className="px-0.5">
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const u = users.find(x => x.id === e.target.value);
                  if (u) setCurrentUser(u);
                }}
                className="w-full text-[10.5px] bg-slate-900 text-slate-300 border border-slate-800 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer hover:text-white transition"
                title="Alternar usuário logado"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Logoff */}
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-1.5 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 border border-rose-800/40 rounded-xl py-1.5 text-xs font-bold transition shadow-xs active:scale-98 cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sair da Conta (Logoff)</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
