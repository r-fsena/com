import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UniversalCopilotService } from '@/lib/ai-provider-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { TenantAIConfig } from '@/types/crm';

export const dynamic = 'force-dynamic';

const BatchQualifyItemSchema = z.object({
  conversationId: z.string(),
  contactId: z.string(),
  contactName: z.string().optional(),
  chatHistory: z.array(z.object({
    sender: z.enum(['CLIENT', 'BROKER']),
    text: z.string(),
  })).min(1),
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

const BatchQualifySchema = z.object({
  items: z.array(BatchQualifyItemSchema).min(1).max(50),
  brokerName: z.string().default('Corretor'),
  aiConfig: z.object({
    provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'PLATFORM_DEFAULT']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    tone: z.enum(['CONSULTATIVE', 'CLOSER', 'ELEGANT', 'FRIENDLY']).optional(),
    objective: z.enum(['AGENDAR_VISITA', 'SIMULAR_FINANCIAMENTO', 'QUALIFICAR', 'EQUILIBRADO']).optional(),
    customInstructions: z.string().optional(),
    enabled: z.boolean().default(true),
  }).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Rate Limiting (Máx 60 requisições em lote por minuto)
  const clientIp = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`batch-qualify:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      error: 'Limite de requisições de análise em massa atingido',
      message: `Aguarde ${rateCheck.resetInSeconds} segundos para continuar o lote.`,
    }, { status: 429 });
  }

  // 2. Validação Estrita de Sessão & RBAC
  const { session, errorResponse } = validateApiSession(request, {
    requiredRoles: ['BROKER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const validated = BatchQualifySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Dados inválidos para análise em massa', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { items, brokerName, aiConfig } = validated.data;

    let leadsCount = 0;
    let personalCount = 0;

    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const analysis = await UniversalCopilotService.analyzeConversation({
            chatHistory: item.chatHistory,
            brokerName,
            contactContext: item.contactContext || { name: item.contactName },
            aiConfig: aiConfig as TenantAIConfig | undefined,
          });

          const isPersonal = analysis.conversationType === 'PERSONAL_OR_OTHER';
          if (isPersonal) {
            personalCount++;
          } else {
            leadsCount++;
          }

          return {
            conversationId: item.conversationId,
            contactId: item.contactId,
            contactName: item.contactName,
            isPersonal,
            conversationType: analysis.conversationType,
            summary: analysis.summary,
            extractedData: analysis.extractedData,
            detectedObjections: analysis.detectedObjections,
            responseOptions: analysis.responseOptions,
            sentiment: analysis.sentiment,
            intent: analysis.intent,
            suggestedResponse: analysis.suggestedResponse,
            confidenceScore: analysis.confidenceScore || 96,
          };
        } catch (err: any) {
          console.error(`[BatchQualify] Erro no item ${item.conversationId}:`, err);
          return {
            conversationId: item.conversationId,
            contactId: item.contactId,
            contactName: item.contactName,
            isPersonal: false,
            conversationType: 'REAL_ESTATE_LEAD' as const,
            summary: 'Conversa pendente de análise individual.',
            extractedData: {},
            detectedObjections: [],
            responseOptions: [],
            sentiment: 'NEUTRAL' as const,
            intent: 'DUVIDA_GERAL' as const,
            suggestedResponse: 'Olá, como posso te ajudar?',
            confidenceScore: 50,
          };
        }
      })
    );

    return NextResponse.json({
      results,
      totalProcessed: results.length,
      leadsCount,
      personalCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Falha na execução do lote de IA', message: err.message },
      { status: 500 }
    );
  }
}
