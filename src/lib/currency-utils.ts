/**
 * Utilitários de Formatação Monetária e Numérica Brasileira (BRL)
 */

/**
 * Converte qualquer valor numérico ou string numérica para formato de moeda brasileira: R$ 1.500.000
 */
export function formatBRL(value: number | string | undefined | null, options?: { showCents?: boolean; fallback?: string }): string {
  const fallback = options?.fallback ?? 'R$ 0';
  if (value === undefined || value === null || value === '') return fallback;

  const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
  if (isNaN(num)) return fallback;

  if (options?.showCents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  return `R$ ${Math.round(num).toLocaleString('pt-BR')}`;
}

/**
 * Formata para visualização compacta no Kanban ou badges: ex: R$ 1,8M ou R$ 500k
 */
export function formatCompactBRL(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return 'R$ 0';
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
  if (isNaN(num) || num === 0) return 'R$ 0';

  if (num >= 1_000_000) {
    const millions = num / 1_000_000;
    return `R$ ${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')}M`;
  }
  if (num >= 1_000) {
    const thousands = num / 1_000;
    return `R$ ${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(0)}k`;
  }

  return `R$ ${num.toLocaleString('pt-BR')}`;
}

/**
 * Normaliza qualquer texto digitado pelo usuário para um número inteiro puro
 * Ex: "R$ 1.500.000,00" -> 1500000
 * Ex: "15000" -> 15000
 */
export function parseBRLInputToNumber(text: string | number | undefined | null): number {
  if (text === undefined || text === null) return 0;
  if (typeof text === 'number') return text;
  const cleaned = String(text).replace(/\D/g, '');
  return cleaned ? Number(cleaned) : 0;
}

/**
 * Formata o valor digitado no input em tempo real com separador de milhar
 * Ex: "15000" -> "15.000"
 * Ex: "1800000" -> "1.800.000"
 */
export function maskCurrencyInput(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const num = parseBRLInputToNumber(raw);
  if (num === 0) return '';
  return num.toLocaleString('pt-BR');
}
