'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  Smartphone,
  QrCode,
  Wifi,
  ShieldCheck,
  RefreshCw,
  Send,
  Trash2,
  Check,
  AlertTriangle,
  Key,
  Copy,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  Link2,
  Radio,
  LogOut,
  BatteryCharging
} from 'lucide-react';

export function WhatsAppConnectionView() {
  const { 
    currentTenant, 
    instances, 
    updateInstance,
    refreshLiveZapiStatus,
    isZapiConnected: crmZapiConnected,
    zapiLiveDetails,
    syncWhatsAppChats, 
    resetCRMDatabase,
    isSyncingWhatsApp 
  } = useCRM();

  const activeInstance = instances[0];
  const [instanceIdInput, setInstanceIdInput] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Estados detalhados de status ao vivo sincronizados com o contexto global
  const [liveDetails, setLiveDetails] = useState<{
    connected: boolean;
    phone: string;
    name: string;
    avatarUrl?: string | null;
    deviceModel?: string;
    battery?: number;
    isBusiness?: boolean;
  } | null>(() => {
    if (zapiLiveDetails) {
      return {
        connected: Boolean(zapiLiveDetails.connected),
        phone: zapiLiveDetails.phone || activeInstance?.phoneNumber || '+55 (48) 8877-4408',
        name: zapiLiveDetails.name || activeInstance?.name || 'Rafael Sena',
        avatarUrl: zapiLiveDetails.avatarUrl || null,
        deviceModel: zapiLiveDetails.deviceModel || 'Smartphone',
        battery: zapiLiveDetails.battery || 100,
        isBusiness: Boolean(zapiLiveDetails.isBusiness),
      };
    }
    return null;
  });

  // Estados do QR Code ao vivo
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isQrConnected, setIsQrConnected] = useState<boolean>(Boolean(crmZapiConnected || activeInstance?.status === 'CONNECTED'));

  // Teste de Envio
  const [testPhone, setTestPhone] = useState('554888774408');
  const [testMessage, setTestMessage] = useState('Olá! Teste de conexão do Vanguard CRM via Z-API.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-configuração de Webhooks
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [autoConfigSuccess, setAutoConfigSuccess] = useState(false);

  // Desconexão
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Reset de Base
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const officialWebhookUrl = 'https://crm.faithhubs.com/api/v1/webhooks/zapi';

  // Busca inicial do QR Code caso a linha esteja desconectada
  const fetchFreshQrCode = async () => {
    setIsLoadingQr(true);
    try {
      const qrRes = await fetch('/api/v1/zapi/qr-code');
      const qrData = await qrRes.json();
      if (qrData.success) {
        if (qrData.connected) {
          setIsQrConnected(true);
          setQrCodeData(null);
        } else if (qrData.qrCode) {
          setQrCodeData(qrData.qrCode);
        }
      }
    } catch {
      console.warn('Falha ao buscar QR Code');
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Consulta e sincronização de status em tempo real
  const handleRefreshAllStatus = async () => {
    setIsLoadingQr(true);
    try {
      const res = await fetch('/api/v1/zapi/status');
      const data = await res.json();
      if (data.success) {
        const isConn = Boolean(data.connected);
        setIsQrConnected(isConn);
        setLiveDetails({
          connected: isConn,
          phone: data.phone || '+55 (48) 8877-4408',
          name: data.name || 'Rafael Sena',
          avatarUrl: data.avatarUrl || null,
          deviceModel: data.deviceModel || 'iPhone',
          battery: data.battery || 100,
          isBusiness: Boolean(data.isBusiness),
        });

        if (isConn) {
          setQrCodeData(null);
          updateInstance(activeInstance?.id || 'inst-amabile-central', {
            status: 'CONNECTED',
            phoneNumber: data.phone || '+55 (48) 8877-4408',
            name: data.name || activeInstance?.name || 'Linha Principal',
            lastSyncAt: new Date().toISOString(),
          });
        } else {
          updateInstance(activeInstance?.id || 'inst-amabile-central', {
            status: 'DISCONNECTED',
            lastSyncAt: new Date().toISOString(),
          });
          await fetchFreshQrCode();
        }
      }
      await refreshLiveZapiStatus();
    } catch {
      console.warn('Falha ao checar status da Z-API');
    } finally {
      setIsLoadingQr(false);
    }
  };

  useEffect(() => {
    if (activeInstance) {
      setInstanceIdInput(activeInstance.zapiInstanceId || activeInstance.id || '');
    }
    handleRefreshAllStatus();
  }, []);

  const isConnected = Boolean(liveDetails?.connected ?? (isQrConnected || crmZapiConnected || activeInstance?.status === 'CONNECTED'));

  // Polling em segundo plano enquanto desconectado para auto-detecção instantânea da leitura do QR Code
  useEffect(() => {
    if (isConnected) return;
    if (!qrCodeData) {
      fetchFreshQrCode();
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/zapi/status');
        const data = await res.json();
        if (data.success && data.connected) {
          setIsQrConnected(true);
          setQrCodeData(null);
          setLiveDetails({
            connected: true,
            phone: data.phone || '+55 (48) 8877-4408',
            name: data.name || 'Rafael Sena',
            avatarUrl: data.avatarUrl || null,
            deviceModel: data.deviceModel || 'iPhone',
            battery: data.battery || 100,
            isBusiness: Boolean(data.isBusiness),
          });
          await refreshLiveZapiStatus();
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [isConnected, qrCodeData]);

  const displayPhone = liveDetails?.phone || activeInstance?.phoneNumber || '+55 (48) 8877-4408';
  const displayName = liveDetails?.name || activeInstance?.name || 'Rafael Sena';
  const displayDevice = liveDetails?.deviceModel || 'Apple iPhone';

  // Enviar Mensagem de Teste
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) return;

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/zapi/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_text',
          phone: testPhone.replace(/\D/g, ''),
          message: testMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Mensagem enviada com sucesso! Z-API ID: ${data.result?.zaapId || data.result?.messageId || 'OK'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Erro ao disparar mensagem de teste.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha de comunicação com o gateway.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Configuração Automática de Webhook na Z-API
  const handleAutoConfigureWebhooks = async () => {
    setIsAutoConfiguring(true);
    setAutoConfigSuccess(false);

    try {
      const res = await fetch('/api/v1/zapi/auto-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: activeInstance?.zapiInstanceId,
          webhookUrl: officialWebhookUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAutoConfigSuccess(true);
        setTimeout(() => setAutoConfigSuccess(false), 5000);
      } else {
        alert(`Erro na configuração: ${data.error || 'Não foi possível configurar os webhooks'}`);
      }
    } catch (err: any) {
      alert(`Falha de rede: ${err.message || 'Erro ao comunicar com a Z-API'}`);
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  // Desconectar Sessão da Z-API
  const handleDisconnectSession = async () => {
    setIsDisconnecting(true);
    setShowConfirmDisconnect(false);
    try {
      const res = await fetch('/api/v1/zapi/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: activeInstance?.zapiInstanceId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsQrConnected(false);
        setLiveDetails(null);
        updateInstance(activeInstance?.id || 'inst-amabile-central', {
          status: 'DISCONNECTED',
          lastSyncAt: new Date().toISOString()
        });
        await handleRefreshAllStatus();
      }
    } catch {
      alert('Falha ao desconectar sessão da Z-API');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-[#F0F3FA]">
      
      {/* Header Principal Sovereign */}
      <div className="bg-transparent px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3742AC] text-white flex items-center justify-center shadow-md shadow-indigo-950/10">
            <Radio className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">Conexão & Gateway Z-API WhatsApp</h1>
              {isConnected ? (
                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Instância Conectada Ao Vivo</span>
                </span>
              ) : (
                <span className="text-xs font-bold bg-white text-rose-700 border border-rose-200 px-3 py-0.5 rounded-full shadow-2xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Desconectado</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie a instância ativa do WhatsApp, leitura de QR Code, webhooks oficiais e envio de testes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAllStatus}
          disabled={isLoadingQr}
          className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold px-5 py-2.5 rounded-full transition shadow-md shadow-indigo-950/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
          <span>Atualizar Status</span>
        </button>
      </div>

      {/* Conteúdo com Grid Responsivo */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        
        {/* Grid Superior: Card de Conexão + QR Code / Status do Aparelho */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card de Status da Linha Conectada */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className={`w-5 h-5 ${isConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
                <h3 className="text-sm font-bold text-slate-900">Instância de Produção Oficial</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-xl">
                {activeInstance?.name || 'Linha Principal'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Status da Conexão</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className={`text-sm font-bold ${isConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isConnected ? 'ONLINE / CONECTADO' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Número Pareado</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-1 block">
                  {displayPhone}
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Última Sincronização</span>
                <span className="text-sm font-medium text-slate-700 mt-1 block">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Ao vivo
                </span>
              </div>
            </div>

            {/* Configuração de Webhook Oficial */}
            <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                  <span>Endpoint de Webhook Oficial do CRM</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleAutoConfigureWebhooks}
                  disabled={isAutoConfiguring}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isAutoConfiguring ? 'animate-spin' : ''}`} />
                  <span>{isAutoConfiguring ? 'Configurando...' : 'Auto-Configurar na Z-API'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl p-2.5 text-xs font-mono text-slate-800">
                <span className="flex-1 truncate">{officialWebhookUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(officialWebhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition cursor-pointer"
                  title="Copiar URL"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {autoConfigSuccess && (
                <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Webhooks de mensagem e status configurados automaticamente com sucesso na Z-API!
                </p>
              )}
            </div>
          </div>

          {/* Card do QR Code / Aparelho Conectado (Central Unificada) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
            <div className="flex items-center justify-between w-full border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <QrCode className="w-4 h-4 text-[#3742AC]" />
                <span>{isConnected ? 'Aparelho Conectado' : 'Pareamento via QR Code'}</span>
              </div>
              {!isConnected && (
                <button
                  type="button"
                  onClick={fetchFreshQrCode}
                  disabled={isLoadingQr}
                  className="text-[11px] font-bold text-[#3742AC] hover:text-[#2D368E] hover:bg-indigo-50 px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Recarregar QR Code"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingQr ? 'animate-spin' : ''}`} />
                  <span>Recarregar</span>
                </button>
              )}
            </div>

            {isLoadingQr && !qrCodeData && !isConnected ? (
              <div className="py-12 space-y-3">
                <RefreshCw className="w-9 h-9 text-[#3742AC] animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Gerando QR Code oficial da Z-API...</p>
                <p className="text-[11px] text-slate-400">Aguarde alguns instantes</p>
              </div>
            ) : isConnected ? (
              <div className="py-2 space-y-4 w-full">
                <div className="relative mx-auto w-20 h-20">
                  <img
                    src={liveDetails?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3742AC&color=fff`}
                    alt={displayName}
                    className="w-20 h-20 rounded-3xl object-cover shadow-md ring-4 ring-emerald-100 mx-auto"
                  />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-xs shadow-xs font-bold" title="Conectado Ao Vivo">
                    ✓
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-slate-900">{displayName}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{displayPhone}</p>
                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{displayDevice} • Sessão Ativa</span>
                    </span>
                    {liveDetails?.battery !== undefined && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <BatteryCharging className="w-3 h-3 text-emerald-600" />
                        <span>{liveDetails.battery}%</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Sua conta do WhatsApp está 100% pareada e operacional. Mensagens, fotos e áudios são sincronizados em tempo real com o CRM.
                </p>

                <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => syncWhatsAppChats()}
                    disabled={isSyncingWhatsApp}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWhatsApp ? 'animate-spin' : ''}`} />
                    <span>{isSyncingWhatsApp ? 'Sincronizando...' : 'Sincronizar Mensagens'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDisconnect(true)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>
            ) : qrCodeData ? (
              <div className="space-y-4 w-full">
                <div className="relative inline-block mx-auto bg-white p-3 rounded-2xl border-2 border-indigo-100 shadow-sm">
                  <img
                    src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52 rounded-xl mx-auto object-contain"
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-xs whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Aguardando leitura do celular...</span>
                  </div>
                </div>

                {/* Passo a Passo Ilustrado */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left text-xs space-y-2 mt-2">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">Como Conectar:</span>
                  <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-[#3742AC] font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <span>Abra o WhatsApp no seu smartphone</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-[#3742AC] font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <span>Toque no Menu (ou Ajustes) e escolha <b>Aparelhos Conectados</b></span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-[#3742AC] font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                    <span>Toque em <b>Conectar um Aparelho</b> e aponte para este QR Code</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-3">
                <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Nenhum QR Code pendente no momento.</p>
                <button
                  type="button"
                  onClick={fetchFreshQrCode}
                  className="text-xs font-bold text-[#3742AC] hover:underline"
                >
                  Gerar novo QR Code
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Grid Inferior: Teste de Envio + Zona de Manutenção */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card de Teste de Disparo Imediato */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Send className="w-4 h-4 text-[#3742AC]" />
              <h3 className="text-sm font-bold text-slate-900">Disparo de Mensagem de Teste</h3>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Telefone de Destino (com DDD):</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="554888774408"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mensagem:</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3742AC] resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="bg-[#3742AC] hover:bg-[#2D368E] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-pulse' : ''}`} />
                  <span>{isSendingTest ? 'Disparando...' : 'Enviar Mensagem de Teste'}</span>
                </button>

                {testResult && (
                  <span className={`text-xs font-bold ${testResult.success ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {testResult.success ? '✅ Enviado!' : '❌ Falha ao enviar'}
                  </span>
                )}
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  {testResult.message}
                </div>
              )}
            </form>
          </div>

          {/* Card de Higienização e Limpeza de Base */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Higienização e Reset da Base de Testes</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zere todos os contatos e conversas antigas em cache para recarregar uma base 100% limpa direto do WhatsApp.
                  </p>
                </div>
              </div>

              <div className="bg-white/80 rounded-2xl p-4 border border-rose-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> A instância conectada continuará ativa
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> O cache de contatos sujos será completamente zerado
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                disabled={isResetting}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-3 rounded-2xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Higienizando...' : 'Zerar Base & Resincronizar WhatsApp'}</span>
              </button>

              {resetSuccess && (
                <div className="mt-3 bg-emerald-100 text-emerald-800 text-xs font-bold p-3 rounded-xl border border-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Base de dados resetada com sucesso e sincronização limpa concluída!</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Modal de Confirmação para Desconectar */}
      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Desconectar WhatsApp?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                A sessão ativa do WhatsApp será encerrada no gateway Z-API. Para voltar a enviar e receber mensagens, será necessário ler um novo QR Code.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDisconnect(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisconnectSession}
                disabled={isDisconnecting}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isDisconnecting ? 'Desconectando...' : 'Sim, Desconectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Reset */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Confirmar Limpeza da Base?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Todos os contatos, conversas e mensagens antigas serão excluídos do cache do CRM. O sistema fará uma nova puxada limpa diretamente da instância oficial do WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmReset(false);
                  setIsResetting(true);
                  await resetCRMDatabase(true);
                  setIsResetting(false);
                  setResetSuccess(true);
                  setTimeout(() => setResetSuccess(false), 4000);
                }}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                Sim, Limpar e Resincronizar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
