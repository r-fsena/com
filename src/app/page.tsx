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

export default function CRMApp() {
  const { openChatForContact, isAuthenticated, currentUser, currentTenant, setCurrentTenant, logout } = useCRM();

  const isMasterAdmin = currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_MASTER';

  const [viewMode, setViewMode] = useState<'SAAS_MASTER' | 'TENANT_CRM'>('SAAS_MASTER');
  const [currentTab, setCurrentTab] = useState('inbox');
  const [isZapiSimulatorOpen, setIsZapiSimulatorOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleOpenChatForContact = (contactId: string) => {
    openChatForContact(contactId);
    setCurrentTab('inbox');
  };

  // Se o Admin Master estiver no Portal Master SaaS
  if (isMasterAdmin && viewMode === 'SAAS_MASTER') {
    return (
      <SaaSAdminHub 
        onEnterTenant={(tenant) => {
          setCurrentTenant(tenant);
          setViewMode('TENANT_CRM');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 antialiased flex-col">
      {/* Barra de Modo Admin Master (quando o SuperAdmin entra no CRM de uma Imobiliária) */}
      {isMasterAdmin && (
        <div className="bg-slate-900 text-white px-6 py-2 text-xs flex items-center justify-between border-b border-amber-500/30 shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-to-r from-amber-500 to-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">
              👑 MODO ADMIN MASTER
            </span>
            <span className="text-slate-300 text-xs">
              Você está gerenciando o ambiente da imobiliária: <strong className="text-white font-bold">{currentTenant.name}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('SAAS_MASTER')}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-1 rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <span>↩ Voltar ao Portal Master SaaS</span>
          </button>
        </div>
      )}

      {/* Layout Operacional do CRM da Imobiliária */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar de Navegação da Imobiliária */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
          onOpenQrCodeModal={() => setIsQrCodeModalOpen(true)}
          onGoToMasterPortal={() => setViewMode('SAAS_MASTER')}
        />

        {/* Área Principal de Trabalho */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header
            onOpenNewLead={() => setIsNewLeadOpen(true)}
            onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSelectContact={handleOpenChatForContact}
          />

          {/* View Switcher */}
          <main className="flex-1 flex overflow-hidden relative">
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
  );
}
