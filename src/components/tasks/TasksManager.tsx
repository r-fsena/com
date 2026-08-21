'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  CheckSquare, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2,
  Phone,
  MessageSquare,
  Building,
  FileText,
  Mail,
  Send,
  Download,
  ExternalLink,
  MapPin,
  Sparkles,
  Share2,
  Check,
  X
} from 'lucide-react';
import { safeFormatDate } from '@/lib/date-utils';
import { 
  generateICSContent, 
  generateGoogleCalendarUrl, 
  generateOutlookCalendarUrl, 
  generateWhatsAppInviteMessage, 
  downloadICSFile,
  CalendarEventData 
} from '@/lib/calendar-service';

export function TasksManager() {
  const { 
    tasks, 
    toggleTask, 
    createTask, 
    contacts, 
    users, 
    currentUser,
    conversations,
    sendMessage,
    openChatForContact
  } = useCRM();

  const [filter, setFilter] = useState<'PENDING' | 'COMPLETED' | 'VISITS' | 'ALL'>('PENDING');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [taskType, setTaskType] = useState<'VISIT' | 'WHATSAPP' | 'CALL' | 'PROPOSAL'>('VISIT');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [dueDate, setDueDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState('');
  const [sendEmailInvite, setSendEmailInvite] = useState(true);
  const [sendWhatsAppInvite, setSendWhatsAppInvite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedContact = contacts.find(c => c.id === contactId) || contacts[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'PENDING') return !t.isCompleted;
    if (filter === 'COMPLETED') return t.isCompleted;
    if (filter === 'VISITS') return t.taskType === 'VISIT';
    return true;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    const taskDate = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const contact = contacts.find(c => c.id === contactId);

    const eventData: CalendarEventData = {
      id: `evt-${Date.now()}`,
      title: title.trim(),
      description: `Agendamento comercial imobiliário realizado pelo Vanguard CRM com o corretor ${currentUser.name}.`,
      location: location.trim() || contact?.targetRegions?.[0] || 'Stand de Vendas',
      startTime: taskDate,
      durationMinutes,
      organizerName: currentUser.name,
      organizerEmail: currentUser.email,
      attendeeName: contact?.name || 'Cliente',
      attendeeEmail: contact?.email || undefined,
      attendeePhone: contact?.phone,
    };

    // 1. Cria a tarefa no CRM
    const created = createTask({
      title: title.trim(),
      contactId,
      taskType: taskType as any,
      priority,
      dueDate: taskDate,
    });

    // 2. Disparo de E-mail com Convite .ICS
    if (sendEmailInvite && contact?.email) {
      try {
        await fetch('/api/v1/calendar/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } catch (err) {
        console.error('Erro ao enviar e-mail com convite:', err);
      }
    }

    // 3. Disparo de Mensagem no WhatsApp com Link de 1-Clique do Google Calendar
    if (sendWhatsAppInvite && contact) {
      try {
        const inviteText = generateWhatsAppInviteMessage(eventData);
        const convId = openChatForContact(contact.id);
        if (convId) {
          sendMessage(convId, inviteText);
        }
      } catch (err) {
        console.error('Erro ao enviar convite via WhatsApp:', err);
      }
    }

    setIsSubmitting(false);
    setShowNewTaskModal(false);
    setTitle('');
    setLocation('');
    showToast(
      sendEmailInvite || sendWhatsAppInvite
        ? `✅ Agendamento criado e convites enviados com sucesso para ${contact?.name || 'o cliente'}!`
        : '✅ Tarefa criada com sucesso!'
    );
  };

  // Enviar convite avulso no WhatsApp
  const handleSendWhatsAppInvite = (task: any) => {
    const contact = contacts.find(c => c.id === task.contactId);
    if (!contact) return;

    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com o corretor ${currentUser.name}.`,
      location: contact.targetRegions?.[0] || 'Imóvel / Stand de Vendas',
      startTime: task.dueDate,
      durationMinutes: 60,
      organizerName: currentUser.name,
      organizerEmail: currentUser.email,
      attendeeName: contact.name,
      attendeeEmail: contact.email || undefined,
      attendeePhone: contact.phone,
    };

    const inviteText = generateWhatsAppInviteMessage(eventData);
    const convId = openChatForContact(contact.id);
    if (convId) {
      sendMessage(convId, inviteText);
      showToast(`📲 Convite de agenda enviado no WhatsApp de ${contact.name}!`);
    } else {
      // Abre no WhatsApp Web
      const cleanPhone = contact.phone.replace(/\D/g, '');
      const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(inviteText)}`;
      window.open(url, '_blank');
    }
  };

  // Enviar convite avulso por E-mail
  const handleSendEmailInvite = async (task: any) => {
    const contact = contacts.find(c => c.id === task.contactId);
    if (!contact?.email) {
      alert(`O contato ${contact?.name || 'selecionado'} não possui e-mail cadastrado.`);
      return;
    }

    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com ${currentUser.name} pelo Vanguard CRM.`,
      location: contact.targetRegions?.[0] || 'Imóvel / Stand de Vendas',
      startTime: task.dueDate,
      durationMinutes: 60,
      organizerName: currentUser.name,
      organizerEmail: currentUser.email,
      attendeeName: contact.name,
      attendeeEmail: contact.email,
      attendeePhone: contact.phone,
    };

    try {
      await fetch('/api/v1/calendar/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      showToast(`✉️ Convite .ics enviado para ${contact.email}!`);
    } catch {
      alert('Erro ao enviar convite por e-mail.');
    }
  };

  // Download do .ICS
  const handleDownloadICS = (task: any) => {
    const contact = contacts.find(c => c.id === task.contactId);
    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com ${currentUser.name}.`,
      location: contact?.targetRegions?.[0] || 'Imóvel',
      startTime: task.dueDate,
      durationMinutes: 60,
      organizerName: currentUser.name,
      organizerEmail: currentUser.email,
      attendeeName: contact?.name || 'Cliente',
      attendeeEmail: contact?.email || undefined,
    };

    const icsContent = generateICSContent(eventData);
    downloadICSFile(`convite-${task.title}`, icsContent);
    showToast('📥 Arquivo .ics baixado com sucesso!');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VISIT': return <Building className="w-4 h-4 text-emerald-600" />;
      case 'WHATSAPP': return <MessageSquare className="w-4 h-4 text-teal-600" />;
      case 'CALL': return <Phone className="w-4 h-4 text-blue-600" />;
      case 'PROPOSAL': return <FileText className="w-4 h-4 text-amber-600" />;
      default: return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Agenda, Visitas & Disparos de Convite</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {tasks.filter(t => !t.isCompleted).length} pendentes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Agende visitas a imóveis, gere convites interativos (.ics) e envie links diretos no WhatsApp e E-mail do cliente
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'PENDING' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setFilter('VISITS')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'VISITS' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🏠 Visitas
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'COMPLETED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Concluídas
            </button>
          </div>

          <button
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar Visita / Tarefa</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 opacity-80" />
            <p className="text-sm font-bold text-slate-700">Tudo em dia na sua agenda!</p>
            <p className="text-xs text-slate-400">Nenhuma tarefa ou visita pendente para o filtro selecionado.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const contact = contacts.find(c => c.id === task.contactId);
            const broker = users.find(u => u.id === task.assignedUserId);
            const isLate = !task.isCompleted && new Date(task.dueDate).getTime() < Date.now();

            const eventData: CalendarEventData = {
              id: task.id,
              title: task.title,
              startTime: task.dueDate,
              durationMinutes: 60,
              organizerName: broker?.name || currentUser.name,
              organizerEmail: broker?.email || currentUser.email,
              attendeeName: contact?.name || 'Cliente',
              attendeeEmail: contact?.email || undefined,
              location: contact?.targetRegions?.[0] || 'Imóvel',
            };

            const googleCalUrl = generateGoogleCalendarUrl(eventData);

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 border transition duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs hover:shadow-md ${
                  task.isCompleted ? 'bg-slate-50/80 border-slate-200 opacity-60' :
                  isLate ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-emerald-500'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition flex-shrink-0 cursor-pointer ${
                      task.isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-emerald-500 bg-white'
                    }`}
                  >
                    {task.isCompleted && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="p-1 rounded-lg bg-slate-100 flex-shrink-0">
                        {getTypeIcon(task.taskType)}
                      </span>
                      <h3 className={`text-xs font-bold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        task.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                        task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {task.priority === 'HIGH' ? '🔥 Alta' : task.priority === 'MEDIUM' ? '⚡ Média' : '❄️ Baixa'}
                      </span>

                      {task.taskType === 'VISIT' && (
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Visita Agendada</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                      {contact && (
                        <span>
                          👤 Lead: <strong>{contact.name}</strong> <span className="font-mono text-slate-400">({contact.phone})</span>
                        </span>
                      )}
                      {contact?.email && (
                        <span className="text-emerald-700 font-medium">
                          ✉️ {contact.email}
                        </span>
                      )}
                      {broker && (
                        <span>
                          💼 Corretor: {broker.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações de Disparo de Convite de Agenda */}
                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 flex-wrap">
                  {/* Botão Enviar Convite no WhatsApp */}
                  {contact && (
                    <button
                      onClick={() => handleSendWhatsAppInvite(task)}
                      className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
                      title="Enviar convite com link de 1-clique do Google Calendar no WhatsApp do cliente"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>
                  )}

                  {/* Botão Enviar Convite por E-mail (.ICS) */}
                  {contact?.email && (
                    <button
                      onClick={() => handleSendEmailInvite(task)}
                      className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
                      title="Disparar convite interativo .ics para o e-mail do cliente"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>E-mail</span>
                    </button>
                  )}

                  {/* Botão Google Calendar (Abrir na agenda do Corretor) */}
                  <a
                    href={googleCalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Adicionar evento à minha Google Agenda"
                  >
                    <Calendar className="w-4 h-4" />
                  </a>

                  {/* Download .ICS */}
                  <button
                    onClick={() => handleDownloadICS(task)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Baixar arquivo de agenda .ICS (compatível com Outlook, Apple e Mac)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <div className="text-right pl-2 border-l border-slate-200">
                    <span className={`text-xs font-bold font-mono block ${isLate ? 'text-rose-600' : 'text-slate-700'}`}>
                      {safeFormatDate(task.dueDate, 'dd/MM/yyyy HH:mm')}
                    </span>
                    {isLate && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                        ⚠️ Atrasado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Novo Agendamento com Disparo de Convite */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Novo Agendamento / Visita ao Imóvel</span>
              </div>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título do Compromisso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Visita ao Apartamento Decorado - Batel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Vinculado</label>
                  <select
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-800 cursor-pointer"
                  >
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Ação</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="VISIT">🏠 Visita Presencial ao Imóvel</option>
                    <option value="WHATSAPP">💬 Follow-up via WhatsApp</option>
                    <option value="CALL">📞 Reunião / Ligação Telefônica</option>
                    <option value="PROPOSAL">📑 Elaboração de Proposta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data & Hora *</label>
                  <input
                    type="datetime-local"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duração Estimada</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none font-medium text-slate-800 cursor-pointer"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora (Padrão)</option>
                    <option value={90}>1 hora e 30 min</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Local / Endereço da Visita</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ex: Av. Batel, 1550 - Batel, Curitiba - PR"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Caixa de Disparo Automático de Convites */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-emerald-900 block">
                  🚀 Orquestração de Convites de Agenda:
                </span>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsAppInvite}
                    onChange={(e) => setSendWhatsAppInvite(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>📲 Enviar link do Google Calendar no WhatsApp do cliente</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailInvite}
                    onChange={(e) => setSendEmailInvite(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>✉️ Enviar convite interativo (.ics) para o e-mail do cliente</span>
                </label>

                {selectedContact?.email && (
                  <p className="text-[10px] text-emerald-800 font-mono pl-5">
                    Destinatário: {selectedContact.email}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Agendando...' : 'Confirmar & Disparar Convites'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
