import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MOCK_CONTACTS } from '@/lib/mock-data';
import { validateApiSession } from '@/lib/api-auth';

const CreateContactSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  phone: z.string().min(8, 'Telefone inválido'),
  email: z.string().email().optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).default('WARM'),
  source: z.string().default('WHATSAPP'),
  preferredPropertyType: z.string().optional(),
  targetRegions: z.array(z.string()).default(['São Paulo']),
  downPaymentAvailable: z.number().optional(),
  maxPropertyValue: z.number().optional(),
  assignedUserId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  const { session, errorResponse } = validateApiSession(request);
  if (errorResponse) return errorResponse;

  const searchParams = request.nextUrl.searchParams;
  // Anti-IDOR: O tenantId é sempre forçado a partir da sessão autenticada do usuário
  const tenantId = session?.isSuperAdmin 
    ? (searchParams.get('tenantId') || session.tenantId)
    : session?.tenantId || 'tenant-amabile-barbarotti';

  const temperature = searchParams.get('temperature');
  const search = searchParams.get('q');

  let list = MOCK_CONTACTS.filter(c => c.tenantId === tenantId);

  if (temperature && temperature !== 'ALL') {
    list = list.filter(c => c.temperature === temperature);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) || 
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({
    data: list,
    total: list.length,
  });
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = validateApiSession(request, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const validated = CreateContactSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validação falhou', details: validated.error.format() },
        { status: 400 }
      );
    }

    const data = validated.data;
    const newContact = {
      id: `contact-${Date.now()}`,
      tenantId: session?.tenantId || 'tenant-amabile-barbarotti',
      ...data,
      aiPriorityScore: 75,
      consentGiven: true,
      hasOptedOut: false,
      notesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ data: newContact }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao criar contato', message: err.message }, { status: 500 });
  }
}
