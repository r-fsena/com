'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crm-context';
import { 
  QrCode, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Zap, 
  ShieldCheck, 
  Battery, 
  Wifi, 
  ExternalLink,
  MessageSquare,
  Key
} from 'lucide-react';

interface ZapiQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZapiQrCodeModal({ isOpen, onClose }: ZapiQrCodeModalProps) {
  const { currentTenant, instances, syncZapiInstance } = useCRM();
  const [activeTab, setActiveTab] = useState<'QR' | 'CREDENTIALS'>('QR');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(instances[0]?.status === 'CONNECTED');
  const [countdown, setCountdown] = useState(25);
  const [connectedPhone, setConnectedPhone] = useState('+55 11 99123-4567');
  const [batteryLevel, setBatteryLevel] = useState(98);

  // Form de Credenciais
  const [instanceId, setInstanceId] = useState(instances[0]?.zapiInstanceId || '3D8F2A1B4C5E6D7E8F9A0B1C');
  const [instanceToken, setInstanceToken] = useState('A1B2C3D4E5F6789012345678');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Contador para simular expiração e atualização de QR Code
  useEffect(() => {
    if (!isOpen || isConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 25;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isConnected]);

  if (!isOpen) return null;

  const handleSimulatePairing = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsConnected(true);
      setIsLoading(false);
      syncZapiInstance(instances[0]?.id || 'inst-1');
    }, 1200);
  };

  const handleDisconnect = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsConnected(false);
      setIsLoading(false);
      setCountdown(25);
    }, 800);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header com gradiente WhatsApp Business */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 transition text-emerald-100"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <QrCode className="w-4 h-4 text-emerald-100" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              Conexão WhatsApp Z-API
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Vincular WhatsApp da Imobiliária
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1">
            Empresa: <strong className="text-white">{currentTenant.name}</strong>
          </p>

          {/* Abas */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
            <button
              onClick={() => setActiveTab('QR')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                activeTab === 'QR'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-white/10 text-emerald-100 hover:bg-white/20'
              }`}
            >
              Escanear QR Code
            </button>
            <button
              onClick={() => setActiveTab('CREDENTIALS')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'CREDENTIALS'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-white/10 text-emerald-100 hover:bg-white/20'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Chaves da Instância</span>
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6">
          {activeTab === 'QR' ? (
            <div>
              {isConnected ? (
                /* Estado Conectado com Sucesso */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      WhatsApp Conectado com Sucesso!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Sua sessão Z-API está ativa e pronta para receber e enviar mensagens.
                    </p>
                  </div>

                  {/* Informações da Sessão */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 max-w-sm mx-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Número Vinculado:</span>
                      <span className="font-bold text-slate-800 font-mono">{connectedPhone}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Bateria do Aparelho:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Battery className="w-4 h-4" /> {batteryLevel}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Status do Webhook:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                        OPERACIONAL
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-md active:scale-95"
                    >
                      Ir para Caixa de Entrada
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={isLoading}
                      className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl transition border border-rose-200"
                    >
                      {isLoading ? 'Desconectando...' : 'Desconectar Sessão'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Estado Aguardando Leitura do QR Code */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                    {/* Visualizador de QR Code */}
                    <div className="flex flex-col items-center">
                      <div className="relative p-4 bg-white rounded-2xl shadow-md border-2 border-dashed border-emerald-400/80 group">
                        {/* Imagem do QR Code Dinâmico */}
                        <div className="w-44 h-44 bg-slate-900 rounded-xl p-2 flex items-center justify-center shadow-inner relative overflow-hidden">
                          <svg className="w-full h-full text-white" viewBox="0 0 100 100" fill="currentColor">
                            <rect width="100" height="100" fill="#ffffff" />
                            {/* Marcadores de Canto QR */}
                            <rect x="8" y="8" width="28" height="28" fill="#0f172a" rx="4" />
                            <rect x="12" y="12" width="20" height="20" fill="#ffffff" rx="2" />
                            <rect x="16" y="16" width="12" height="12" fill="#059669" rx="2" />

                            <rect x="64" y="8" width="28" height="28" fill="#0f172a" rx="4" />
                            <rect x="68" y="12" width="20" height="20" fill="#ffffff" rx="2" />
                            <rect x="72" y="16" width="12" height="12" fill="#059669" rx="2" />

                            <rect x="8" y="64" width="28" height="28" fill="#0f172a" rx="4" />
                            <rect x="12" y="68" width="20" height="20" fill="#ffffff" rx="2" />
                            <rect x="16" y="72" width="12" height="12" fill="#059669" rx="2" />

                            {/* Padrões internos do QR Code */}
                            <rect x="42" y="12" width="8" height="16" fill="#0f172a" />
                            <rect x="42" y="36" width="16" height="8" fill="#0f172a" />
                            <rect x="12" y="42" width="16" height="8" fill="#0f172a" />
                            <rect x="42" y="52" width="8" height="24" fill="#059669" />
                            <rect x="64" y="42" width="24" height="8" fill="#0f172a" />
                            <rect x="58" y="64" width="12" height="12" fill="#0f172a" />
                            <rect x="76" y="64" width="16" height="8" fill="#059669" />
                            <rect x="76" y="78" width="16" height="14" fill="#0f172a" />
                            <rect x="42" y="84" width="24" height="8" fill="#0f172a" />
                          </svg>

                          {/* Linha de Scanner Animada */}
                          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400 animate-bounce top-2" />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2.5 font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>Atualiza em <strong className="text-emerald-700 font-mono">{countdown}s</strong></span>
                      </div>
                    </div>

                    {/* Instruções Passo a Passo */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                        Como Conectar:
                      </h3>
                      <ol className="space-y-2.5 text-xs text-slate-700">
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                            1
                          </span>
                          <span>Abra o <strong>WhatsApp</strong> no celular da imobiliária.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                            2
                          </span>
                          <span>Toque em <strong>Configurações</strong> e selecione <strong>Aparelhos Conectados</strong>.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                            3
                          </span>
                          <span>Toque em <strong>Conectar Aparelho</strong> e aponte a câmera para o QR Code ao lado.</span>
                        </li>
                      </ol>

                      {/* Botão de Pareamento Imediato para Testes */}
                      <button
                        onClick={handleSimulatePairing}
                        disabled={isLoading}
                        className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Validando Conexão WhatsApp...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Simular Leitura do QR Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Aba de Configuração das Chaves Z-API */
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instance ID (Z-API)
                </label>
                <input
                  type="text"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="Ex: 3D8F2A1B4C5E6D7E8F9A0B1C"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instance Token (Z-API)
                </label>
                <input
                  type="password"
                  value={instanceToken}
                  onChange={(e) => setInstanceToken(e.target.value)}
                  placeholder="Ex: A1B2C3D4E5F6789012345678"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {savedSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Credenciais Z-API salvas com sucesso!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('QR')}
                  className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-xl"
                >
                  Voltar ao QR Code
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-xs active:scale-95"
                >
                  Salvar e Gerar Novo QR Code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
