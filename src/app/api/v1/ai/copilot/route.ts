import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BedrockCopilotClient } from '@/lib/bedrock-client';

const AnalyzeConversationSchema = z.object({
  chatHistory: z.array(z.object({
    sender: z.enum(['CLIENT', 'BROKER']),
    text: z.string(),
  })).min(1, 'Histórico de mensagens é obrigatório'),
  brokerName: z.string().default('Corretor'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = AnalyzeConversationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Dados inválidos para análise de IA', details: validated.error.format() },
        { status: 400 }
      );
    }

    const { chatHistory, brokerName } = validated.data;
    const copilot = new BedrockCopilotClient();
    const analysis = await copilot.analyzeConversation(chatHistory, brokerName);

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
