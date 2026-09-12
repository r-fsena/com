import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UniversalCopilotService } from '@/lib/ai-provider-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { TenantAIConfig } from '@/types/crm';
import { serverCRMStore } from '@/lib/server-crm-store';

const AnalyzeConversationSchema = z.object({
  chatHistory: z.array(z.object({
    sender: z.enum(['CLIENT', 'BROKER']),
    text: z.string(),
  })).min(1, 'Histórico de mensagens é obrigatório'),
  brokerName: z.string().default('Corretor'),
  contactContext: z.object({
    name: z.string().optional(),
    tags: z.array(z.string()).optional(),
    whatsappLabels: z.array(z.string()).optional(),
    monthlyIncome: z.number().optional(),
    downPaymentAvailable: z.number().optional(),
    maxPropertyValue: z.number().optional(),
    preferredPropertyType: z.string().optional(),
    targetRegions: z.array(z.string()).optional(),
  }).optional(),
  priorContext: z.object({
    priorSummary: z.string().optional(),
    priorExtractedData: z.any().optional(),
  }).optional(),
  aiConfig: z.object({
    provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'PLATFORM_DEFAULT']),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    tone: z.enum(['CONSULTATIVE', 'CLOSER', 'PERSUASIVE', 'ELEGANT', 'FRIENDLY', 'TECHNICAL']).default('CONSULTATIVE'),
    objective: z.enum(['AGENDAR_VISITA', 'SIMULAR_FINANCIAMENTO', 'QUALIFICAR', 'EQUILIBRADO']).default('EQUILIBRADO'),
    customInstructions: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enabled: z.boolean().default(true),
  }).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Rate Limiting (Máx 45 requisições por minuto por IP para proteção de custos de IA)
  const clientIp = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`copilot:${clientIp}`, 45, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      error: 'Limite de requisições à IA atingido',
      message: `Muitas solicitações em sequência. Aguarde ${rateCheck.resetInSeconds} segundos.`,
    }, { status: 429 });
  }

  // 2. Validação Estrita de Sessão & RBAC
  const { session, errorResponse } = validateApiSession(request, {
    requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const validated = AnalyzeConversationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Dados inválidos para análise de IA', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { chatHistory, brokerName, contactContext, aiConfig, priorContext } = validated.data;

    // Busca configurações da Persona do Corretor (Prompt Comportamental, Tom de Voz, Regras Comerciais)
    const allUsers = serverCRMStore.getUsers();
    let matchedUser = allUsers.find(u => 
      (session?.userId && u.id === session.userId) ||
      (session?.userEmail && u.email && u.email.toLowerCase() === session.userEmail.toLowerCase())
    );

    if (!matchedUser && brokerName && brokerName !== 'Corretor') {
      const normBroker = brokerName.toLowerCase().trim();
      matchedUser = allUsers.find(u => 
        u.name.toLowerCase().trim() === normBroker ||
        u.name.toLowerCase().includes(normBroker) ||
        normBroker.includes(u.name.toLowerCase())
      );
    }

    // Monta o bloco de instruções comportamentais e regras de fechamento da persona
    const customInstructionsParts: string[] = [];

    if (aiConfig?.customInstructions?.trim()) {
      customInstructionsParts.push(aiConfig.customInstructions.trim());
    }

    if (matchedUser?.aiPersonaPrompt && !customInstructionsParts.some(p => p.includes(matchedUser!.aiPersonaPrompt!))) {
      customInstructionsParts.push(`INSTRUÇÃO COMPORTAMENTAL DA PERSONA:\n${matchedUser.aiPersonaPrompt}`);
    }

    if (matchedUser?.aiDirectives && matchedUser.aiDirectives.length > 0) {
      const formattedDirectives = matchedUser.aiDirectives.map(d => `- ${d}`).join('\n');
      if (!customInstructionsParts.some(p => p.includes(formattedDirectives))) {
        customInstructionsParts.push(`REGRAS COMERCIAIS & DIRETRIZES DE FECHAMENTO:\n${formattedDirectives}`);
      }
    }

    const effectiveAiConfig: TenantAIConfig = {
      provider: aiConfig?.provider || 'PLATFORM_DEFAULT',
      model: aiConfig?.model || 'gemini-flash-latest',
      tone: (aiConfig?.tone || matchedUser?.aiTone || 'CONSULTATIVE') as any,
      objective: aiConfig?.objective || 'EQUILIBRADO',
      customInstructions: customInstructionsParts.length > 0 ? customInstructionsParts.join('\n\n') : undefined,
      temperature: aiConfig?.temperature ?? 0.3,
      maxTokens: aiConfig?.maxTokens ?? 1024,
      enabled: aiConfig?.enabled ?? true,
    };

    const analysis = await UniversalCopilotService.analyzeConversation({
      chatHistory,
      brokerName: matchedUser?.name || brokerName,
      contactContext,
      aiConfig: effectiveAiConfig,
      priorContext,
    });

    return NextResponse.json({
      data: analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Falha na inferência de IA', message: err.message },
      { status: 500 }
    );
  }
}
