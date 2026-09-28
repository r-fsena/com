import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiSession } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { PropertyType } from '@/types/crm';

const ExtractUrlSchema = z.object({
  url: z.string().url('URL inválida. Certifique-se de incluir http:// ou https://'),
});

interface ExtractedPropertyMeta {
  url: string;
  name: string;
  price?: number;
  priceFormatted?: string;
  address?: string;
  propertyType?: PropertyType;
  imageUrl?: string;
  notes?: string;
  areaM2?: number;
  bedrooms?: number;
  parkingSpots?: number;
  domain: string;
  isPartialExtraction?: boolean;
}

/**
 * Normaliza e limpa texto removendo quebras de linha excessivas e espaços duplicados
 */
function cleanText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte string de preço (ex: "R$ 1.250.000,00" ou "1250000") em número
 */
function parsePriceToNumber(raw?: string | number | null): number | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'number') return raw > 0 ? raw : undefined;

  // Se vier com milhões / mil
  const milhaoMatch = raw.match(/([\d\.,]+)\s*(?:milhões|milhao|mi)/i);
  if (milhaoMatch) {
    const val = parseFloat(milhaoMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1000000);
  }

  const milMatch = raw.match(/([\d\.,]+)\s*(?:mil)\b/i);
  if (milMatch) {
    const val = parseFloat(milMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  // Regex para formato padrão brasileiro (R$ 1.250.000,00 ou 1.250.000)
  const cleaned = raw.replace(/[^\d,\.]/g, '').trim();
  if (!cleaned) return undefined;

  // Se tiver vírgula como decimal (1.250.000,00)
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const integerPart = parts[0].replace(/\./g, '');
    const num = parseInt(integerPart, 10);
    return isNaN(num) ? undefined : num;
  }

  // Se tiver pontos (1.250.000)
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      const num = parseInt(cleaned.replace(/\./g, ''), 10);
      return isNaN(num) ? undefined : num;
    }
  }

  const num = parseInt(cleaned, 10);
  return isNaN(num) || num <= 0 ? undefined : num;
}

/**
 * Detecta o tipo de imóvel a partir do título e descrição
 */
function detectPropertyType(text: string): PropertyType {
  const lower = text.toLowerCase();
  if (lower.includes('cobertura') || lower.includes('penthouse')) return 'PENTHOUSE';
  if (lower.includes('studio') || lower.includes('estúdio') || lower.includes('kitnet') || lower.includes('loft')) return 'STUDIO';
  if (lower.includes('casa') || lower.includes('sobrado') || lower.includes('mansão') || lower.includes('reserva')) return 'HOUSE';
  if (lower.includes('terreno') || lower.includes('lote') || lower.includes('loteamento')) return 'LAND';
  if (lower.includes('comercial') || lower.includes('sala ') || lower.includes('loja') || lower.includes('galpão') || lower.includes('office')) return 'COMMERCIAL';
  return 'APARTMENT';
}

/**
 * Extrai nome amigável e legível a partir da slug de URL
 */
function extractFromUrlSlug(urlStr: string): { title: string; type: PropertyType } {
  try {
    const parsed = new URL(urlStr);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const lastOrKeySegment = pathSegments.find(s => s.length > 10) || pathSegments[pathSegments.length - 1] || '';

    // Remove IDs e extensões
    const cleanSegment = lastOrKeySegment
      .replace(/\.(html|php|aspx|htm)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b(id|ref|anuncio|imovel|prop|sp|rj|pr|sc|rs|mg)\b/gi, '')
      .trim();

    const words = cleanSegment
      .split(/\s+/)
      .filter(w => w.length > 2 && !/^\d+$/.test(w))
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    const title = words.slice(0, 7).join(' ') || parsed.hostname.replace('www.', '');
    const type = detectPropertyType(cleanSegment);
    return { title, type };
  } catch {
    return { title: 'Imóvel Importado', type: 'APARTMENT' };
  }
}

/**
 * Extrai tags OpenGraph, Twitter Cards e Meta Standard
 */
function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  
  // Regex universal para capturar atributos name/property/itemprop e content
  const metaRegex = /<meta\s+([^>]*?)>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const nameMatch = attrs.match(/(?:name|property|itemprop)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']*)["']/i);

    if (nameMatch && contentMatch) {
      const key = nameMatch[1].toLowerCase().trim();
      const val = contentMatch[1].trim();
      if (!meta[key]) {
        meta[key] = val;
      }
    }
  }

  // Título fallback da tag <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    meta['page_title'] = cleanText(titleMatch[1]);
  }

  return meta;
}

/**
 * Extrai e interpreta dados estruturados JSON-LD (Schema.org)
 */
function extractJsonLd(html: string): any[] {
  const jsonLdObjects: any[] = [];
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const rawJson = match[1].trim();
      if (!rawJson) continue;
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        jsonLdObjects.push(...parsed);
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed['@graph'])) {
          jsonLdObjects.push(...parsed['@graph']);
        } else {
          jsonLdObjects.push(parsed);
        }
      }
    } catch {
      // Ignora blocos com JSON mal formatado pelo site terceiro
    }
  }

  return jsonLdObjects;
}

export async function POST(request: NextRequest) {
  // 1. Rate Limiting por IP (Máximo 60 extrações por minuto)
  const clientIp = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`extract-prop:${clientIp}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({
      error: 'Limite de requisições excedido',
      message: `Aguarde ${rateCheck.resetInSeconds} segundos antes de tentar novamente.`,
    }, { status: 429 });
  }

  // 2. Validação da Sessão (Corretores e Administradores)
  const { errorResponse } = validateApiSession(request, {
    requiredRoles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'BROKER'],
  });
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { url } = ExtractUrlSchema.parse(body);

    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.replace(/^www\./, '');

    // 3. Busca o HTML com simulação de cabeçalhos de navegador modernos
    let html = '';
    let fetchFailed = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500); // 8.5s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        html = await response.text();
      } else {
        fetchFailed = true;
      }
    } catch {
      fetchFailed = true;
    }

    // Se o site bloqueou ou falhou, fallback elegante sem travar o corretor
    if (fetchFailed || !html) {
      const slugData = extractFromUrlSlug(url);
      const fallbackResult: ExtractedPropertyMeta = {
        url,
        domain,
        name: slugData.title || `Imóvel em ${domain}`,
        propertyType: slugData.type,
        isPartialExtraction: true,
      };

      return NextResponse.json({
        success: true,
        data: fallbackResult,
        warning: 'Não foi possível ler todos os dados automaticamente do portal devido à proteção do site. Os dados básicos foram inferidos do link.',
      });
    }

    // 4. Extração via Meta Tags & OpenGraph
    const metaTags = extractMetaTags(html);
    const jsonLdItems = extractJsonLd(html);

    // Título / Nome do Empreendimento
    let title = cleanText(
      metaTags['og:title'] ||
      metaTags['twitter:title'] ||
      metaTags['page_title'] ||
      ''
    );

    // Limpeza de sufixos comuns de portais no título (ex: " | Zap Imóveis", " - Viva Real")
    if (title) {
      title = title.replace(/\s*[-–|•]\s*(Zap Imóveis|Viva Real|Imovelweb|OLX|QuintoAndar|Loft|Chaves na Mão|Mercado Livre|CasaMineira).*$/i, '').trim();
    }

    // Se não encontrou título válido, usa slug
    if (!title || title.length < 4) {
      title = extractFromUrlSlug(url).title;
    }

    // Descrição
    let description = cleanText(
      metaTags['og:description'] ||
      metaTags['description'] ||
      metaTags['twitter:description'] ||
      ''
    );

    // Imagem principal (OpenGraph / Twitter / JSON-LD)
    let imageUrl: string | undefined =
      metaTags['og:image'] ||
      metaTags['og:image:secure_url'] ||
      metaTags['twitter:image'] ||
      metaTags['twitter:image:src'];

    // Se for URL relativa, transforma em absoluta
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch {}
    }

    // 5. Extração de Preço
    let price: number | undefined;

    // A. Meta tags de preço explícitas
    if (metaTags['og:price:amount'] || metaTags['product:price:amount']) {
      price = parsePriceToNumber(metaTags['og:price:amount'] || metaTags['product:price:amount']);
    }

    // B. JSON-LD Schemas (Product, RealEstateListing, Offer, SingleFamilyResidence)
    let addressFromSchema = '';
    let areaM2FromSchema: number | undefined;
    let bedroomsFromSchema: number | undefined;

    for (const item of jsonLdItems) {
      // Preço em Ofertas
      if (!price) {
        if (item.offers) {
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          if (offer?.price) price = parsePriceToNumber(offer.price);
        } else if (item.price) {
          price = parsePriceToNumber(item.price);
        }
      }

      // Imagem do JSON-LD se não achou no OpenGraph
      if (!imageUrl && item.image) {
        const img = Array.isArray(item.image) ? item.image[0] : item.image;
        if (typeof img === 'string') imageUrl = img;
        else if (img?.url) imageUrl = img.url;
      }

      // Endereço do JSON-LD
      if (!addressFromSchema && item.address) {
        const addr = item.address;
        if (typeof addr === 'string') {
          addressFromSchema = addr;
        } else if (typeof addr === 'object') {
          const parts = [
            addr.streetAddress,
            addr.addressLocality || addr.addressSubLocality,
            addr.addressRegion,
          ].filter(Boolean);
          if (parts.length > 0) addressFromSchema = parts.join(' - ');
        }
      }

      // Metragem e Quartos do JSON-LD
      if (!areaM2FromSchema && item.floorSize) {
        const fs = typeof item.floorSize === 'object' ? item.floorSize.value : item.floorSize;
        if (fs && !isNaN(Number(fs))) areaM2FromSchema = Math.round(Number(fs));
      }
      if (!bedroomsFromSchema && (item.numberOfBedrooms || item.numberOfRooms)) {
        const b = item.numberOfBedrooms || item.numberOfRooms;
        if (b && !isNaN(Number(b))) bedroomsFromSchema = Number(b);
      }
    }

    // C. Heurística de Preço via Regex no Título ou Descrição
    if (!price) {
      const fullText = `${title} ${description}`;
      const priceRegex = /R\$\s*([\d\.]+(?:,\d{2})?)/i;
      const priceMatch = fullText.match(priceRegex);
      if (priceMatch) {
        price = parsePriceToNumber(priceMatch[1]);
      }
    }

    // 6. Heurística de Metragem (m²), Quartos e Vagas via Regex
    const combinedContent = `${title} ${description} ${html.slice(0, 15000)}`;
    
    // Metragem
    let areaM2 = areaM2FromSchema;
    if (!areaM2) {
      const areaMatch = combinedContent.match(/(\d+(?:[,\.]\d+)?)\s*(?:m²|m2|metros\s*quadrados)/i);
      if (areaMatch) {
        const val = parseFloat(areaMatch[1].replace(',', '.'));
        if (!isNaN(val) && val >= 10 && val <= 5000) {
          areaM2 = Math.round(val);
        }
      }
    }

    // Quartos / Dormitórios
    let bedrooms = bedroomsFromSchema;
    if (!bedrooms) {
      const bedMatch = combinedContent.match(/(\d+)\s*(?:quartos|dormitórios|dormitorios|dorms|suítes|suites|quarto|dorm|suíte)/i);
      if (bedMatch) {
        const val = parseInt(bedMatch[1], 10);
        if (!isNaN(val) && val >= 1 && val <= 20) {
          bedrooms = val;
        }
      }
    }

    // Vagas de garagem
    let parkingSpots: number | undefined;
    const parkingMatch = combinedContent.match(/(\d+)\s*(?:vagas|vaga|garagens|garagem)/i);
    if (parkingMatch) {
      const val = parseInt(parkingMatch[1], 10);
      if (!isNaN(val) && val >= 1 && val <= 15) {
        parkingSpots = val;
      }
    }

    // 7. Endereço / Localização
    let address = addressFromSchema;
    if (!address) {
      // Tenta achar padrões comuns tipo "Batel, Curitiba - PR" ou "Bairro, Cidade"
      const addrMatch = description.match(/(?:localizado em|localizado no|bairro|em)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\w\sÁÉÍÓÚÂÊÔÃÕÇ]+(?:,\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\w\s]+)?(?:\s*-\s*[A-Z]{2})?)/i);
      if (addrMatch && addrMatch[1] && addrMatch[1].length < 60) {
        address = cleanText(addrMatch[1]);
      }
    }

    // 8. Tipo de Imóvel
    const propertyType = detectPropertyType(`${title} ${description} ${url}`);

    // Preço formatado em BRL
    const priceFormatted = price ? `R$ ${price.toLocaleString('pt-BR')}` : undefined;

    const result: ExtractedPropertyMeta = {
      url,
      domain,
      name: title || 'Imóvel Apresentado',
      price,
      priceFormatted,
      address: address || undefined,
      propertyType,
      imageUrl: imageUrl || undefined,
      notes: description ? description.slice(0, 180) + (description.length > 180 ? '...' : '') : undefined,
      areaM2,
      bedrooms,
      parkingSpots,
      isPartialExtraction: false,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Properties Extract Meta API] Erro ao extrair dados do link:', error);
    return NextResponse.json({
      error: 'Falha ao processar link',
      message: error?.message || 'Verifique se a URL informada é válida.',
    }, { status: 400 });
  }
}
