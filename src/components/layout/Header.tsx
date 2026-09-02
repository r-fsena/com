'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Search, 
  Plus, 
  Bell, 
  Bot, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Menu,
  Sparkles,
  Calendar,
  RefreshCw
} from 'lucide-react';

interface HeaderProps {
  currentTab?: string;
  onOpenNewLead: () => void;
  onOpenZapiSimulator: () => void;
  onOpenAuthModal?: () => void;
  onSelectContact?: (contactId: string) => void;
  onToggleMobileSidebar?: () => void;
}

export function Header({ currentTab, onOpenNewLead, onOpenZapiSimulator, onOpenAuthModal, onSelectContact, onToggleMobileSidebar }: HeaderProps) {
  const { alerts, dismissAlert, contacts, currentUser, setActiveConversationId, conversations, currentTenant, activeSyncJob, dismissSyncJob } = useCRM();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAlertsPopover, setShowAlertsPopover] = useState(false);

  const activeAlerts = alerts.filter(a => !a.isDismissed);

  // Search Results
  const filteredContacts = searchQuery.trim() ? contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  const handleSelectSearchResult = (contactId: string) => {
    const conv = conversations.find(c => c.contactId === contactId);
    if (conv) {
      setActiveConversationId(conv.id);
    }
    if (onSelectContact) onSelectContact(contactId);
    setSearchQuery('');
  };

  const currentDateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="h-20 bg-[#F0F3FA] px-6 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 min-w-0">
      
      {/* Lado Esquerdo: Saudação Sovereign & Data */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 bg-white rounded-2xl border border-slate-200/80 shadow-2xs transition cursor-pointer shrink-0"
            title="Abrir Menu Lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              Welcome, {currentUser?.name?.split(' ')[0] || 'Corretor'}!
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold bg-white text-[#3742AC] border border-indigo-100 px-2.5 py-0.5 rounded-full shadow-2xs">
              <Sparkles className="w-3 h-3 text-[#3742AC]" />
              <span>{currentTenant.name}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 capitalize hidden sm:block">
            {currentDateFormatted} • Ambiente Comercial Produtivo
          </p>
        </div>
      </div>

      {/* Lado Direito: Busca Arredondada Sovereign + Ações */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        
        {/* Indicador de Sincronização em Segundo Plano do WhatsApp */}
        {activeSyncJob && (activeSyncJob.status === 'RUNNING' || activeSyncJob.status === 'PENDING') && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs animate-in fade-in">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
            <span className="hidden sm:inline">Sincronizando:</span>
            <span className="font-mono text-emerald-950 font-extrabold">{activeSyncJob.contactsImported}</span>
            <span className="text-[11px] text-emerald-600 font-medium hidden lg:inline">(Pág. {activeSyncJob.pagesScanned || 1})</span>
          </div>
        )}

        {activeSyncJob && activeSyncJob.status === 'COMPLETED' && (
          <div className="flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{activeSyncJob.contactsImported} conversas sincronizadas!</span>
            <button
              type="button"
              onClick={dismissSyncJob}
              className="p-0.5 hover:bg-emerald-700 rounded-full transition ml-1 cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Barra de Busca em Pílula Sovereign */}
        <div className="relative hidden md:block w-72 lg:w-80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs rounded-full pl-10 pr-4 py-2.5 border border-slate-200/90 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition"
            />
          </div>

          {/* Resultados de Busca */}
          {filteredContacts.length > 0 && (
            <div className="absolute left-0 right-0 top-12 bg-white rounded-3xl shadow-xl border border-slate-200 p-2 z-50 max-h-80 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                Contatos ({filteredContacts.length})
              </div>
              {filteredContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectSearchResult(c.id)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-2xl flex items-center justify-between transition group cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-[#3742AC]">{c.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{c.phone}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {c.temperature === 'HOT' ? '🔥 Quente' : 'Lead'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botão Novo Lead Sovereign Pill */}
        {['inbox', 'kanban', 'contacts'].includes(currentTab || '') && (
          <button
            onClick={onOpenNewLead}
            className="flex items-center gap-1.5 bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-md shadow-indigo-900/15 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Lead</span>
          </button>
        )}

        {/* Notificações Sovereign */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsPopover(!showAlertsPopover)}
            className="p-2.5 text-slate-700 hover:text-slate-900 bg-white rounded-full border border-slate-200/80 shadow-2xs transition cursor-pointer relative"
            title="Alertas & Notificações"
          >
            <Bell className="w-4 h-4" />
            {activeAlerts.length > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </button>

          {/* Popover de Alertas */}
          {showAlertsPopover && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-900">Alertas de SLA & Inatividade</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activeAlerts.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto my-2">
                {activeAlerts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 space-y-1">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
                    <p className="text-xs font-bold text-slate-700">Tudo em dia!</p>
                    <p className="text-[11px]">Nenhum alerta de inatividade pendente.</p>
                  </div>
                ) : (
                  activeAlerts.map(alert => (
                    <div key={alert.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          <p className="text-xs font-bold text-slate-900">{alert.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{alert.description}</p>
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        title="Dispensar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar do Usuário */}
        <div className="flex items-center gap-2 bg-white rounded-full p-1 pl-2.5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-bold text-slate-800 hidden sm:inline">
            {currentUser?.name?.split(' ')[0]}
          </span>
          <img
            src={currentUser?.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser?.name || 'User')}
            alt={currentUser?.name}
            className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-100"
          />
        </div>

      </div>

    </header>
  );
}
