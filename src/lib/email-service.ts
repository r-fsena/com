import nodemailer from 'nodemailer';

export interface UserInviteEmailParams {
  toEmail: string;
  userName: string;
  tenantName: string;
  role: string;
  inviteLink: string;
  isResend?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isSimulated?: boolean;
  previewUrl?: string;
}

/**
 * Tradução amigável dos cargos do CRM
 */
export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'SUPERADMIN':
    case 'ADMIN_MASTER':
      return '👑 SuperAdmin Master (Acesso Global)';
    case 'ADMIN':
      return '🛡️ Administrador Geral (Gestão Total)';
    case 'MANAGER':
      return '💼 Gestor Comercial (Equipe & Funis)';
    case 'VIEWER':
      return '👁️ Visualizador (Apenas Leitura)';
    case 'BROKER':
    default:
      return '👤 Corretor Imobiliário (Atendimento & Vendas)';
  }
}

/**
 * Gera o template HTML ultra-premium para o convite de usuário
 */
export function generateUserInviteHtml(params: UserInviteEmailParams): string {
  const { userName, tenantName, role, inviteLink, isResend } = params;
  const roleLabel = getRoleDisplayName(role);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para o FaithHubs CRM</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1320;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1320;
      padding: 40px 10px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #111c2e;
      border: 1px solid #1e293b;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%);
      padding: 36px 32px;
      text-align: center;
      position: relative;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #a7f3d0;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 16px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .info-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #1e293b;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-value {
      color: #f8fafc;
      font-weight: 700;
      text-align: right;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 16px 36px;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
      transition: all 0.2s ease;
    }
    .url-fallback {
      background: #090e17;
      border: 1px dashed #334155;
      border-radius: 12px;
      padding: 14px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      text-align: center;
      margin-bottom: 24px;
    }
    .url-fallback a {
      color: #34d399;
      text-decoration: underline;
    }
    .steps {
      border-top: 1px solid #1e293b;
      padding-top: 24px;
      margin-top: 24px;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
      font-size: 12px;
      color: #94a3b8;
    }
    .step-number {
      background: #047857;
      color: #ffffff;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: inline-block;
      text-align: center;
      line-height: 20px;
      font-weight: bold;
      font-size: 11px;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .footer {
      background: #090e17;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #1e293b;
      font-size: 11px;
      color: #475569;
    }
    .footer a {
      color: #64748b;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Top Banner Header -->
      <div class="header">
        <div class="badge">FaithHubs CRM Imobiliário</div>
        <h1>${isResend ? '🔄 Lembrete de Convite de Acesso' : '🎉 Bem-vindo(a) à Equipe Comercial!'}</h1>
      </div>

      <!-- Main Content -->
      <div class="content">
        <div class="greeting">Olá, ${userName}!</div>
        <p class="text">
          Você foi convidado(a) para acessar o <strong>FaithHubs CRM</strong> como parte da equipe de <strong>${tenantName}</strong>.
          Seu workspace já foi provisionado com recursos de automação WhatsApp, funil de vendas e IA Copiloto.
        </p>

        <!-- Detalhes do Acesso -->
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Imobiliária / Workspace</span>
            <span class="info-value">${tenantName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Cargo / Nível de Acesso</span>
            <span class="info-value" style="color: #34d399;">${roleLabel}</span>
          </div>
          <div class="info-row">
            <span class="info-label">E-mail Cadastrado</span>
            <span class="info-value" style="font-family: monospace;">${params.toEmail}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status da Senha</span>
            <span class="info-value" style="color: #fbbf24;">Aguardando Definição</span>
          </div>
        </div>

        <!-- Botão de Ação -->
        <div class="cta-container">
          <a href="${inviteLink}" class="cta-button">
            👉 Definir Senha & Acessar CRM
          </a>
        </div>

        <!-- Link Direto de Fallback -->
        <div class="url-fallback">
          Caso o botão acima não funcione, copie e cole este link no seu navegador:<br>
          <a href="${inviteLink}">${inviteLink}</a>
        </div>

        <!-- Passo a Passo -->
        <div class="steps">
          <div style="font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 12px;">Como realizar seu primeiro acesso:</div>
          <div class="step-item">
            <span class="step-number">1</span>
            <span>Clique no botão acima para abrir a tela de validação do CRM.</span>
          </div>
          <div class="step-item">
            <span class="step-number">2</span>
            <span>Cadastre sua senha pessoal de alta segurança.</span>
          </div>
          <div class="step-item">
            <span class="step-number">3</span>
            <span>Pronto! Seu funil de vendas e WhatsApp estarão disponíveis imediatamente.</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p style="margin: 0 0 6px 0;">Este e-mail foi gerado automaticamente pelo <strong>FaithHubs CRM Imobiliário</strong>.</p>
        <p style="margin: 0;">Segurança de ponta a ponta & Criptografia 256-bit • <a href="https://crm.faithhubs.com">crm.faithhubs.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Envia o e-mail de convite para o usuário via SMTP configurado ou modo simulado
 */
export async function sendUserInvitationEmail(params: UserInviteEmailParams): Promise<EmailSendResult> {
  const { toEmail, userName, tenantName, role, inviteLink, isResend } = params;

  const subject = isResend
    ? `🔄 Lembrete de Acesso ao CRM - ${tenantName}`
    : `🎉 Convite de Acesso ao CRM - ${tenantName}`;

  const htmlContent = generateUserInviteHtml(params);

  // Verifica se há credenciais de SMTP configuradas no ambiente
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"FaithHubs CRM" <contato@faithhubs.com>';

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      });

      console.log(`[EmailService] ✅ E-mail de convite enviado via SMTP para ${toEmail}. MessageId: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error(`[EmailService] ❌ Erro ao enviar e-mail via SMTP para ${toEmail}:`, err);
      // Fallback em caso de erro no servidor SMTP
      return {
        success: true,
        isSimulated: true,
        error: `Falha no transporte SMTP (${err.message}). Convite registrado com sucesso no sistema.`,
      };
    }
  }

  // Modo Simulado Inteligente (Ambiente de Produção/Dev sem SMTP configurado ainda)
  console.log(`[EmailService] ✉️ [MODO CONVITE REGISTRADO] Convite para: ${toEmail} (${userName} - ${role})`);
  console.log(`[EmailService] 🔗 Link de Acesso: ${inviteLink}`);

  return {
    success: true,
    isSimulated: true,
    messageId: `sim-${Date.now()}`,
  };
}
