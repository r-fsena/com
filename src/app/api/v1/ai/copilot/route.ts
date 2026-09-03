import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UniversalCopilotService } from '@/lib/ai-provider-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { TenantAIConfig } from '@/types/crm';

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
  aiConfig: z.object({
    provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'PLATFORM_DEFAULT']),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    tone: z.enum(['CONSULTATIVE', 'CLOSER', 'ELEGANT', 'FRIENDLY']).default('CONSULTATIVE'),
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

  // 2. Validação de Sessão
  const { session, errorResponse } = validateApiSession(request);
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

    const { chatHistory, brokerName, contactContext, aiConfig } = validated.data;
    const analysis = await UniversalCopilotService.analyzeConversation({
      chatHistory,
      brokerName,
      contactContext,
      aiConfig: aiConfig as TenantAIConfig | undefined,
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
