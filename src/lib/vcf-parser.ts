/**
 * Utilitário de Parsing para Arquivos VCF (vCard iOS/Android/Google) e CSV
 * Vanguard CRM • Importação de Leads e Contatos
 */

export interface ParsedContactRecord {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  source: string;
  tags: string[];
}

/**
 * Normaliza número de telefone brasileiro para o padrão E.164 (+55DD9XXXXXXXX)
 */
export function normalizePhoneNumber(rawPhone: string): { normalized: string; display: string } {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return { normalized: '', display: '' };

  let fullDigits = digits;

  // Se tem 10 ou 11 dígitos (DDD + Número), adiciona o DDI 55
  if (!fullDigits.startsWith('55') && (fullDigits.length === 10 || fullDigits.length === 11)) {
    fullDigits = `55${fullDigits}`;
  }

  // Formatação legível brasileira: +55 (DD) 9XXXX-XXXX ou +55 (DD) XXXX-XXXX
  let display = `+${fullDigits}`;
  if (fullDigits.startsWith('55') && (fullDigits.length === 12 || fullDigits.length === 13)) {
    const ddd = fullDigits.slice(2, 4);
    const num = fullDigits.slice(4);
    if (num.length === 9) {
      display = `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    } else {
      display = `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    }
  }

  return {
    normalized: fullDigits,
    display,
  };
}

/**
 * Faz o parse de arquivo .vcf (vCard 2.1, 3.0, 4.0) exportado do Google Contatos, iCloud, iPhone ou Android
 */
export function parseVCFContent(vcfText: string): ParsedContactRecord[] {
  const records: ParsedContactRecord[] = [];
  const vcards = vcfText.split(/END:VCARD/i);

  for (const card of vcards) {
    if (!card.trim()) continue;

    let name = '';
    let phone = '';
    let email = '';
    let note = '';

    const lines = card.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Tratamento de continuação de linha no padrão vCard (linha iniciando com espaço)
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].trim();
      }

      if (/^FN[;: ]/i.test(line)) {
        name = line.replace(/^FN[;: ][^:]*:/i, '').trim();
      } else if (!name && /^N[;: ]/i.test(line)) {
        const parts = line.replace(/^N[;: ][^:]*:/i, '').split(';');
        const lastName = (parts[0] || '').trim();
        const firstName = (parts[1] || '').trim();
        name = `${firstName} ${lastName}`.trim();
      } else if (!phone && /^TEL[;: ]/i.test(line)) {
        phone = line.replace(/^TEL[;: ][^:]*:/i, '').trim();
      } else if (!email && /^EMAIL[;: ]/i.test(line)) {
        email = line.replace(/^EMAIL[;: ][^:]*:/i, '').trim();
      } else if (!note && /^NOTE[;: ]/i.test(line)) {
        note = line.replace(/^NOTE[;: ][^:]*:/i, '').trim();
      }
    }

    if (phone) {
      const { display, normalized } = normalizePhoneNumber(phone);
      if (normalized.length >= 8) {
        records.push({
          name: name || `Contato ${display}`,
          phone: display,
          email: email || undefined,
          notes: note || undefined,
          source: 'IMPORT_VCF',
          tags: ['Agenda Telefônica', 'Importação VCF'],
        });
      }
    }
  }

  return records;
}

/**
 * Faz o parse de arquivo CSV ou TSV com delimitadores flexíveis (, ou ;)
 */
export function parseCSVContent(csvText: string): ParsedContactRecord[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detecta se o delimitador é ponto e vírgula (Excel BR) ou vírgula (Padrão)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  // Identifica índices de colunas com sinônimos em português e inglês
  const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('cliente') || h.includes('contato'));
  const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('phone') || h.includes('cel') || h.includes('whats') || h.includes('fone') || h.includes('mobile'));
  const emailIdx = headers.findIndex(h => h.includes('mail') || h.includes('email') || h.includes('e-mail'));
  const notesIdx = headers.findIndex(h => h.includes('obs') || h.includes('nota') || h.includes('note') || h.includes('desc'));

  if (phoneIdx === -1 && nameIdx === -1) return [];

  const records: ParsedContactRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.length === 0 || !rawCols.some(Boolean)) continue;

    const rawPhone = phoneIdx >= 0 ? (rawCols[phoneIdx] || '') : (rawCols[1] || '');
    const rawName = nameIdx >= 0 ? (rawCols[nameIdx] || '') : (rawCols[0] || '');
    const rawEmail = emailIdx >= 0 ? rawCols[emailIdx] : undefined;
    const rawNotes = notesIdx >= 0 ? rawCols[notesIdx] : undefined;

    if (rawPhone) {
      const { display, normalized } = normalizePhoneNumber(rawPhone);
      if (normalized.length >= 8) {
        records.push({
          name: rawName || `Lead ${display}`,
          phone: display,
          email: rawEmail || undefined,
          notes: rawNotes || undefined,
          source: 'IMPORT_CSV',
          tags: ['Importação Planilha'],
        });
      }
    }
  }

  return records;
}
