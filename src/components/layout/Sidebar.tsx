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
  Building2, 
  Wifi, 
  Zap, 
  QrCode, 
  PanelLeftClose, 
  PanelLeftOpen, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  FileText, 
  Crown, 
  UserPlus, 
  Radio, 
  Target
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
    tasks, 
    isFeatureEnabled
  } = useCRM();

  // O menu lateral inicia sempre recuado/fechado por padrão para um visual ultra clean
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    label: string;
    badge?: string | number | null;
    top: number;
  } | null>(null);

  const toggleCollapsed = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (nextState) {
      setHoveredTooltip(null);
    }
  };

  const totalUnreadMessages = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingTasksCount = tasks.filter(t => !t.isCompleted).length;
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
    {
      id: 'goals',
      label: 'Metas & Performance',
      icon: Target,
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
      enabled: isFeatureEnabled('proposals'),
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
      enabled: isFeatureEnabled('campaigns'),
    },
    {
      id: 'automations',
      label: 'Automações & Regras',
      icon: Zap,
      badge: null,
      enabled: isFeatureEnabled('automations'),
    },
  ].filter(item => item.enabled);

  const renderNavButton = (item: any) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          setHoveredTooltip(null);
          setCurrentTab(item.id);
          onCloseMobile?.();
        }}
        onMouseEnter={(e) => {
          if (isCollapsed) {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoveredTooltip({
              label: item.label,
              badge: item.badge,
              top: rect.top + rect.height / 2,
            });
          }
        }}
        onMouseLeave={() => setHoveredTooltip(null)}
        className={`w-full flex items-center ${
          isCollapsed ? 'justify-center px-0' : 'justify-between px-3.5'
        } py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 group relative cursor-pointer ${
          isActive
            ? 'bg-[#3742AC] text-white shadow-md shadow-indigo-950/10'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
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
        onMouseLeave={() => setHoveredTooltip(null)}
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white text-slate-700 flex flex-col flex-shrink-0 border-r border-slate-200/80 select-none transition-all duration-200 ease-in-out fixed md:static inset-y-0 left-0 z-50 md:z-auto ${
          isOpenOnMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header com Tenant e Logo Brokiva */}
        <div className="p-4 border-b border-slate-100">
          {isCollapsed ? (
            <div className="flex justify-center">
              {/* Logo Centralizado no modo reduzido Brokiva */}
              <div 
                className="w-10 h-10 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center p-1.5 shadow-2xs overflow-hidden cursor-default"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    label: `${currentTenant.name} • Brokiva CRM`,
                    top: rect.top + rect.height / 2,
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
              >
                <img 
                  src="/brand/brokiva-icon.png" 
                  alt="Brokiva" 
                  className="w-full h-full object-contain" 
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Linha do Topo: Logo Brokiva em Destaque + Botão de Recolher */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 flex items-center min-w-0">
                  <img 
                    src="/brand/brokiva-logo-dark.png" 
                    alt="Brokiva — Relacionamentos que viram negócios" 
                    className="h-11 w-auto object-contain max-w-[180px] drop-shadow-2xs" 
                  />
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

              {/* Tenant / Imobiliária Ativa com Indicador de Sessão */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-150 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[11px] font-bold text-slate-700 truncate" title={currentTenant.name}>
                  {currentTenant.name}
                </span>
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

      {/* Rodapé da Sidebar: Z-API Widget + Botão Expandir/Recolher */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            {/* 1. Ícone de Integração do WhatsApp (Z-API Gateway) */}
            <button
              onClick={() => {
                setHoveredTooltip(null);
                onOpenQrCodeModal?.();
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  label: `Z-API Gateway (${isZapiConnected ? 'Online / Conectado' : 'Offline / Clique para vincular'})`,
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
              className="p-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-900 transition cursor-pointer relative shadow-2xs"
            >
              <QrCode className="w-4 h-4 text-[#3742AC]" />
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${isZapiConnected ? 'bg-emerald-500 ring-2 ring-white' : 'bg-rose-500'}`} />
            </button>

            {/* 2. Ícone para Abrir / Expandir a Sidebar (Abaixo do ícone do WhatsApp) */}
            <button
              onClick={() => {
                setHoveredTooltip(null);
                toggleCollapsed();
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTooltip({
                  label: 'Expandir menu lateral',
                  top: rect.top + rect.height / 2,
                });
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
              className="p-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-500 hover:text-slate-900 transition cursor-pointer shadow-2xs"
            >
              <PanelLeftOpen className="w-4 h-4 text-[#3742AC]" />
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

            {/* Botão de Recolher no Rodapé (Desktop) */}
            <button
              onClick={toggleCollapsed}
              className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-transparent hover:border-slate-200/60"
              title="Recolher menu lateral"
            >
              <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
              <span>Recolher menu</span>
            </button>
          </div>
        )}
      </div>

      </aside>

      {/* Legenda Flutuante (Tooltip) quando o Menu Lateral estiver Recuado */}
      {isCollapsed && hoveredTooltip && (
        <div 
          className="fixed left-[84px] -translate-y-1/2 z-[9999] pointer-events-none hidden md:flex items-center drop-shadow-md animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${hoveredTooltip.top}px` }}
        >
          {/* Indicador Triangular */}
          <div className="w-2 h-2 bg-slate-900 rotate-45 -mr-1 border-l border-b border-slate-700/60 shrink-0" />
          <div className="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-2 border border-slate-700/60 shadow-xl shadow-slate-950/20 backdrop-blur-md">
            <span>{hoveredTooltip.label}</span>
            {hoveredTooltip.badge && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#3742AC] text-white">
                {hoveredTooltip.badge}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
