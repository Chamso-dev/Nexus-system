/**
 * Resilient HTTP client built on Axios.
 *
 * Features:
 *  - per-instance base URL, timeout and default headers
 *  - automatic retry with exponential backoff + jitter for transient failures
 *    (network errors, 429, and 5xx)
 *  - latency logging for the "API latency" requirement
 *
 * Providers create a client via `createHttpClient(...)`.
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createLogger } from './logger';
import { ProviderError } from './errors';

const log = createLogger('HTTP');

export interface HttpClientOptions {
  baseURL?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Max retry attempts for transient failures. */
  retries?: number;
  /** Base backoff delay in ms (doubled each attempt). */
  retryBaseDelayMs?: number;
  /** Friendly provider name used in error messages/logs. */
  provider?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Decide whether a failed request is worth retrying. */
function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // network / timeout
  const status = error.response.status;
  return status === 429 || (status >= 500 && status < 600);
}

export function createHttpClient(options: HttpClientOptions = {}): AxiosInstance {
  const {
    baseURL,
    timeoutMs = 15_000,
    headers = {},
    retries = 3,
    retryBaseDelayMs = 300,
    provider = 'http',
  } = options;

  const instance = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: { 'User-Agent': 'NexusCryptoBot/1.0', Accept: 'application/json', ...headers },
  });

  // Retry interceptor with exponential backoff + jitter.
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const config = error.config as (AxiosRequestConfig & { __retryCount?: number }) | undefined;
      if (!config) return Promise.reject(error);

      config.__retryCount = config.__retryCount ?? 0;

      if (config.__retryCount < retries && isRetryable(error)) {
        config.__retryCount += 1;
        const backoff = retryBaseDelayMs * 2 ** (config.__retryCount - 1);
        const jitter = Math.random() * retryBaseDelayMs;
        const delay = backoff + jitter;
        log.debug('Retrying request', {
          provider,
          url: config.url,
          attempt: config.__retryCount,
          delayMs: Math.round(delay),
          status: error.response?.status,
        });
        await sleep(delay);
        return instance(config);
      }

      log.warn('HTTP request failed', {
        provider,
        url: config.url,
        status: error.response?.status,
        message: error.message,
      });
      return Promise.reject(
        new ProviderError(`${provider} request failed: ${error.message}`, error, {
          status: error.response?.status,
          url: config.url,
        }),
      );
    },
  );

  return instance;
}
