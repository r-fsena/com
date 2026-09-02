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
  Sparkles,
  Bot,
  Zap,
  QrCode,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Crown,
  UserPlus,
  Radio
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenZapiSimulator: () => void;
  onOpenQrCodeModal?: () => void;
  onGoToMasterPortal?: () => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  setCurrentTab,
  onOpenZapiSimulator,
  onOpenQrCodeModal,
  onGoToMasterPortal,
  isOpenOnMobile = false,
  onCloseMobile
}: SidebarProps) {
  const { 
    currentTenant, 
    currentUser, 
    conversations, 
    instances, 
    alerts, 
    tasks, 
    isFeatureEnabled,
    logout 
  } = useCRM();

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vanguard_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // Ignora erro no SSR
    }
  }, []);

  const toggleCollapsed = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    try {
      localStorage.setItem('vanguard_sidebar_collapsed', String(nextState));
    } catch {
      // Ignora erro
    }
  };

  const totalUnreadMessages = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingTasksCount = tasks.filter(t => !t.isCompleted).length;
  const criticalAlertsCount = alerts.filter(a => !a.isDismissed && a.severity === 'CRITICAL').length;
  const isZapiConnected = instances.some(i => i.status === 'CONNECTED');

  // 1. Visão Geral Sovereign
  const overviewItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Vendas',
      icon: BarChart3,
      badge: null,
      enabled: true,
    },
  ];

  // 2. Grupo WhatsApp Sovereign
  const whatsappNavItems = [
    {
      id: 'inbox',
      label: 'Inbox WhatsApp',
      icon: MessageSquare,
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : null,
      badgeColor: 'bg-emerald-600 text-white',
      enabled: true,
    },
    {
      id: 'whatsapp-import',
      label: 'Importação de Contatos',
      icon: UserPlus,
      badge: null,
      enabled: true,
    },
    {
      id: 'whatsapp-connection',
      label: 'Conexão & API',
      icon: Radio,
      badge: isZapiConnected ? 'Ao Vivo' : 'Offline',
      badgeColor: isZapiConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200',
      enabled: true,
    },
  ];

  // 3. Módulos Comerciais & Gestão
  const crmNavItems = [
    {
      id: 'kanban',
      label: 'Funil & Negócios',
      icon: Kanban,
      badge: null,
      enabled: isFeatureEnabled('kanbanDeals'),
    },
    {
      id: 'proposals',
      label: 'Propostas Comerciais',
      icon: FileText,
      badge: null,
      enabled: true,
    },
    {
      id: 'financial',
      label: 'Financeiro & Asaas',
      icon: DollarSign,
      badge: null,
      enabled: isFeatureEnabled('asaasBilling'),
    },
    {
      id: 'tasks',
      label: 'Tarefas & SLAs',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-amber-500 text-white',
      enabled: true,
    },
    {
      id: 'contacts',
      label: 'Leads & Clientes',
      icon: Users,
      badge: null,
      enabled: true,
    },
    {
      id: 'campaigns',
      label: 'Campanhas em Lote',
      icon: Send,
      badge: null,
      enabled: true,
    },
    {
      id: 'automations',
      label: 'Automações & Regras',
      icon: Zap,
      badge: null,
      enabled: true,
    },
    {
      id: 'copilot',
      label: 'IA Copiloto',
      icon: Bot,
      badge: 'IA',
      badgeColor: 'bg-[#3742AC] text-white',
      enabled: isFeatureEnabled('aiCopilot'),
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      badge: criticalAlertsCount > 0 ? criticalAlertsCount : null,
      badgeColor: 'bg-rose-500 text-white',
      enabled: true,
    },
  ].filter(item => item.enabled);

  const renderNavButton = (item: any) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          setCurrentTab(item.id);
          onCloseMobile?.();
        }}
        className={`w-full flex items-center ${
          isCollapsed ? 'justify-center px-0' : 'justify-between px-3.5'
        } py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 group relative cursor-pointer ${
          isActive
            ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
        title={isCollapsed ? item.label : undefined}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <Icon className={`w-4 h-4 transition flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </div>

        {/* Badge Expandido */}
        {!isCollapsed && item.badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
            {item.badge}
          </span>
        )}

        {/* Dot Badge quando Recolhido */}
        {isCollapsed && item.badge && (
          <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#3742AC] ring-2 ring-white"></span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop Overlay no Mobile */}
      {isOpenOnMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-40 md:hidden animate-fadeIn"
          onClick={onCloseMobile}
        />
      )}

      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white text-slate-700 flex flex-col flex-shrink-0 border-r border-slate-200/80 select-none transition-all duration-200 ease-in-out fixed md:static inset-y-0 left-0 z-50 md:z-auto ${
          isOpenOnMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header com Tenant e Botão de Recolher/Expandir */}
        <div className="p-4 border-b border-slate-100">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 w-full">
              {/* Logo Centralizado no modo reduzido Sovereign */}
              <div 
                className="w-10 h-10 rounded-2xl bg-[#3742AC] flex items-center justify-center text-white shadow-md shadow-indigo-900/20"
                title={`${currentTenant.name} (Sovereign CRM)`}
              >
                <Building2 className="w-5 h-5" />
              </div>

              {/* Botão de Expandir */}
              <button
                onClick={toggleCollapsed}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition cursor-pointer shadow-2xs"
                title="Expandir menu lateral"
              >
                <PanelLeftOpen className="w-4 h-4 text-[#3742AC]" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2">
                {/* Logo & Marca da Imobiliária Ativa Sovereign */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-[#3742AC] flex items-center justify-center text-white shadow-md shadow-indigo-900/20 flex-shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3742AC] truncate">
                        Sovereign CRM
                      </span>
                    </div>
                    <h2 className="text-xs font-bold text-slate-900 tracking-tight truncate" title={currentTenant.name}>
                      {currentTenant.name}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Botão de Recolher no Desktop */}
                  <button
                    onClick={toggleCollapsed}
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer flex-shrink-0 hidden md:block"
                    title="Reduzir menu lateral"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>

                  {/* Botão Fechar no Mobile Drawer */}
                  {onCloseMobile && (
                    <button
                      onClick={onCloseMobile}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer flex-shrink-0 md:hidden"
                      title="Fechar menu lateral"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        
        {/* Seção 1: Visão Geral */}
        <div className="space-y-1">
          {overviewItems.map(renderNavButton)}
        </div>

        {/* Seção 2: Grupo WhatsApp Sovereign */}
        <div className="space-y-1 pt-1">
          {!isCollapsed && (
            <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3742AC] flex items-center justify-between">
              <span>WhatsApp</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isZapiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            </div>
          )}
          {whatsappNavItems.map(renderNavButton)}
        </div>

        {/* Seção 3: Módulos de Gestão & CRM */}
        <div className="space-y-1 pt-1">
          {!isCollapsed && (
            <div className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Módulos Comerciais
            </div>
          )}
          {crmNavItems.map(renderNavButton)}
        </div>
      </nav>

      {/* Rodapé da Sidebar: Z-API Widget Mini + Perfil */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              onClick={onOpenQrCodeModal}
              className="p-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-900 transition cursor-pointer relative shadow-2xs"
              title={`Z-API Gateway (${isZapiConnected ? 'Online / Conectado' : 'Offline / Clique para vincular'})`}
            >
              <QrCode className="w-4 h-4 text-[#3742AC]" />
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${isZapiConnected ? 'bg-emerald-500 ring-2 ring-white' : 'bg-rose-500'}`} />
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  {isZapiConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isZapiConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <span className="text-[11px] font-bold text-slate-800 truncate">
                  Z-API {isZapiConnected ? 'Online' : 'Offline'}
                </span>
              </div>

              {onOpenQrCodeModal && (
                <button
                  onClick={onOpenQrCodeModal}
                  className={`text-[10px] font-bold px-2 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 border ${
                    isZapiConnected 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
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

        {/* Perfil do Usuário */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <img
              src={currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name)}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-200"
              title={`${currentUser.name} (${currentUser.role})`}
            />
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser.name}
                </p>
                <p className="text-[10px] font-semibold text-[#3742AC] truncate">
                  {currentUser.role}
                </p>
              </div>

              <button
                onClick={() => logout()}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                title="Sair da Conta (Logoff)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      </aside>
    </>
  );
}
