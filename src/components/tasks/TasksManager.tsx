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
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TasksManager() {
  const { tasks, toggleTask, createTask, contacts, users, currentUser } = useCRM();
  const [filter, setFilter] = useState<'PENDING' | 'COMPLETED' | 'ALL'>('PENDING');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState(contacts[0]?.id || '');
  const [taskType, setTaskType] = useState<'VISIT' | 'WHATSAPP' | 'CALL' | 'PROPOSAL'>('FOLLOW_UP' as any);
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [dueDate, setDueDate] = useState('');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'PENDING') return !t.isCompleted;
    if (filter === 'COMPLETED') return t.isCompleted;
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createTask({
      title: title.trim(),
      contactId,
      taskType: taskType as any,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });

    setTitle('');
    setShowNewTaskModal(false);
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
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">Tarefas, Visitas & SLAs</h1>
            <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {tasks.filter(t => !t.isCompleted).length} pendentes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize visitas a imóveis, follow-ups de WhatsApp e prazos de propostas comerciais
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
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="text-xs font-bold text-slate-700">Tudo em dia!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nenhuma tarefa pendente para o filtro selecionado.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const contact = contacts.find(c => c.id === task.contactId);
            const broker = users.find(u => u.id === task.assignedUserId);
            const isLate = !task.isCompleted && new Date(task.dueDate).getTime() < Date.now();

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 border transition duration-150 flex items-start justify-between gap-4 shadow-xs ${
                  task.isCompleted ? 'bg-slate-50/80 border-slate-200 opacity-60' :
                  isLate ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-emerald-500'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                      task.isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-emerald-500 bg-white'
                    }`}
                  >
                    {task.isCompleted && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1 rounded-lg bg-slate-100">
                        {getTypeIcon(task.taskType)}
                      </span>
                      <h3 className={`text-xs font-bold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </h3>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        task.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                        task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      {contact && (
                        <span>
                          👤 Lead: <strong>{contact.name}</strong> ({contact.phone})
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

                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-bold font-mono block ${isLate ? 'text-rose-600' : 'text-slate-700'}`}>
                    {format(new Date(task.dueDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                  {isLate && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                      ⚠️ Atrasado
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nova Tarefa */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm">
              Criar Nova Tarefa / Visita
            </div>
            <form onSubmit={handleCreateTask} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título da Ação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Visita decorado Jardins com Dr. Roberto"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Vinculado</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="VISIT">Visita Presencial</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="CALL">Ligação Telefônica</option>
                    <option value="PROPOSAL">Elaborar Proposta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Média</option>
                    <option value="LOW">Baixa</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Salvar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
