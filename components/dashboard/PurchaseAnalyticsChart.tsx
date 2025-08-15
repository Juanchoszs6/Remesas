'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';
import { Skeleton } from '@/components/ui/skeleton';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ---------- Config ---------- */
const DEBUG = true;
const PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 45000;
const MAX_PAGE_SAFE = 500;
const MIN_THROTTLE_MS = 160; // espera mínima entre páginas
const TOKEN_REFRESH_MARGIN_S = 60; // refrescar si expira en menos de 60s
const CACHE_TTL_MS = 5 * 60 * 1000; // cache en sessionStorage por 5 minutos
const MAX_RETRIES_PER_PAGE = 5; // intentos por pagina antes de skip

// DATA_SOURCE: 'local' -> usa /api/siigo/get-purchases (recomendado)
//              'siigo' -> llama directamente a Siigo API (requiere CORS y token, no recomendado en prod)
const DATA_SOURCE: 'local' | 'siigo' = 'local';

const SIIGO_BASE_URL = (typeof process !== 'undefined' && (process.env as any)?.SIIGO_BASE_URL) || 'https://api.siigo.com/v1';

/* ---------- Types ---------- */
interface ChartData {
  name: string;
  facturas: number;
  monto: number;
  month: number;
  year: number;
  fullDate: string;
}

interface LoadingProgress {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}

type AnyObject = Record<string, any>;

/* ---------- Utils ---------- */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randJitter = (base = 200) => base + Math.floor(Math.random() * base);
const log = {
  debug: (...args: any[]) => DEBUG && console.debug('[PAC]', ...args),
  info: (...args: any[]) => console.info('[PAC]', ...args),
  warn: (...args: any[]) => console.warn('[PAC]', ...args),
  error: (...args: any[]) => console.error('[PAC]', ...args)
};

/* ---------- JWT helpers (lightweight) ---------- */
const parseJwtExp = (token: string | null): number | null => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(decoded);
    if (obj && obj.exp) return Number(obj.exp);
    return null;
  } catch (e) {
    log.debug('[PAC] parseJwtExp failed', e);
    return null;
  }
};

/* ---------- Token storage helpers ---------- */
const getStoredToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    // window var first
    // @ts-ignore
    if (typeof window.__SIIGO_TOKEN__ === 'string' && window.__SIIGO_TOKEN__) return window.__SIIGO_TOKEN__;
    const ls = localStorage.getItem('siigo_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (ls) return ls;
    const ss = sessionStorage.getItem('siigo_token') || sessionStorage.getItem('token') || sessionStorage.getItem('auth_token');
    if (ss) return ss;
    const c = document.cookie.split(';').map(p => p.trim()).find(p => p.startsWith('siigo_token=') || p.startsWith('token='));
    if (c) return decodeURIComponent(c.split('=')[1] || '');
    return null;
  } catch (e) {
    log.warn('[PAC] getStoredToken error', e);
    return null;
  }
};

const setStoredToken = (token: string | null) => {
  try {
    if (typeof window === 'undefined') return;
    if (!token) {
      localStorage.removeItem('siigo_token');
      sessionStorage.removeItem('siigo_token');
      document.cookie = 'siigo_token=; path=/; max-age=0';
      // @ts-ignore
      if (window.__SIIGO_TOKEN__) delete window.__SIIGO_TOKEN__;
      return;
    }
    localStorage.setItem('siigo_token', token);
    // @ts-ignore
    window.__SIIGO_TOKEN__ = token;
  } catch (e) {
    log.warn('[PAC] setStoredToken error', e);
  }
};

/* ---------- Server token fetch (tries local endpoint then fallback to helper) ---------- */
const fetchTokenFromServer = async (): Promise<string | null> => {
  try {
    // 1) first try local endpoint
    try {
      const res = await fetch('/api/siigo/get-token', { method: 'GET', credentials: 'same-origin' });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        const token = body?.token || body?.access_token || null;
        if (token) {
          setStoredToken(token);
          log.info('[PAC] Token obtenido desde /api/siigo/get-token');
          return token;
        }
        log.warn('[PAC] /api/siigo/get-token responded ok but no token field', body);
      } else {
        const txt = await res.text().catch(() => res.statusText);
        log.warn('[PAC] /api/siigo/get-token not ok', res.status, txt);
      }
    } catch (e) {
      log.warn('[PAC] fetch /api/siigo/get-token failed, trying obtenerTokenSiigo()', e);
    }

    // 2) fallback to helper (client lib) obtenerTokenSiigo
    try {
      const token = await obtenerTokenSiigo();
      if (token) {
        setStoredToken(token);
        log.info('[PAC] Token obtenido con obtenerTokenSiigo()');
        return token;
      }
    } catch (e) {
      log.warn('[PAC] obtenerTokenSiigo() failed', e);
    }

    log.error('[PAC] No se pudo obtener token ni de la API local ni de obtenerTokenSiigo()');
    return null;
  } catch (err) {
    log.error('[PAC] fetchTokenFromServer error', err);
    return null;
  }
};

/* ---------- authFetch: injects Authorization + handles 401/429 (for external calls) ---------- */
const authFetch = async (input: RequestInfo, init: RequestInit = {}, allowRefresh = true, signal?: AbortSignal, retryCount = 0): Promise<Response> => {
  const max401Retries = 2;
  const max429Retries = 4;
  const initCopy: RequestInit = { ...init };
  initCopy.headers = { ...(init.headers || {}) } as Record<string, any>;
  if (signal) initCopy.signal = signal;

  const injectToken = (token: string | null) => {
    if (!token) return;
    initCopy.headers = {
      ...initCopy.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  };

  // Ensure we have token (and proactive refresh)
  let token = getStoredToken();
  const exp = parseJwtExp(token);
  if (token && exp) {
    const nowS = Math.floor(Date.now() / 1000);
    if (exp - nowS < TOKEN_REFRESH_MARGIN_S && allowRefresh) {
      log.info('[PAC] Token expira pronto, refrescando proactivamente');
      const nt = await fetchTokenFromServer();
      if (nt) token = nt;
    }
  } else if (!token && allowRefresh) {
    token = await fetchTokenFromServer();
  }

  injectToken(token);

  try {
    const res = await fetch(input, initCopy);

    // 429 handling
    if (res.status === 429) {
      const ra = res.headers.get('Retry-After');
      const wait = ra ? Number(ra) * 1000 : Math.min(60000, 1000 * Math.pow(2, retryCount));
      log.warn(`[PAC] 429 recibido. Esperando ${wait}ms antes de reintentar. url=${String(input)}`);
      try {
        const bodyText = await res.text().catch(() => '');
        log.debug('[PAC] 429 body:', bodyText);
      } catch (e) { /* ignore */ }
      await sleep(wait + randJitter(200));
      if (retryCount < max429Retries) return authFetch(input, init, allowRefresh, signal, retryCount + 1);
      return res;
    }

    // 401 handling -> try refresh once
    if (res.status === 401 && allowRefresh && retryCount < max401Retries) {
      log.warn(`[PAC] 401 detectada. Intentando refrescar token... url=${String(input)} attempt=${retryCount+1}`);
      const newToken = await fetchTokenFromServer();
      if (newToken) {
        setStoredToken(newToken);
        injectToken(newToken);
        // Reintentar petición con el nuevo token pero no permitir refresh recursivo ilimitado
        return authFetch(input, initCopy, false, signal, retryCount + 1);
      }
    }

    return res;
  } catch (error: any) {
    log.error('[PAC] authFetch error', error);
    throw error;
  }
};

/* ---------- Parsers y dedupe (igual que antes) ---------- */
const parseInvoiceDate = (invoice: any): Date | null => {
  if (!invoice || typeof invoice !== 'object') return null;
  const candidates = [
    invoice.date, invoice.created, invoice.creation_date, invoice.created_at,
    invoice.issue_date, invoice.issueDate, invoice.fecha, invoice.fecha_emision,
    invoice.emitted_at, invoice.datetime, invoice.timestamp
  ];
  if (invoice.period && typeof invoice.period === 'object') {
    const y = invoice.period.year || invoice.period.Y || invoice.period.ano;
    const m = invoice.period.month || invoice.period.M;
    if (y && m && !Number.isNaN(Number(y)) && !Number.isNaN(Number(m))) {
      const monthIndex = Math.max(0, Math.min(11, Number(m) - 1));
      return new Date(Number(y), monthIndex, 1);
    }
  }
  const altYear = invoice.year || invoice.ano || invoice.yr;
  const altMonth = invoice.month || invoice.mes || invoice.mon;
  if (altYear && altMonth && !Number.isNaN(Number(altYear)) && !Number.isNaN(Number(altMonth))) {
    return new Date(Number(altYear), Math.max(0, Math.min(11, Number(altMonth) - 1)), 1);
  }
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === 'number' && Number.isFinite(c)) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d;
    }
    const s = String(c).trim();
    if (/^\d{4}-\d{2}(-\d{2})?/.test(s)) {
      const normalized = s.length === 7 ? `${s}-01` : s;
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) return d;
    }
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      const d = new Date(n);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const parseInvoiceAmount = (invoice: any): number => {
  if (!invoice || typeof invoice !== 'object') return 0;
  const fields = ['total', 'amount', 'value', 'subtotal', 'monto', 'total_amount', 'net_total'];
  for (const f of fields) {
    const v = invoice[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const parsed = parseFloat(v.replace(/[^\d.-]/g, ''));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (Array.isArray(invoice.payments) && invoice.payments.length) {
    const sum = invoice.payments.reduce((s: number, p: any) => {
      const val = typeof p.value === 'number' ? p.value : typeof p.amount === 'number' ? p.amount : parseFloat(String(p.value || p.amount || '0').replace(/[^\d.-]/g, '')) || 0;
      return s + (Number.isNaN(val) ? 0 : val);
    }, 0);
    if (sum > 0) return sum;
  }
  if (Array.isArray(invoice.items) && invoice.items.length) {
    const sum = invoice.items.reduce((s: number, it: any) => {
      const itTotal = typeof it.total === 'number' ? it.total
        : typeof it.amount === 'number' ? it.amount
        : parseFloat(String(it.total || it.amount || (it.price && it.quantity ? Number(it.price) * Number(it.quantity) : '0')).replace(/[^\d.-]/g, '')) || 0;
      return s + (Number.isNaN(itTotal) ? 0 : itTotal);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
};

const dedupeInvoices = (arr: any[]): any[] => {
  const map = new Map<string, any>();
  for (const inv of arr) {
    const id = String(inv?.id ?? inv?.number ?? inv?.reference ?? inv?.code ?? '').trim() || JSON.stringify(inv || {});
    if (!map.has(id)) map.set(id, inv);
    else {
      const existing = map.get(id);
      const existingScore = existing ? Object.keys(existing).length : 0;
      const newScore = inv ? Object.keys(inv).length : 0;
      if (newScore > existingScore) map.set(id, inv);
    }
  }
  return Array.from(map.values());
};

/* ---------- Cache layer (sessionStorage) ---------- */
const cacheKeyForRange = (start: string, end: string) => `pac_cache:${start}:${end}`;
const setCache = (key: string, value: any, ttl = CACHE_TTL_MS) => {
  try {
    const payload = { ts: Date.now(), ttl, value };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
};
const getCache = (key: string) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts) return null;
    if (Date.now() - parsed.ts > (parsed.ttl || CACHE_TTL_MS)) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch (e) {
    return null;
  }
};
const clearCache = (key: string) => {
  try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
};

/* ---------- fetchAllPages (robust) ---------- */
const buildFetchUrl = (base: string, page: number) => base.includes('?') ? `${base}&page=${page}&per_page=${PER_PAGE}` : `${base}?page=${page}&per_page=${PER_PAGE}`;

/**
 * fetchAllPagesFactory ahora detecta si la URL es local (/api/) y usa fetch normal,
 * si no usa authFetchLocal (para llamadas directas a Siigo).
 */
const fetchAllPagesFactory = (authFetchLocal: typeof authFetch, progressCb?: (p: LoadingProgress) => void) => {
  return async (baseUrl: string, maxRetriesForPage = MAX_RETRIES_PER_PAGE): Promise<any[]> => {
    const collected: any[] = [];

    // helper para detectar local API (usa origin también si se pasa absolute)
    const isLocalApi = (u: string) => {
      try {
        if (typeof window === 'undefined') return u.startsWith('/api/');
        const origin = window.location.origin;
        return u.startsWith('/api/') || u.startsWith(`${origin}/api/`);
      } catch (e) {
        return u.startsWith('/api/');
      }
    };

    // Si es API local -> hacemos **UNA SOLA** petición y esperamos que el servidor haga la paginación.
    if (isLocalApi(baseUrl)) {
      try {
        log.debug('[PAC] isLocalApi detected -> requesting server-side pagination for', baseUrl);
        const res = await fetch(baseUrl, { method: 'GET', credentials: 'same-origin' });
        if (!res.ok) {
          const t = await res.text().catch(() => res.statusText);
          throw new Error(`Local API HTTP ${res.status}: ${t}`);
        }
        const body = await res.json().catch(() => null);
        if (!body) return [];
        if (Array.isArray(body)) return body;
        if (Array.isArray(body?.purchases)) return body.purchases;
        if (Array.isArray(body?.results)) return body.results;
        if (Array.isArray(body?.data)) return body.data;
        const props = ['invoices','items','documents','rows'];
        for (const p of props) if (Array.isArray(body?.[p])) return body[p];
        return [];
      } catch (err: any) {
        log.error('[PAC] fetchAllPages local error:', err?.message || err);
        throw err;
      }
    }

    // Si llegamos aquí -> llamada a API externa (no local) -> mantenemos la lógica robusta existente (authFetch)
    let page = 1;
    let totalPages: number | null = null;
    let consecutiveEmpty = 0;

    while (page <= MAX_PAGE_SAFE && (totalPages === null || page <= totalPages)) {
      const url = buildFetchUrl(baseUrl, page);
      let attempt = 0;
      let pageSucceeded = false;

      while (attempt < maxRetriesForPage && !pageSucceeded) {
        attempt++;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          log.debug(`[PAC] Request page ${page} attempt ${attempt}: ${url}`);
          const res = await authFetchLocal(url, { method: 'GET' }, true, controller.signal);
          clearTimeout(timeoutId);

          if (res.status === 429) {
            const ra = res.headers.get('Retry-After');
            const wait = ra ? Number(ra) * 1000 : Math.min(60000, 1000 * Math.pow(2, attempt));
            log.warn(`[PAC] 429 en page ${page}. Esperando ${wait}ms`);
            await sleep(wait + randJitter(200));
            continue;
          }

          if (!res.ok) {
            const t = await res.text().catch(() => res.statusText);
            throw new Error(`HTTP ${res.status}: ${t}`);
          }

          const body = await res.json().catch(() => null);
          let pageData: any[] = [];
          let paginationInfo: any = null;

          if (Array.isArray(body)) pageData = body;
          else if (Array.isArray(body?.results)) { pageData = body.results; paginationInfo = body.pagination || body.meta || body; }
          else if (Array.isArray(body?.data)) { pageData = body.data; paginationInfo = body.pagination || body.meta || body; }
          else {
            const props = ['invoices','items','purchases','documents','rows'];
            for (const p of props) if (Array.isArray(body?.[p])) { pageData = body[p]; break; }
            paginationInfo = body?.pagination || body?.meta || body;
          }

          if (paginationInfo) {
            const tp = paginationInfo.total_pages || paginationInfo.last_page || paginationInfo.totalPages || paginationInfo.total;
            if (tp && Number.isFinite(Number(tp))) totalPages = Number(tp);
            else if (paginationInfo.total_records && paginationInfo.per_page) totalPages = Math.ceil(Number(paginationInfo.total_records)/Number(paginationInfo.per_page));
          } else if (Array.isArray(pageData) && pageData.length < PER_PAGE) {
            totalPages = page;
          }

          if (Array.isArray(pageData) && pageData.length === 0) {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 2) {
              pageSucceeded = true;
              break;
            }
          } else {
            consecutiveEmpty = 0;
            if (Array.isArray(pageData)) collected.push(...pageData);
          }

          if (progressCb) progressCb({ currentPage: page, totalPages: totalPages || 0, totalRecords: collected.length });
          pageSucceeded = true;
        } catch (err: any) {
          clearTimeout(timeoutId);
          const name = err?.name || '';
          const msg = err?.message || String(err);
          if (name === 'AbortError' || /abort/i.test(msg) || /signal is aborted/i.test(msg)) {
            const backoff = Math.min(60000, 500 * Math.pow(2, attempt));
            log.warn(`[PAC] Abort/timeout en página ${page}, attempt ${attempt}. Backoff ${backoff}ms -> reintentando.`);
            await sleep(backoff + randJitter(200));
            continue;
          }
          log.error(`[PAC] Error page ${page} attempt ${attempt}:`, msg);
          if (attempt >= maxRetriesForPage) {
            log.warn(`[PAC] Max retries alcanzado en página ${page}, se hace skip.`);
            pageSucceeded = true;
          } else {
            const wait = Math.min(60000, 400 * Math.pow(2, attempt));
            await sleep(wait + randJitter(200));
          }
        }
      } // end attempts

      page++;
      await sleep(MIN_THROTTLE_MS + Math.floor(Math.random() * 120));
    } // end pages

    log.info(`[PAC] fetchAllPages finalizado: ${collected.length} registros para baseUrl=${baseUrl}`);
    return collected;
  };
};

/* ---------- Componente principal (estado, fetchPurchaseData, render) ---------- */
export default function PurchaseAnalyticsChart(): React.ReactElement {
  // estado UI
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFacturas, setTotalFacturas] = useState<number>(0);
  const [totalMonto, setTotalMonto] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ currentPage: 0, totalPages: 0, totalRecords: 0 });
  const [useCache, setUseCache] = useState(true);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allInvoices.forEach(inv => {
      const d = parseInvoiceDate(inv);
      if (d) years.add(d.getFullYear());
      if (inv && inv.year && !Number.isNaN(Number(inv.year))) years.add(Number(inv.year));
    });
    if (years.size === 0) {
      const cy = new Date().getFullYear();
      for (let i = cy - 2; i <= cy; i++) years.add(i);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices]);

  // fetchAllPages preparado con callback
  const fetchAllPages = useMemo(() => fetchAllPagesFactory(authFetch, (p) => {
    if (isMounted.current) setLoadingProgress(p);
  }), []);

  // Resuelve la URL base para un mes dado (usa DATA_SOURCE)
  const resolveBaseUrlForMonth = (year: number, monthZeroIndex: number) => {
    const monthOne = monthZeroIndex + 1;
    const start = `${year}-${String(monthOne).padStart(2,'0')}-01`;
    const end = `${year}-${String(monthOne).padStart(2,'0')}-${String(new Date(year, monthOne, 0).getDate()).padStart(2,'0')}`;

    if (DATA_SOURCE === 'local') {
      return `/api/siigo/get-purchases?get_all_pages=true&start_date=${start}&end_date=${end}&per_page=${PER_PAGE}`;
    } else {
      // direct Siigo API (requiere CORS y token)
      return `${SIIGO_BASE_URL}/purchases?start_date=${start}&end_date=${end}&per_page=${PER_PAGE}`;
    }
  };

  // helper last day
  const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  // primary fetch function (secuencia por mes) - AHORA con intento YTD (enero -> hoy)
  const fetchPurchaseData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ currentPage: 0, totalPages: 0, totalRecords: 0 });

    try {
      log.info(`[PAC] Iniciando carga año ${selectedYear}`);
      const monthlyCollected: any[] = [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthZeroIndex = now.getMonth();

      // If selectedYear is current year -> try single YTD request first
      if (selectedYear === currentYear) {
        const startYTD = `${selectedYear}-01-01`;
        const endYTD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const ytdCacheKey = cacheKeyForRange(startYTD, endYTD);

        if (useCache) {
          const cachedYtd = getCache(ytdCacheKey);
          if (cachedYtd && Array.isArray(cachedYtd) && cachedYtd.length > 0) {
            log.debug(`[PAC] Cache hit YTD ${ytdCacheKey} -> ${cachedYtd.length} registros`);
            monthlyCollected.push(...cachedYtd);
          } else {
            // attempt single YTD fetch (server paginates)
            try {
              const url = DATA_SOURCE === 'local'
                ? `/api/siigo/get-purchases?get_all_pages=true&start_date=${startYTD}&end_date=${endYTD}&per_page=${PER_PAGE}`
                : `${SIIGO_BASE_URL}/purchases?start_date=${startYTD}&end_date=${endYTD}&per_page=${PER_PAGE}`;

              log.debug('[PAC] Intentando cargar YTD con URL:', url);
              const resArr = await fetchAllPages(url);
              if (resArr && resArr.length > 0) {
                monthlyCollected.push(...resArr);
                if (useCache) setCache(ytdCacheKey, resArr, CACHE_TTL_MS);
                log.info(`[PAC] YTD cargado: ${resArr.length} registros (inicio=${startYTD} end=${endYTD})`);
              } else {
                log.warn('[PAC] YTD devolvió arreglo vacío, se hará fallback por meses');
              }
            } catch (ytdErr) {
              log.warn('[PAC] Falló YTD fetch, se hará fallback por meses:', ytdErr);
              // continue to monthly fallback
            }
          }
        } else {
          // no cache -> attempt YTD fetch
          try {
            const url = DATA_SOURCE === 'local'
              ? `/api/siigo/get-purchases?get_all_pages=true&start_date=${startYTD}&end_date=${endYTD}&per_page=${PER_PAGE}`
              : `${SIIGO_BASE_URL}/purchases?start_date=${startYTD}&end_date=${endYTD}&per_page=${PER_PAGE}`;

            log.debug('[PAC] Intentando cargar YTD (no-cache) con URL:', url);
            const resArr = await fetchAllPages(url);
            if (resArr && resArr.length > 0) {
              monthlyCollected.push(...resArr);
              if (useCache) setCache(ytdCacheKey, resArr, CACHE_TTL_MS);
              log.info(`[PAC] YTD cargado: ${resArr.length} registros (inicio=${startYTD} end=${endYTD})`);
            } else {
              log.warn('[PAC] YTD devolvió arreglo vacío, se hará fallback por meses');
            }
          } catch (ytdErr) {
            log.warn('[PAC] Falló YTD fetch (no-cache), se hará fallback por meses:', ytdErr);
          }
        }
      }

      // If YTD didn't fill monthlyCollected (or selectedYear != currentYear), fallback to month-by-month
      if (selectedYear !== currentYear || monthlyCollected.length === 0) {
        const lastMonthIndex = (selectedYear === currentYear) ? currentMonthZeroIndex : 11;
        for (let month = 0; month <= lastMonthIndex; month++) {
          const start = `${selectedYear}-${String(month + 1).padStart(2,'0')}-01`;
          const end = `${selectedYear}-${String(month + 1).padStart(2,'0')}-${String(lastDayOf(selectedYear, month)).padStart(2,'0')}`;
          const cacheKey = cacheKeyForRange(start, end);
          if (useCache) {
            const cached = getCache(cacheKey);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              log.debug(`[PAC] Cache hit ${cacheKey} -> ${cached.length} registros`);
              monthlyCollected.push(...cached);
              // small throttle to keep behavior consistent
              await sleep(60 + Math.floor(Math.random() * 120));
              continue;
            }
          }

          // try multiple URL patterns for compatibility (server will normally handle pagination)
          const urlsToTry = [
            resolveBaseUrlForMonth(selectedYear, month),
            DATA_SOURCE === 'local'
              ? `/api/siigo/get-purchases?get_all_pages=true&year=${selectedYear}&month=${month + 1}`
              : `${SIIGO_BASE_URL}/purchases?year=${selectedYear}&month=${month+1}`,
            DATA_SOURCE === 'local'
              ? `/api/siigo/get-purchases?get_all_pages=true&year=${selectedYear}&month=${month + 1}&per_page=${PER_PAGE}`
              : `${SIIGO_BASE_URL}/purchases?year=${selectedYear}&month=${month+1}&per_page=${PER_PAGE}`
          ];

          let monthData: any[] = [];
          let tried = 0;

          for (const u of urlsToTry) {
            tried++;
            try {
              log.debug(`[PAC] Fetching mes ${month + 1}/${selectedYear} intento ${tried}: ${u}`);
              await sleep(120 + Math.floor(Math.random() * 200)); // jitter before attempt

              const resArr = await fetchAllPages(u);
              if (resArr && resArr.length > 0) {
                monthData = resArr;
                log.info(`[PAC] Mes ${month + 1} cargado: ${resArr.length} registros (url usada: ${u})`);
                // save to cache
                if (useCache) setCache(cacheKey, resArr, CACHE_TTL_MS);
                break;
              } else {
                log.debug(`[PAC] Mes ${month + 1} respuesta vacía con url ${u}`);
              }
            } catch (err) {
              log.warn(`[PAC] Error cargando mes ${month + 1} con url ${u}:`, err);
              const m = String(err).toLowerCase();
              if (m.includes('unauthoriz')) {
                // Si la API local devolvió 401, informamos claramente
                throw new Error('Unauthorized (401) durante fetch mensual. Revisa token o endpoint de refresh en el servidor (/api/siigo/get-token).');
              }
              if (String(err).includes('requests_limit') || String(err).includes('rate limit')) {
                log.warn('[PAC] Detectado message de rate limit en error, esperando 8s');
                await sleep(8000 + Math.floor(Math.random() * 200));
              }
              await sleep(400 + Math.floor(Math.random() * 300));
              continue;
            }
          } // end urlsToTry

          if (monthData && monthData.length > 0) monthlyCollected.push(...monthData);
          // Espera adicional entre meses para reducir probabilidades de 429
          await sleep(240 + Math.floor(Math.random() * 380));
        } // end months
      }

      log.info(`[PAC] Carga completada. Registros totales sin dedupe: ${monthlyCollected.length}`);

      const deduped = dedupeInvoices(monthlyCollected);
      log.info(`[PAC] Después de dedupe: ${deduped.length} facturas únicas`);

      if (isMounted.current) {
        setAllInvoices(prev => {
          const others = prev.filter(inv => {
            const d = parseInvoiceDate(inv);
            return d ? d.getFullYear() !== selectedYear : true;
          });
          return [...others, ...deduped];
        });
      }

      const monthlyDataProcessed = processMonthlyData(deduped, selectedYear);

      const complete = generateEmptyYearData(selectedYear).map(md => {
        const found = monthlyDataProcessed.find(m => m.month === md.month);
        return found || md;
      }).sort((a,b) => a.month - b.month);

      if (isMounted.current) {
        setChartData(complete);
        const computed = calculateTotals(complete);
        setTotalFacturas(computed.totalInvoices);
        setTotalMonto(computed.totalAmount);
        setError(null);
        log.info(`[PAC] Procesamiento completado para ${selectedYear} - facturas: ${computed.totalInvoices}, monto: ${computed.totalAmount}`);
      }
    } catch (err: any) {
      log.error('[PAC] fetchPurchaseData error:', err?.message || err);
      if (isMounted.current) {
        setError(err?.message || 'Error al cargar datos');
        toast.error(`Error al cargar datos: ${err?.message || 'desconocido'}`);
        const empty = generateEmptyYearData(selectedYear);
        setChartData(empty);
        setTotalFacturas(0);
        setTotalMonto(0);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setLoadingProgress({ currentPage: 0, totalPages: 0, totalRecords: 0 });
      }
    }
  }, [fetchAllPages, selectedYear, useCache]);

  // each time year changes, fetch data
  useEffect(() => {
    fetchPurchaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Re-fetch automatically at start of next month (works while user has the app open)
  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleNextMonthUpdate = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0); // 00:05 del primer día del próximo mes
      const ms = nextMonth.getTime() - now.getTime();
      timeoutId = window.setTimeout(() => {
        log.info('[PAC] Mes nuevo detectado -> refrescando datos automáticamente');
        fetchPurchaseData();
        scheduleNextMonthUpdate(); // reprograma para el siguiente mes
      }, ms);
    };
    scheduleNextMonthUpdate();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [fetchPurchaseData]);

  /* ---------- auxiliares y render ---------- */
  const generateEmptyYearData = (year: number): ChartData[] => {
    const shortMonthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return shortMonthNames.map((name, idx) => ({
      name,
      facturas: 0,
      monto: 0,
      month: idx,
      year,
      fullDate: `${year}-${String(idx + 1).padStart(2,'0')}`
    }));
  };

  const processMonthlyData = (invoices: any[], year: number): ChartData[] => {
    if (!Array.isArray(invoices)) return generateEmptyYearData(year);
    const stats = Array.from({ length: 12 }, (_, i) => ({ month: i, facturas: 0, monto: 0 }));
    let valid = 0, invalid = 0;
    invoices.forEach((inv, idx) => {
      try {
        const d = parseInvoiceDate(inv);
        if (!d) { invalid++; log.debug(`[PAC] Factura idx=${idx} sin fecha válida id=${inv?.id || inv?.number || 'unknown'}`); return; }
        let invYear = d.getFullYear();
        if (invYear !== year) {
          if (inv.year && !Number.isNaN(Number(inv.year))) invYear = Number(inv.year);
          else if (inv.ano && !Number.isNaN(Number(inv.ano))) invYear = Number(inv.ano);
        }
        if (invYear !== year) return;
        const m = d.getMonth();
        if (m < 0 || m > 11) { invalid++; return; }
        const amount = Math.max(0, parseInvoiceAmount(inv));
        stats[m].facturas += 1;
        stats[m].monto += amount;
        valid++;
      } catch (e) {
        invalid++;
        log.error('[PAC] processMonthlyData error:', e);
      }
    });
    log.info(`[PAC] processMonthlyData result for ${year}: válidas=${valid} inválidas=${invalid}`);
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return stats.map(s => ({
      name: names[s.month],
      facturas: s.facturas,
      monto: s.monto,
      month: s.month,
      year,
      fullDate: `${year}-${String(s.month + 1).padStart(2,'0')}`
    }));
  };

  const calculateTotals = (data: ChartData[]) => data.reduce((acc, m) => ({
    totalInvoices: acc.totalInvoices + (m.facturas || 0),
    totalAmount: acc.totalAmount + (m.monto || 0)
  }), { totalInvoices: 0, totalAmount: 0 });

  const formatCurrency = (value: number): string => {
    if (isNaN(value) || value === 0) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value));
  };

  const handleYearChange = (inc: number) => {
    const currentYear = new Date().getFullYear();
    const ny = selectedYear + inc;
    // Prevent going back before 2025 in any case
    const minYear = 2025;
    const maxYear = currentYear + 1;
    if (ny >= minYear && ny <= maxYear) {
      setSelectedYear(ny);
    }
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length > 0) {
      const data: ChartData = payload[0].payload;
      return (
        <div className="rounded-md bg-white p-4 shadow-lg ring-1 ring-gray-200">
          <p className="font-medium text-gray-900">{format(new Date(data.year, data.month, 1), 'MMMM yyyy', { locale: es })}</p>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{(data.facturas || 0).toLocaleString('es-ES')}</span> facturas
          </p>
          <p className="text-lg font-semibold text-blue-600">{formatCurrency(data.monto || 0)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          {loadingProgress.totalPages > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Cargando página {loadingProgress.currentPage} de {loadingProgress.totalPages}</span>
                <span>{loadingProgress.totalRecords} registros cargados</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (loadingProgress.currentPage / Math.max(1, loadingProgress.totalPages)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-red-800">Error al cargar datos</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex space-x-2">
          <button onClick={() => fetchPurchaseData()} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Reintentar</button>
          <button onClick={() => window.location.reload()} className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">Recargar</button>
        </div>
      </div>
    );
  }

  const colors = {
    barGradientStart: '#3b82f6',
    barGradientEnd: '#1d4ed8',
    grid: '#e2e8f0',
    axis: '#6b7280'
  };

  return (
    <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Registro de Eventos</h3>
          <p className="text-sm text-gray-500">Eventos registrados por mes - {selectedYear}</p>
          <p className="text-xs text-gray-400">{allInvoices.length} eventos totales registrados</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleYearChange(-1)} disabled={selectedYear <= 2025} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-20 text-center font-medium">{selectedYear}</div>
          <Button variant="outline" size="sm" onClick={() => handleYearChange(1)} disabled={selectedYear >= new Date().getFullYear()} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-gray-50 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Anual</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalMonto)}</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Facturas</p>
            <p className="text-2xl font-bold text-gray-800">{totalFacturas.toLocaleString('es-ES')}</p>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }} barSize={24} barCategoryGap="6%" barGap={1}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.barGradientStart} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={colors.barGradientEnd} stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: colors.axis, fontSize: 11, fontWeight: 500 }} height={30} tickMargin={8} />
              <YAxis domain={[0, 'dataMax']} tickFormatter={(value) => value > 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000).toFixed(0)}K`} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} width={65} tickCount={5} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar dataKey="monto" radius={[4,4,0,0]} fill="url(#barGradient)" />
              <Legend verticalAlign="top" height={36} formatter={() => <span className="text-sm font-medium text-gray-600">Monto Facturado</span>} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-2 flex justify-center text-xs text-gray-500">
            <p>Análisis completo de compras mensuales para {selectedYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
