import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const candidatePaths = [
      path.join(process.cwd(), 'public', 'downloads', 'brokiva-extension-latest.zip'),
      path.join(process.cwd(), 'public', 'downloads', 'brokiva-extension-v1.0.34.zip'),
      path.join(process.cwd(), 'public', 'downloads', 'brokiva-extension-v1.0.33.zip'),
      path.join(process.cwd(), 'public', 'downloads', 'brokiva-extension-v1.0.32.zip'),
      path.join(process.cwd(), 'public', 'downloads', 'brokiva-extension-v1.0.31.zip'),
    ];

    let zipBuffer: Buffer | null = null;
    let foundPath = '';

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        zipBuffer = fs.readFileSync(filePath);
        foundPath = filePath;
        break;
      }
    }

    if (!zipBuffer) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo da extensão não encontrado para download.',
      }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="brokiva-chrome-extension-v1.0.34.zip"',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error: any) {
    console.error('Erro ao disponibilizar download da extensão:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao processar download da extensão.',
    }, { status: 500 });
  }
}
