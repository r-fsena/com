'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { WhatsAppInbox } from '@/components/inbox/WhatsAppInbox';
import { WhatsAppImportView } from '@/components/whatsapp/WhatsAppImportView';
import { WhatsAppConnectionView } from '@/components/whatsapp/WhatsAppConnectionView';
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
import { GoalsManager } from '@/components/goals/GoalsManager';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Building2 } from 'lucide-react';

export default function CRMApp() {
  const { openChatForContact, isAuthenticated, isAuthReady, currentUser, currentTenant, setCurrentTenant, logout, isFeatureEnabled } = useCRM();

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
    return 'TENANT_CRM';
  });

  const [currentTab, setCurrentTabState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vanguard_crm_current_tab');
        if (saved) return saved;
      } catch {}
    }
    return 'dashboard';
  });

  const setCurrentTab = (tab: string) => {
    setCurrentTabState(tab);
    try {
      localStorage.setItem('vanguard_crm_current_tab', tab);
    } catch {}
  };

  // Quando o usuário faz login ou altera a autenticação, sincroniza a aba e o modo
  React.useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      try {
        const savedTab = localStorage.getItem('vanguard_crm_current_tab');
        if (savedTab) {
          setCurrentTabState(savedTab);
        } else {
          setCurrentTabState('dashboard');
        }
        const savedMode = localStorage.getItem('faithhubs_view_mode');
        if (savedMode === 'SAAS_MASTER' || savedMode === 'TENANT_CRM') {
          setViewMode(savedMode);
        }
      } catch {}
    }
  }, [isAuthenticated]);

  // Se a aba ativa atual foi desativada por Feature Flag, redireciona suavemente para 'dashboard'
  React.useEffect(() => {
    if (
      (currentTab === 'proposals' && !isFeatureEnabled('proposals')) ||
      (currentTab === 'financial' && !isFeatureEnabled('asaasBilling')) ||
      (currentTab === 'campaigns' && !isFeatureEnabled('campaigns')) ||
      (currentTab === 'automations' && !isFeatureEnabled('automations'))
    ) {
      setCurrentTab('dashboard');
    }
  }, [currentTab, isFeatureEnabled]);

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

  // Garante que SuperAdmin sempre tenha acesso ao SaaS Master e que usuários comuns fiquem no CRM
  React.useEffect(() => {
    if (!isMasterAdmin) {
      setViewMode('TENANT_CRM');
    }
  }, [isMasterAdmin]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white select-none">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-pulse">
          <Building2 className="w-6 h-6 text-slate-950" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-wider font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Carregando workspace...</span>
        </div>
      </div>
    );
  }

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
              currentTab={currentTab}
              onOpenNewLead={() => setIsNewLeadOpen(true)}
              onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onSelectContact={handleOpenChatForContact}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />

            {/* View Switcher */}
            <main className="flex-1 flex overflow-hidden relative min-w-0">
              <ErrorBoundary>
                {currentTab === 'inbox' && <WhatsAppInbox />}
                {currentTab === 'whatsapp-import' && (
                  <WhatsAppImportView onGoToInbox={() => setCurrentTab('inbox')} />
                )}
                {currentTab === 'whatsapp-connection' && <WhatsAppConnectionView />}
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
                {currentTab === 'proposals' && isFeatureEnabled('proposals') && <ProposalManager />}
                {currentTab === 'financial' && isFeatureEnabled('asaasBilling') && <FinancialDashboard />}
                {currentTab === 'tasks' && <TasksManager />}
                {currentTab === 'automations' && isFeatureEnabled('automations') && <AutomationManager />}
                {currentTab === 'campaigns' && isFeatureEnabled('campaigns') && <CampaignManager />}
                {currentTab === 'dashboard' && (
                  <SalesDashboard 
                    onOpenChat={handleOpenChatForContact} 
                    onNavigateToGoals={() => setCurrentTab('goals')}
                  />
                )}
                {currentTab === 'goals' && <GoalsManager />}
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
