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
  UserPlus,
  Menu
} from 'lucide-react';

interface HeaderProps {
  onOpenNewLead: () => void;
  onOpenZapiSimulator: () => void;
  onOpenAuthModal?: () => void;
  onSelectContact?: (contactId: string) => void;
  onToggleMobileSidebar?: () => void;
}

export function Header({ onOpenNewLead, onOpenZapiSimulator, onOpenAuthModal, onSelectContact, onToggleMobileSidebar }: HeaderProps) {
  const { alerts, dismissAlert, contacts, deals, setActiveConversationId, conversations, currentUser } = useCRM();
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

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 sticky top-0 z-20 shadow-xs min-w-0">
      {/* Botão Hamburger para Mobile */}
      {onToggleMobileSidebar && (
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer shrink-0"
          title="Abrir Menu Lateral"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Global Search Bar */}
      <div className="relative flex-1 max-w-full sm:max-w-md min-w-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, tag ou imóvel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>

        {/* Search Results Dropdown */}
        {filteredContacts.length > 0 && (
          <div className="absolute left-0 right-0 top-12 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 max-h-80 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Contatos Encontrados ({filteredContacts.length})
            </div>
            {filteredContacts.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectSearchResult(c.id)}
                className="w-full text-left p-2 hover:bg-slate-50 rounded-lg flex items-center justify-between transition group"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-600">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.phone} • {c.targetRegions.join(', ')}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    c.temperature === 'HOT' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                    c.temperature === 'WARM' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {c.temperature === 'HOT' ? '🔥 Quente' : c.temperature === 'WARM' ? '⚡ Morno' : '❄️ Frio'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons & Notifications */}
      <div className="flex items-center gap-3">
        {/* Create Lead Button */}
        <button
          onClick={onOpenNewLead}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm shadow-emerald-700/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Lead</span>
        </button>

        {/* SLA Alerts Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsPopover(!showAlertsPopover)}
            className="relative p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition"
            title="Alertas de SLA e Notificações"
          >
            <Bell className="w-4 h-4" />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Alerts Popover */}
          {showAlertsPopover && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-800">Alertas de SLA & Inatividade</h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activeAlerts.length} pendentes
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto my-2">
                {activeAlerts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-500 opacity-80" />
                    <p className="text-xs font-medium">Nenhum alerta de SLA pendente!</p>
                  </div>
                ) : (
                  activeAlerts.map(alert => (
                    <div key={alert.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            alert.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'
                          }`} />
                          <p className="text-xs font-bold text-slate-800">{alert.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{alert.description}</p>
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        title="Dispensar alerta"
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
      </div>
    </header>
  );
}
