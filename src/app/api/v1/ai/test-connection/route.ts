import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UniversalCopilotService } from '@/lib/ai-provider-service';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const TestConnectionSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'PLATFORM_DEFAULT']),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rateCheck = checkRateLimit(`ai-test:${clientIp}`, 10, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: 'Limite de testes atingido. Aguarde alguns segundos.',
    }, { status: 429 });
  }

  const { session, errorResponse } = validateApiSession(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const validated = TestConnectionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetros inválidos para teste de conexão.',
        details: validated.error.format(),
      }, { status: 400 });
    }

    const { provider, apiKey, model } = validated.data;
    const testResult = await UniversalCopilotService.testConnection({
      provider,
      apiKey,
      model,
      tone: 'CONSULTATIVE',
      objective: 'EQUILIBRADO',
      enabled: true,
    });

    return NextResponse.json(testResult);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Erro ao testar conexão: ${err.message}`,
    }, { status: 500 });
  }
}
