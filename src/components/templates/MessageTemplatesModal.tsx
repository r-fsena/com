'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useCRM } from '@/lib/crm-context';
import { QuickReplyTemplate, QuickReplyCategory } from '@/types/crm';
import { 
  Zap, 
  X, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Image as ImageIcon, 
  Check, 
  Sparkles, 
  Building2, 
  Calendar, 
  DollarSign, 
  FileText, 
  ArrowLeft,
  Copy,
  Eye,
  CheckCheck
} from 'lucide-react';

export const CATEGORY_CONFIG: Record<QuickReplyCategory, { label: string; color: string; icon: string }> = {
  GREETING: { label: 'Boas-vindas', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '👋' },
  QUALIFICATION: { label: 'Qualificação', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🎯' },
  PROPERTIES: { label: 'Apresentação de Imóveis', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '🏢' },
  VISIT: { label: 'Agendamento de Visita', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '📅' },
  CLOSING: { label: 'Proposta & Fechamento', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '💼' },
  FOLLOW_UP: { label: 'Follow-up & Retenção', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: '⚡' },
  DOCS: { label: 'Documentação', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: '📑' },
};

interface MessageTemplatesModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
  onSelectTemplate?: (template: QuickReplyTemplate) => void;
}

export function MessageTemplatesModal({
  isOpen = true,
  onClose,
  inline = false,
  onSelectTemplate,
}: MessageTemplatesModalProps) {
  const { 
    quickReplies, 
    createQuickReply, 
    updateQuickReply, 
    toggleQuickReplyActive, 
    deleteQuickReply,
    currentUser,
    currentTenant
  } = useCRM();

  // Estados locais
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Estados do formulário de criação/edição
  const [formTitle, setFormTitle] = useState('');
  const [formShortcut, setFormShortcut] = useState('');
  const [formCategory, setFormCategory] = useState<QuickReplyCategory>('GREETING');
  const [formContent, setFormContent] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyShortcut = (shortcut: string) => {
    try {
      navigator.clipboard?.writeText(shortcut);
      setCopiedShortcut(shortcut);
      setTimeout(() => setCopiedShortcut(null), 2000);
    } catch {}
  };

  // Inicializa formulário para criação
  const handleStartCreate = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormShortcut('/');
    setFormCategory('GREETING');
    setFormContent('');
    setFormImageUrl('');
    setFormIsActive(true);
    setImageError(false);
    setIsCreatingNew(true);
  };

  // Inicializa formulário para edição
  const handleStartEdit = (template: QuickReplyTemplate) => {
    setEditingTemplate(template);
    setFormTitle(template.title);
    setFormShortcut(template.shortcut.startsWith('/') ? template.shortcut : `/${template.shortcut}`);
    setFormCategory(template.category);
    setFormContent(template.content);
    setFormImageUrl(template.imageUrl || '');
    setFormIsActive(template.isActive !== false);
    setImageError(false);
    setIsCreatingNew(true);
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingTemplate(null);
  };

  // Upload de imagem local (converte em Data URL)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setFormImageUrl(dataUrl);
      setImageError(false);
    };
    reader.readAsDataURL(file);
  };

  // Inserção rápida de variáveis no cursor do textarea
  const handleInsertVariable = (variableTag: string) => {
    if (!textareaRef.current) {
      setFormContent(prev => prev + ' ' + variableTag);
      return;
    }

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const before = formContent.substring(0, start);
    const after = formContent.substring(end);

    const newContent = before + variableTag + after;
    setFormContent(newContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + variableTag.length;
        textareaRef.current.selectionEnd = start + variableTag.length;
      }
    }, 50);
  };

  // Salvar criação ou edição
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = formTitle.trim();
    let cleanShortcut = formShortcut.trim();
    if (!cleanShortcut.startsWith('/')) {
      cleanShortcut = `/${cleanShortcut}`;
    }
    const cleanContent = formContent.trim();

    if (!cleanTitle || !cleanContent) {
      alert('Por favor, preencha o título e o conteúdo da mensagem.');
      return;
    }

    if (editingTemplate) {
      updateQuickReply(editingTemplate.id, {
        title: cleanTitle,
        shortcut: cleanShortcut,
        category: formCategory,
        content: cleanContent,
        imageUrl: formImageUrl.trim() || undefined,
        isActive: formIsActive,
      });
    } else {
      createQuickReply({
        title: cleanTitle,
        shortcut: cleanShortcut,
        category: formCategory,
        content: cleanContent,
        imageUrl: formImageUrl.trim() || undefined,
        isActive: formIsActive,
      });
    }

    setIsCreatingNew(false);
    setEditingTemplate(null);
  };

  // Lista filtrada
  const filteredTemplates = useMemo(() => {
    return quickReplies.filter(qr => {
      const matchesCategory = selectedCategory === 'ALL' || qr.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        qr.title.toLowerCase().includes(q) ||
        qr.shortcut.toLowerCase().includes(q) ||
        qr.content.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [quickReplies, selectedCategory, searchQuery]);

  if (!inline && !isOpen) return null;

  const content = (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shadow-inner">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Modelos de Mensagens & Respostas Rápidas
              </h2>
              <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full border border-white/20 text-white font-mono">
                {quickReplies.length} modelos
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Configure respostas pré-formatadas, com atalhos de teclado, imagens e variáveis dinâmicas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCreatingNew && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Modelo</span>
            </button>
          )}

          {!inline && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Corpo Principal com Scroll Fluido */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/60">
        {isCreatingNew ? (
          /* ======================================================== */
          /* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO COM LAYOUT 2 COLUNAS      */
          /* ======================================================== */
          <form onSubmit={handleSaveForm} className="w-full bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Voltar à lista de modelos"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTemplate ? 'Editar Modelo de Mensagem' : 'Cadastrar Novo Modelo de Mensagem'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure atalhos rápidos, anexo de fotos e textos dinâmicos
                  </p>
                </div>
              </div>

              {/* Toggle Ativo/Inativo */}
              <label className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer select-none transition">
                <span className={`text-xs font-bold ${formIsActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {formIsActive ? '● Modelo Ativo' : '○ Modelo Inativo'}
                </span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#3742AC] rounded focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Grid 2 Colunas: Formulário na Esquerda e Simulador na Direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Coluna Esquerda: Campos do Formulário */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome do Modelo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Nome / Título do Modelo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Apresentação Frente Mar"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-50 text-xs rounded-xl px-3.5 py-2.5 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition"
                    />
                  </div>

                  {/* Atalho no Chat */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Atalho de Digitação *</span>
                      <span className="text-[10px] text-slate-400 font-mono">Inicia com /</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="/frentemar"
                      value={formShortcut}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (!val.startsWith('/')) val = `/${val}`;
                        setFormShortcut(val.toLowerCase().replace(/\s+/g, ''));
                      }}
                      className="w-full bg-slate-50 text-xs font-mono font-bold text-[#3742AC] rounded-xl px-3.5 py-2.5 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition"
                    />
                  </div>
                </div>

                {/* Contexto / Categoria */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Contexto / Categoria Comercial
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as QuickReplyCategory[]).map(catKey => {
                      const meta = CATEGORY_CONFIG[catKey];
                      const isSelected = formCategory === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setFormCategory(catKey)}
                          className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isSelected 
                              ? 'border-[#3742AC] bg-indigo-50 text-[#3742AC] shadow-2xs' 
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span>{meta.icon}</span>
                          <span className="truncate">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Imagem / Anexo Opcional */}
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#3742AC]" />
                      <span>Imagem / Anexo do Modelo (Fachadas, Plantas ou Decorado)</span>
                    </label>
                    {formImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormImageUrl('');
                          setImageError(false);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        Remover imagem
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    {formImageUrl && !imageError ? (
                      <div className="relative w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden shrink-0 bg-slate-100 group shadow-xs">
                        <img 
                          src={formImageUrl} 
                          alt="Pré-visualização" 
                          className="w-full h-full object-cover"
                          onError={() => setImageError(true)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold pointer-events-none">
                          Preview
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0 bg-white">
                        <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[9px]">Sem imagem</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#3742AC]" />
                          <span>Fazer Upload de Foto</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileUpload}
                          className="hidden"
                        />
                        <span className="text-[11px] text-slate-400">ou insira a URL abaixo</span>
                      </div>

                      <input
                        type="url"
                        placeholder="https://exemplo.com/foto-empreendimento.jpg"
                        value={formImageUrl}
                        onChange={(e) => {
                          setFormImageUrl(e.target.value);
                          setImageError(false);
                        }}
                        className="w-full bg-white text-xs rounded-xl px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Conteúdo / Mensagem */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Texto da Mensagem *
                    </label>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {formContent.length} caracteres
                    </div>
                  </div>

                  {/* Botões de Variáveis Dinâmicas */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Inserir Variável:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{nome}')}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-[#3742AC] border border-indigo-200 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                      title="Insere o primeiro nome do cliente"
                    >
                      + {'{nome}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{corretor}')}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                      title="Insere seu nome de corretor"
                    >
                      + {'{corretor}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{imobiliaria}')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                      title="Insere o nome da imobiliária"
                    >
                      + {'{imobiliaria}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{telefone}')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                      title="Insere o telefone do cliente"
                    >
                      + {'{telefone}'}
                    </button>
                  </div>

                  <textarea
                    ref={textareaRef}
                    required
                    rows={6}
                    placeholder="Olá {nome}! Tudo bem? Me chamo {corretor}, da {imobiliaria}..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full bg-slate-50 text-xs rounded-xl p-3.5 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition leading-relaxed resize-y font-normal"
                  />
                </div>

                {/* Ações Salvar / Cancelar */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#3742AC] hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Modelo</span>
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Simulador Realista WhatsApp */}
              <div className="lg:col-span-5 bg-slate-100 p-4 rounded-3xl border border-slate-200 space-y-3 sticky top-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#3742AC]" />
                    <span>Simulação Real no WhatsApp</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    Lead View
                  </span>
                </div>

                <div className="bg-[#EFEAE2] rounded-2xl p-4 border border-slate-200/80 shadow-inner space-y-3 min-h-[340px] flex flex-col justify-end">
                  <div className="bg-[#E7FFDB] p-3.5 rounded-2xl max-w-full shadow-sm border border-emerald-300/50 space-y-2.5 self-end">
                    {formImageUrl && !imageError && (
                      <div className="rounded-xl overflow-hidden max-h-56 w-full bg-slate-200 border border-emerald-300/40">
                        <img src={formImageUrl} alt="Preview anexo" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed font-sans">
                      {formContent
                        ? formContent
                            .replace(/{nome}/g, 'Rafael')
                            .replace(/{corretor}/g, currentUser?.name?.split(' ')[0] || 'Corretor')
                            .replace(/{imobiliaria}/g, currentTenant?.name || 'Imobiliária')
                            .replace(/{telefone}/g, '(11) 98765-4321')
                        : 'O texto digitado ao lado aparecerá aqui formatado em tempo real, simulando exatamente a tela do cliente no WhatsApp.'}
                    </p>
                    <div className="text-[10px] text-slate-400 text-right font-mono flex items-center justify-end gap-1">
                      <span>15:40</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed space-y-1">
                  <p className="font-bold text-slate-700 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>Dica de Alta Conversão</span>
                  </p>
                  <p>
                    Modelos com fotos de fachadas e plantas anexadas aumentam o engajamento e a taxa de resposta dos leads no WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* ======================================================== */
          /* LISTA E GERENCIAMENTO DOS MODELOS EXISTENTES             */
          /* ======================================================== */
          <div className="space-y-4">
            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por atalho, título ou texto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3742AC]/20 focus:border-[#3742AC] transition shadow-2xs"
                />
              </div>

              {/* Categorias */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedCategory === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Todos ({quickReplies.length})
                </button>
                {(Object.keys(CATEGORY_CONFIG) as QuickReplyCategory[]).map(catKey => {
                  const meta = CATEGORY_CONFIG[catKey];
                  const isSel = selectedCategory === catKey;
                  const count = quickReplies.filter(q => q.category === catKey).length;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setSelectedCategory(catKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                        isSel
                          ? 'bg-[#3742AC] text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className={`text-[10px] px-1.5 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid de Modelos com 3 Colunas no Desktop */}
            {filteredTemplates.length === 0 ? (
              <div className="bg-white rounded-3xl p-14 text-center border border-slate-200 space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-[#3742AC]">
                  <Zap className="w-7 h-7 fill-[#3742AC]" />
                </div>
                <h4 className="text-base font-bold text-slate-800">Nenhum modelo encontrado</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {searchQuery
                    ? 'Tente utilizar outros termos na busca ou alterne o filtro de categoria.'
                    : 'Cadastre seu primeiro modelo de resposta rápida para acelerar o atendimento pelo WhatsApp com atalhos e fotos!'}
                </p>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-1.5 bg-[#3742AC] hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Modelo</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredTemplates.map(template => {
                  const catMeta = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.GREETING;
                  const isActive = template.isActive !== false;

                  return (
                    <div
                      key={template.id}
                      className={`bg-white rounded-2xl border p-4 transition-all shadow-2xs flex flex-col justify-between relative group ${
                        isActive
                          ? 'border-slate-200/90 hover:border-indigo-300'
                          : 'border-slate-200 bg-slate-50/70 opacity-75'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Linha Superior: Atalho + Categoria + Status */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleCopyShortcut(template.shortcut)}
                              className="font-mono font-extrabold text-xs px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-[#3742AC] border border-indigo-200/80 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="Clique para copiar atalho"
                            >
                              <span>{template.shortcut}</span>
                              {copiedShortcut === template.shortcut ? (
                                <span className="text-[9px] text-emerald-600 font-sans font-bold">Copiado!</span>
                              ) : (
                                <Copy className="w-3 h-3 text-indigo-400 group-hover:text-[#3742AC]" />
                              )}
                            </button>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catMeta.color} truncate`}>
                              {catMeta.icon} {catMeta.label}
                            </span>
                          </div>

                          {/* Toggle Ativar/Desativar */}
                          <button
                            type="button"
                            onClick={() => toggleQuickReplyActive(template.id)}
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                            }`}
                            title={isActive ? 'Clique para desativar' : 'Clique para ativar'}
                          >
                            {isActive ? '● Ativo' : '○ Inativo'}
                          </button>
                        </div>

                        {/* Título do Modelo */}
                        <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                          {template.title}
                        </h4>

                        {/* Conteúdo com Preview de Imagem se houver */}
                        <div className="flex items-start gap-2.5">
                          {template.imageUrl && (
                            <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-100 shadow-2xs">
                              <img 
                                src={template.imageUrl} 
                                alt={template.title} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed flex-1">
                            {template.content}
                          </p>
                        </div>
                      </div>

                      {/* Rodapé do Card: Ações */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 font-mono">
                          {template.imageUrl ? '📷 Possui imagem' : '💬 Apenas texto'}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onSelectTemplate && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTemplate(template);
                                onClose?.();
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition cursor-pointer"
                              title="Usar este modelo agora"
                            >
                              Aplicar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEdit(template)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Editar modelo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {deleteConfirmId === template.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                              <span className="text-[10px] text-rose-700 font-bold">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteQuickReply(template.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[10px] font-semibold text-slate-500 hover:underline ml-1 cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(template.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir modelo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1600px] h-[95vh] max-h-[980px] flex flex-col">
        {content}
      </div>
    </div>
  );
}
