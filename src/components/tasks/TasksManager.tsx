'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  CheckSquare, 
  Plus, 
  Calendar as CalendarIcon, 
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
  X,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Layers,
  CalendarDays,
  List
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
import { Task } from '@/types/crm';

export function TasksManager() {
  const { 
    tasks, 
    toggleTask, 
    createTask, 
    updateTask,
    deleteTask,
    contacts, 
    users, 
    currentUser,
    conversations,
    sendMessage,
    openChatForContact
  } = useCRM();

  // Visualização: Lista vs Calendário
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [filter, setFilter] = useState<'PENDING' | 'COMPLETED' | 'VISITS' | 'ALL'>('PENDING');
  
  // Estado do Mês do Calendário
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Modal de Criação / Edição de Tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Confirmação de Reenvio Anti-Spam
  const [resendConfirmTarget, setResendConfirmTarget] = useState<{
    task: Task;
    channel: 'WHATSAPP' | 'EMAIL';
  } | null>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Abrir Modal para Nova Tarefa
  const handleOpenNewTaskModal = (initialDate?: Date) => {
    setEditingTask(null);
    setTitle('');
    setContactId(contacts[0]?.id || '');
    setTaskType('VISIT');
    setPriority('HIGH');
    setLocation('');
    setDurationMinutes(60);
    setSendEmailInvite(true);
    setSendWhatsAppInvite(true);

    if (initialDate) {
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      const hours = String(new Date().getHours() + 1).padStart(2, '0');
      setDueDate(`${year}-${month}-${day}T${hours}:00`);
    } else {
      const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
      tomorrow.setHours(15, 0, 0, 0);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      setDueDate(`${year}-${month}-${day}T15:00`);
    }

    setShowTaskModal(true);
  };

  // Abrir Modal para Edição de Tarefa Existente
  const handleOpenEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setContactId(task.contactId);
    setTaskType(task.taskType as any);
    setPriority(task.priority);
    setLocation(task.location || '');
    setDurationMinutes(task.durationMinutes || 60);
    setSendEmailInvite(false);
    setSendWhatsAppInvite(false);

    try {
      const d = new Date(task.dueDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    } catch {
      setDueDate('');
    }

    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    const taskDate = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const contact = contacts.find(c => c.id === contactId);

    const eventData: CalendarEventData = {
      id: editingTask?.id || `evt-${Date.now()}`,
      title: title.trim(),
      description: `Agendamento comercial imobiliário com o corretor ${currentUser.name}.`,
      location: location.trim() || contact?.targetRegions?.[0] || 'Stand de Vendas',
      startTime: taskDate,
      durationMinutes,
      organizerName: currentUser.name,
      organizerEmail: currentUser.email,
      attendeeName: contact?.name || 'Cliente',
      attendeeEmail: contact?.email || undefined,
      attendeePhone: contact?.phone,
    };

    let inviteSentEmail = editingTask?.inviteSentViaEmail || false;
    let inviteSentEmailAt = editingTask?.inviteSentViaEmailAt;
    let inviteSentWhatsApp = editingTask?.inviteSentViaWhatsApp || false;
    let inviteSentWhatsAppAt = editingTask?.inviteSentViaWhatsAppAt;

    // 1. Disparo de E-mail com Convite .ICS
    if (sendEmailInvite && contact?.email) {
      try {
        await fetch('/api/v1/calendar/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
        inviteSentEmail = true;
        inviteSentEmailAt = new Date().toISOString();
      } catch (err) {
        console.error('Erro ao enviar e-mail com convite:', err);
      }
    }

    // 2. Disparo de Mensagem no WhatsApp com Link de 1-Clique do Google Calendar
    if (sendWhatsAppInvite && contact) {
      try {
        const inviteText = generateWhatsAppInviteMessage(eventData);
        const convId = openChatForContact(contact.id);
        if (convId) {
          sendMessage(convId, inviteText);
          inviteSentWhatsApp = true;
          inviteSentWhatsAppAt = new Date().toISOString();
        }
      } catch (err) {
        console.error('Erro ao enviar convite via WhatsApp:', err);
      }
    }

    if (editingTask) {
      // Atualizar tarefa existente
      updateTask(editingTask.id, {
        title: title.trim(),
        contactId,
        taskType: taskType as any,
        priority,
        dueDate: taskDate,
        durationMinutes,
        location: location.trim(),
        inviteSentViaEmail: inviteSentEmail,
        inviteSentViaEmailAt: inviteSentEmailAt,
        inviteSentViaWhatsApp: inviteSentWhatsApp,
        inviteSentViaWhatsAppAt: inviteSentWhatsAppAt,
      });
      showToast('✅ Compromisso atualizado com sucesso!');
    } else {
      // Criar nova tarefa
      createTask({
        title: title.trim(),
        contactId,
        taskType: taskType as any,
        priority,
        dueDate: taskDate,
        durationMinutes,
        location: location.trim(),
        inviteSentViaEmail: inviteSentEmail,
        inviteSentViaEmailAt: inviteSentEmailAt,
        inviteSentViaWhatsApp: inviteSentWhatsApp,
        inviteSentViaWhatsAppAt: inviteSentWhatsAppAt,
      });
      showToast('✅ Novo agendamento criado com sucesso!');
    }

    setIsSubmitting(false);
    setShowTaskModal(false);
  };

  // Excluir Tarefa
  const handleDeleteTask = (taskId: string) => {
    if (confirm('Tem certeza que deseja excluir esta tarefa/visita?')) {
      deleteTask(taskId);
      setShowTaskModal(false);
      showToast('🗑️ Tarefa removida com sucesso.');
    }
  };

  // Disparo / Reenvio no WhatsApp com verificação Anti-Spam
  const handleRequestWhatsAppInvite = (task: Task) => {
    if (task.inviteSentViaWhatsApp) {
      // Se já foi enviado, abre modal de confirmação para evitar spam acidental
      setResendConfirmTarget({ task, channel: 'WHATSAPP' });
    } else {
      executeSendWhatsAppInvite(task);
    }
  };

  const executeSendWhatsAppInvite = (task: Task) => {
    const contact = contacts.find(c => c.id === task.contactId);
    if (!contact) return;

    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com o corretor ${currentUser.name}.`,
      location: task.location || contact.targetRegions?.[0] || 'Imóvel / Stand de Vendas',
      startTime: task.dueDate,
      durationMinutes: task.durationMinutes || 60,
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
      updateTask(task.id, {
        inviteSentViaWhatsApp: true,
        inviteSentViaWhatsAppAt: new Date().toISOString(),
      });
      showToast(`📲 Convite enviado no WhatsApp de ${contact.name}!`);
    } else {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(inviteText)}`;
      window.open(url, '_blank');
    }
    setResendConfirmTarget(null);
  };

  // Disparo / Reenvio por E-mail com verificação Anti-Spam
  const handleRequestEmailInvite = (task: Task) => {
    const contact = contacts.find(c => c.id === task.contactId);
    if (!contact?.email) {
      alert(`O contato ${contact?.name || 'selecionado'} não possui e-mail cadastrado.`);
      return;
    }

    if (task.inviteSentViaEmail) {
      setResendConfirmTarget({ task, channel: 'EMAIL' });
    } else {
      executeSendEmailInvite(task);
    }
  };

  const executeSendEmailInvite = async (task: Task) => {
    const contact = contacts.find(c => c.id === task.contactId);
    if (!contact?.email) return;

    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com ${currentUser.name} pelo Vanguard CRM.`,
      location: task.location || contact.targetRegions?.[0] || 'Imóvel / Stand de Vendas',
      startTime: task.dueDate,
      durationMinutes: task.durationMinutes || 60,
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
      updateTask(task.id, {
        inviteSentViaEmail: true,
        inviteSentViaEmailAt: new Date().toISOString(),
      });
      showToast(`✉️ Convite .ics enviado para ${contact.email}!`);
    } catch {
      alert('Erro ao enviar convite por e-mail.');
    }
    setResendConfirmTarget(null);
  };

  // Download do .ICS
  const handleDownloadICS = (task: Task) => {
    const contact = contacts.find(c => c.id === task.contactId);
    const eventData: CalendarEventData = {
      id: task.id,
      title: task.title,
      description: `Agendamento comercial com ${currentUser.name}.`,
      location: task.location || contact?.targetRegions?.[0] || 'Imóvel',
      startTime: task.dueDate,
      durationMinutes: task.durationMinutes || 60,
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

  const filteredTasks = tasks.filter(t => {
    if (filter === 'PENDING') return !t.isCompleted;
    if (filter === 'COMPLETED') return t.isCompleted;
    if (filter === 'VISITS') return t.taskType === 'VISIT';
    return true;
  });

  // ----------------------------------------------------
  // CÁLCULOS DO CALENDÁRIO MENSAL
  // ----------------------------------------------------
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sáb)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Matriz de dias (42 células = 6 semanas)
  const calendarCells = [];
  // Dias do mês anterior
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    calendarCells.push({ date: d, isCurrentMonth: false });
  }
  // Dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarCells.push({ date: d, isCurrentMonth: true });
  }
  // Dias do próximo mês para completar 35 ou 42 células
  const remaining = 35 - calendarCells.length > 0 ? 35 - calendarCells.length : 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    calendarCells.push({ date: d, isCurrentMonth: false });
  }

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const today = new Date();

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
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Agenda, Visitas & Disparos de Convite</h1>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {tasks.filter(t => !t.isCompleted).length} pendentes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize sua grade de horários livres, agende visitas e dispare convites interativos no WhatsApp e E-mail
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Alternador de Visão (Lista vs Calendário) */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200/80">
            <button
              onClick={() => setViewMode('CALENDAR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'CALENDAR' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Visão Calendário</span>
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Visão Lista</span>
            </button>
          </div>

          {/* Botão Novo Agendamento */}
          <button
            onClick={() => handleOpenNewTaskModal()}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar Visita / Tarefa</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CONTEÚDO PRINCIPAL: VISÃO CALENDÁRIO OU LISTA        */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'CALENDAR' ? (
        <div className="flex-1 flex flex-col p-6 overflow-hidden max-w-7xl w-full mx-auto">
          {/* Barra de Navegação do Calendário */}
          <div className="flex items-center justify-between mb-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900">
                {monthNames[month]} de {year}
              </h2>
              <button
                onClick={() => setCurrentCalendarDate(new Date())}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition cursor-pointer"
              >
                Hoje
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentCalendarDate(new Date(year, month - 1, 1))}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentCalendarDate(new Date(year, month + 1, 1))}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grade de Dias do Mês */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Dias da Semana */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2 text-[11px] font-bold text-slate-500">
              <span>DOM</span>
              <span>SEG</span>
              <span>TER</span>
              <span>QUA</span>
              <span>QUI</span>
              <span>SEX</span>
              <span>SÁB</span>
            </div>

            {/* Grid 7 Colunas */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-slate-200 overflow-y-auto">
              {calendarCells.map((cell, idx) => {
                const dayTasks = tasks.filter(t => {
                  try {
                    return isSameDay(new Date(t.dueDate), cell.date);
                  } catch {
                    return false;
                  }
                });

                const isCurrentToday = isSameDay(cell.date, today);

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenNewTaskModal(cell.date)}
                    className={`bg-white p-2 min-h-[95px] flex flex-col justify-between transition cursor-pointer hover:bg-emerald-50/30 group ${
                      !cell.isCurrentMonth ? 'bg-slate-50/60 opacity-40' : ''
                    } ${isCurrentToday ? 'ring-2 ring-emerald-500/40 ring-inset bg-emerald-50/20' : ''}`}
                  >
                    {/* Topo da Célula (Número do Dia) */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold rounded-lg px-1.5 py-0.5 ${
                        isCurrentToday 
                          ? 'bg-emerald-600 text-white font-mono' 
                          : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                      }`}>
                        {cell.date.getDate()}
                      </span>

                      {/* Botão + rápido ao passar o mouse */}
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-600 font-bold transition">
                        + Agendar
                      </span>
                    </div>

                    {/* Lista de Eventos no Dia */}
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {dayTasks.slice(0, 3).map((t) => {
                        const contact = contacts.find(c => c.id === t.contactId);
                        const isVisit = t.taskType === 'VISIT';
                        const timeStr = safeFormatDate(t.dueDate, 'HH:mm');

                        return (
                          <div
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditTaskModal(t);
                            }}
                            className={`px-1.5 py-1 rounded-md text-[10px] font-semibold truncate flex items-center gap-1 border transition hover:scale-102 ${
                              t.isCompleted 
                                ? 'bg-slate-100 text-slate-400 line-through border-slate-200' 
                                : isVisit
                                  ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300 shadow-2xs'
                                  : 'bg-blue-100/90 text-blue-900 border-blue-200'
                            }`}
                            title={`${timeStr} - ${t.title} (${contact?.name || 'Cliente'})`}
                          >
                            <span className="font-mono font-bold text-[9px]">{timeStr}</span>
                            <span>{isVisit ? '🏠' : '💬'}</span>
                            <span className="truncate">{contact?.name?.split(' ')[0] || t.title}</span>
                          </div>
                        );
                      })}

                      {dayTasks.length > 3 && (
                        <span className="text-[9px] font-bold text-slate-500 pl-1 block">
                          +{dayTasks.length - 3} mais...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* VISÃO LISTA DE TAREFAS                               */
        /* ---------------------------------------------------- */
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-3">
          {/* Filtros da Lista */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'PENDING' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilter('VISITS')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'VISITS' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏠 Visitas
              </button>
              <button
                onClick={() => setFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'COMPLETED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Concluídas
              </button>
            </div>
          </div>

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
                durationMinutes: task.durationMinutes || 60,
                organizerName: broker?.name || currentUser.name,
                organizerEmail: broker?.email || currentUser.email,
                attendeeName: contact?.name || 'Cliente',
                attendeeEmail: contact?.email || undefined,
                location: task.location || contact?.targetRegions?.[0] || 'Imóvel',
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

                        {/* Botão de Editar Tarefa */}
                        <button
                          onClick={() => handleOpenEditTaskModal(task)}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Editar Detalhes do Agendamento"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          task.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                          task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority === 'HIGH' ? '🔥 Alta' : task.priority === 'MEDIUM' ? '⚡ Média' : '❄️ Baixa'}
                        </span>

                        {task.taskType === 'VISIT' && (
                          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CalendarIcon className="w-2.5 h-2.5 text-emerald-600" />
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
                        {task.location && (
                          <span className="text-slate-600">
                            📍 {task.location}
                          </span>
                        )}
                        {contact?.email && (
                          <span className="text-emerald-700 font-medium">
                            ✉️ {contact.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações de Disparo de Convite com Status de Envio */}
                  <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 flex-wrap">
                    {/* Botão Enviar Convite no WhatsApp com Status Anti-Spam */}
                    {contact && (
                      <button
                        onClick={() => handleRequestWhatsAppInvite(task)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer ${
                          task.inviteSentViaWhatsApp
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                        title={task.inviteSentViaWhatsApp ? `Convite já enviado em ${safeFormatDate(task.inviteSentViaWhatsAppAt, 'dd/MM HH:mm')}. Clique para reenviar.` : 'Enviar convite no WhatsApp'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{task.inviteSentViaWhatsApp ? '✅ WhatsApp Enviado' : 'WhatsApp'}</span>
                      </button>
                    )}

                    {/* Botão Enviar Convite por E-mail (.ICS) */}
                    {contact?.email && (
                      <button
                        onClick={() => handleRequestEmailInvite(task)}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer ${
                          task.inviteSentViaEmail
                            ? 'bg-blue-100 text-blue-900 border border-blue-300 hover:bg-blue-200'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                        title={task.inviteSentViaEmail ? `Convite enviado por e-mail em ${safeFormatDate(task.inviteSentViaEmailAt, 'dd/MM HH:mm')}. Clique para reenviar.` : 'Enviar convite por e-mail'}
                      >
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                        <span>{task.inviteSentViaEmail ? '✅ E-mail Enviado' : 'E-mail'}</span>
                      </button>
                    )}

                    {/* Botão Google Calendar */}
                    <a
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      title="Adicionar evento à minha Google Agenda"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </a>

                    {/* Download .ICS */}
                    <button
                      onClick={() => handleDownloadICS(task)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      title="Baixar arquivo de agenda .ICS"
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
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CRIAR / EDITAR AGENDAMENTO E VISITA           */}
      {/* ---------------------------------------------------- */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                <span>{editingTask ? 'Editar Agendamento / Visita' : 'Novo Agendamento / Visita ao Imóvel'}</span>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 space-y-3.5">
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

              {/* Caixa de Disparo de Convites */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-emerald-900 block">
                  🚀 Disparo de Convites de Agenda:
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
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Excluir Agendamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTaskModal(false)}
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
                    <span>{isSubmitting ? 'Salvando...' : editingTask ? 'Salvar Alterações' : 'Confirmar Agendamento'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* DIÁLOGO DE CONFIRMAÇÃO ANTI-SPAM PARA REENVIO        */}
      {/* ---------------------------------------------------- */}
      {resendConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reenviar Convite?</h3>
                <p className="text-xs text-slate-500">
                  Este convite já foi enviado anteriormente para este cliente em{' '}
                  <strong className="text-slate-800">
                    {safeFormatDate(
                      resendConfirmTarget.channel === 'WHATSAPP' 
                        ? resendConfirmTarget.task.inviteSentViaWhatsAppAt 
                        : resendConfirmTarget.task.inviteSentViaEmailAt,
                      'dd/MM às HH:mm'
                    )}
                  </strong>.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              Deseja disparar uma nova mensagem de confirmação para o cliente?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setResendConfirmTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (resendConfirmTarget.channel === 'WHATSAPP') {
                    executeSendWhatsAppInvite(resendConfirmTarget.task);
                  } else {
                    executeSendEmailInvite(resendConfirmTarget.task);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
              >
                Sim, Reenviar Convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
