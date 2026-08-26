import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BedrockCopilotClient } from '@/lib/bedrock-client';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

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
});

export async function POST(request: NextRequest) {
  // 1. Rate Limiting (Máx 30 requisições por minuto por IP para proteção de custos de IA)
  const clientIp = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`copilot:${clientIp}`, 30, 60);
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

    const { chatHistory, brokerName, contactContext } = validated.data;
    const copilot = new BedrockCopilotClient();
    const analysis = await copilot.analyzeConversation(chatHistory, brokerName, contactContext);

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
