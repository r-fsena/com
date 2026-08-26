/**
 * Limitador de Taxa em Memória (Sliding Window Rate Limiter)
 * Protege rotas críticas (como IA, disparos de e-mail e webhooks) contra DoS e abuso.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza automática periódica de registros antigos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((record, key) => {
      const validTimestamps = record.timestamps.filter(ts => now - ts < 120000); // 2 minutos
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, { timestamps: validTimestamps });
      }
    });
  }, 60000);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number = 30,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const record = rateLimitStore.get(identifier) || { timestamps: [] };

  // Remove requisições fora da janela atual
  const validTimestamps = record.timestamps.filter(ts => now - ts < windowMs);

  if (validTimestamps.length >= limit) {
    const oldestTimestamp = validTimestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetInSeconds,
    };
  }

  // Registra a nova requisição
  validTimestamps.push(now);
  rateLimitStore.set(identifier, { timestamps: validTimestamps });

  return {
    allowed: true,
    limit,
    remaining: limit - validTimestamps.length,
    resetInSeconds: windowSeconds,
  };
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  );
}
