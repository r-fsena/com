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
import { ZapiSimulatorModal } from '@/components/layout/ZapiSimulatorModal';
import { ZapiQrCodeModal } from '@/components/zapi/ZapiQrCodeModal';
import { NewLeadModal } from '@/components/layout/NewLeadModal';
import { AuthModal } from '@/components/auth/AuthModal';

export default function CRMApp() {
  const [currentTab, setCurrentTab] = useState('inbox');
  const [isZapiSimulatorOpen, setIsZapiSimulatorOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { setActiveConversationId, conversations } = useCRM();

  const handleOpenChatForContact = (contactId: string) => {
    const conv = conversations.find(c => c.contactId === contactId);
    if (conv) {
      setActiveConversationId(conv.id);
    }
    setCurrentTab('inbox');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 antialiased">
      {/* Sidebar de Navegação */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenZapiSimulator={() => setIsZapiSimulatorOpen(true)}
        onOpenQrCodeModal={() => setIsQrCodeModalOpen(true)}
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
          {currentTab === 'tasks' && <TasksManager />}
          {currentTab === 'automations' && <AutomationManager />}
          {currentTab === 'campaigns' && <CampaignManager />}
          {currentTab === 'dashboard' && <SalesDashboard />}
          {currentTab === 'settings' && (
            <SettingsManager onOpenQrCodeModal={() => setIsQrCodeModalOpen(true)} />
          )}
        </main>
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
