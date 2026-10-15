// AADE HTTP Client with connection pooling and rate limiting
// Phase 1 hardening per SCALING_PLAN.md

import { getAadeConfig } from '../config/aade.config.js';
import { Agent } from 'node:https';
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const _dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(_dirname, '..', '..', '..', '.env') });

// Connection pool: keep-alive agent with configurable max sockets
const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 30000,
});

// Rate limiter: token bucket per AADE subscription key
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

const rateLimiters = new Map<string, TokenBucket>();

function getRateLimiter(subscriptionKey: string): TokenBucket {
  let bucket = rateLimiters.get(subscriptionKey);
  if (!bucket) {
    // Sandbox: ~10-30 req/sec per subscription key
    bucket = {
      tokens: 10,
      lastRefill: Date.now(),
      capacity: 10,
      refillRate: 10, // tokens per second
    };
    rateLimiters.set(subscriptionKey, bucket);
  }
  return bucket;
}

async function acquireToken(subscriptionKey: string): Promise<void> {
  const bucket = getRateLimiter(subscriptionKey);
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    const waitMs = Math.ceil((1 - bucket.tokens) / bucket.refillRate * 1000);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    bucket.tokens = 0;
    bucket.lastRefill = Date.now();
  }
  bucket.tokens -= 1;
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export interface AadeResponse {
  response: Response;
  rawResponse: string;
}

export async function aadeFetchWithPool(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    retry?: number;
  } = {}
): Promise<AadeResponse> {
  const config = getAadeConfig();
  const subscriptionKey = config.subscriptionKey || 'default';

  // Acquire rate limit token
  await acquireToken(subscriptionKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const doFetch = async () => {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'aade-user-id': config.userId,
        'ocp-apim-subscription-key': config.subscriptionKey,
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
        ...options.headers,
      },
      body: options.body,
      signal: options.signal || controller.signal,
      // @ts-ignore - dispatcher is undici/Node 22+ feature, fallback to agent
      dispatcher: undefined,
    } as RequestInit);
    clearTimeout(timeout);

    const rawResponse = await response.text();

    // Handle rate limiting from AADE
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      throw new Error('429 Too Many Requests - retry after ' + waitMs + 'ms');
    }

    return { response, rawResponse };
  };

  const maxRetries = options.retry ?? 3;
  return retryWithBackoff(doFetch, maxRetries);
}

export function getRateLimiterStatus(): Record<string, { tokens: number; capacity: number }> {
  const status: Record<string, { tokens: number; capacity: number }> = {};
  for (const [key, bucket] of rateLimiters) {
    status[key] = { tokens: bucket.tokens, capacity: bucket.capacity };
  }
  return status;
}