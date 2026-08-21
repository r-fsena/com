'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { WhatsAppInbox } from '@/components/inbox/WhatsAppInbox';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { ContactsList } from '@/components/contacts/ContactsList';
import { TasksManager } from '@/components/tasks/TasksManager';
import { CampaignManager } from '@/components/campaigns/CampaignManager';
import { SalesDashboard } from '@/components/dashboard/SalesDashboard';
import { SettingsManager } from '@/components/settings/SettingsManager';
import { AutomationManager } from '@/components/automations/AutomationManager';
import { CopilotManager } from '@/components/copilot/CopilotManager';
import { ProposalManager } from '@/components/proposals/ProposalManager';
import { FinancialDashboard } from '@/components/financial/FinancialDashboard';
import { TenantManager } from '@/components/tenants/TenantManager';
import { SaaSAdminHub } from '@/components/saas-master/SaaSAdminHub';
import { ZapiSimulatorModal } from '@/components/layout/ZapiSimulatorModal';
import { ZapiQrCodeModal } from '@/components/zapi/ZapiQrCodeModal';
import { NewLeadModal } from '@/components/layout/NewLeadModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function CRMApp() {
  const { openChatForContact, isAuthenticated, currentUser, currentTenant, setCurrentTenant, logout } = useCRM();

  const isMasterAdmin = currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_MASTER';

  const [viewMode, setViewMode] = useState<'SAAS_MASTER' | 'TENANT_CRM'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('faithhubs_view_mode');
        if (saved === 'SAAS_MASTER' || saved === 'TENANT_CRM') {
          return saved;
        }
      } catch {}
    }
    return 'SAAS_MASTER';
  });

  const [currentTab, setCurrentTabState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tab');
        if (saved) return saved;
      } catch {}
    }
    return 'inbox';
  });

  const setCurrentTab = (tab: string) => {
    setCurrentTabState(tab);
    try {
      localStorage.setItem('vanguard_crm_current_tab', tab);
    } catch {}
  };

  const handleSetViewMode = (mode: 'SAAS_MASTER' | 'TENANT_CRM') => {
    setViewMode(mode);
    try {
      localStorage.setItem('faithhubs_view_mode', mode);
    } catch {}
  };

  const [isZapiSimulatorOpen, setIsZapiSimulatorOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleOpenChatForContact = (contactId: string) => {
    openChatForContact(contactId);
    setCurrentTab('inbox');
    setIsMobileSidebarOpen(false);
  };

  // Se o Admin Master estiver no Portal Master SaaS
  if (isMasterAdmin && viewMode === 'SAAS_MASTER') {
    return (
      <ErrorBoundary fallbackTitle="Erro no Portal Master SaaS">
        <SaaSAdminHub 
          onEnterTenant={(tenant) => {
            setCurrentTenant(tenant);
            handleSetViewMode('TENANT_CRM');
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Erro na Interface do CRM">
      <div className="flex h-screen w-screen overflow-hidden bg-slate-100 antialiased flex-col">
        {/* Barra de Modo Admin Master (quando o SuperAdmin entra no CRM de uma Imobiliária) */}
        {isMasterAdmin && (
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-2 text-xs flex items-center justify-between border-b border-amber-500/30 shrink-0 shadow-xs gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="bg-gradient-to-r from-amber-500 to-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                👑 MODO ADMIN MASTER
              </span>
              <span className="text-slate-300 text-xs truncate">
                Imobiliária: <strong className="text-white font-bold">{currentTenant.name}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleSetViewMode('SAAS_MASTER')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              <span>↩ <span className="hidden sm:inline">Voltar ao Portal Master SaaS</span><span className="sm:hidden">SaaS Hub</span></span>
            </button>
          </div>
        )}

        {/* Layout Operacional do CRM da Imobiliária */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Sidebar de Navegação da Imobiliária */}
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={(tab) => {
              setCurrentTab(tab);
              setIsMobileSidebarOpen(false);
            }}
            onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
            onOpenQrCodeModal={() => setIsQrCodeModalOpen(true)}
            onGoToMasterPortal={() => handleSetViewMode('SAAS_MASTER')}
            isOpenOnMobile={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          {/* Área Principal de Trabalho */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <Header
              onOpenNewLead={() => setIsNewLeadOpen(true)}
              onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onSelectContact={handleOpenChatForContact}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            />

            {/* View Switcher */}
            <main className="flex-1 flex overflow-hidden relative min-w-0">
              <ErrorBoundary>
                {currentTab === 'inbox' && <WhatsAppInbox />}
                {currentTab === 'kanban' && (
                  <KanbanBoard
                    onOpenLeadModal={() => setIsNewLeadOpen(true)}
                    onOpenChat={handleOpenChatForContact}
                  />
                )}
                {currentTab === 'contacts' && (
                  <ContactsList
                    onOpenNewLead={() => setIsNewLeadOpen(true)}
                    onOpenChat={handleOpenChatForContact}
                  />
                )}
                {currentTab === 'proposals' && <ProposalManager />}
                {currentTab === 'financial' && <FinancialDashboard />}
                {currentTab === 'tasks' && <TasksManager />}
                {currentTab === 'automations' && <AutomationManager />}
                {currentTab === 'campaigns' && <CampaignManager />}
                {currentTab === 'dashboard' && <SalesDashboard />}
                {currentTab === 'copilot' && <CopilotManager />}
                {currentTab === 'settings' && (
                  <SettingsManager onOpenQrCodeModal={() => setIsQrCodeModalOpen(true)} />
                )}
              </ErrorBoundary>
            </main>
          </div>
        </div>

      {/* Modais Globais */}
      <ZapiSimulatorModal
        isOpen={isZapiSimulatorOpen}
        onClose={() => setIsZapiSimulatorOpen(false)}
      />

      <ZapiQrCodeModal
        isOpen={isQrCodeModalOpen}
        onClose={() => setIsQrCodeModalOpen(false)}
      />

      <NewLeadModal
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
    </ErrorBoundary>
  );
}
