import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { S3StorageClient } from '@/lib/s3-client';

const PresignedUrlSchema = z.object({
  tenantId: z.string().default('tenant-amabile-barbarotti'),
  fileName: z.string().min(1, 'Nome do arquivo obrigatório'),
  fileType: z.string().min(1, 'MIME type obrigatório'),
  fileSizeBytes: z.number().max(25 * 1024 * 1024, 'Arquivo não pode exceder 25MB').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PresignedUrlSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Dados inválidos para upload', details: validated.error.format() },
        { status: 400 }
      );
    }

    const s3 = new S3StorageClient();
    const result = await s3.generatePresignedUploadUrl(validated.data);

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao gerar Presigned URL', message: err.message },
      { status: 500 }
    );
  }
}
