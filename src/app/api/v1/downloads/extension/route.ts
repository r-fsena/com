import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EXTENSION_RELEASE } from '@/lib/extension-release';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const zip = fs.readFileSync(path.join(process.cwd(), 'public/downloads', EXTENSION_RELEASE.file));
    if (crypto.createHash('sha256').update(zip).digest('hex') !== EXTENSION_RELEASE.sha256) throw new Error('Checksum inválido');
    return new NextResponse(new Uint8Array(zip), { headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="brokiva-chrome-extension-v${EXTENSION_RELEASE.version}.zip"`,
      'Content-Length': String(zip.length), ETag: `"${EXTENSION_RELEASE.sha256}"`, 'Cache-Control': 'public, max-age=300',
    } });
  } catch { return NextResponse.json({ success: false, error: 'Pacote da extensão indisponível. Verifique a publicação da versão atual.' }, { status: 503 }); }
}
