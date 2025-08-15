"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* =========================================================
 *  CONFIG (idéntico en espíritu al primer gráfico)
 * =======================================================*/
const DEBUG = true;
const PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 45000; // 45s por página
const MAX_PAGE_SAFE = 500; // límite duro de seguridad
const MIN_THROTTLE_MS = 160; // espera mínima entre páginas
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos en sessionStorage
const MAX_RETRIES_PER_PAGE = 5; // intentos por página antes de hacer skip controlado

// Fuente de datos: aquí SIEMPRE local (tu endpoint consolidado)
const DATA_SOURCE: "local" | "siigo" = "local";

// Para compatibilidad futura si quisieras llamar directo a Siigo
const SIIGO_BASE_URL =
  (typeof process !== "undefined" && (process.env as any)?.SIIGO_BASE_URL) ||
  "https://api.siigo.com/v1";

/* =========================================================
 *  Tipos
 * =======================================================*/
interface ChartData {
  name: string;
  facturas: number;
  monto: number;
  month: number; // 0-11
  year: number;
  fullDate: string; // YYYY-MM
}

interface LoadingProgress {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}

type AnyObject = Record<string, any>;

/* =========================================================
 *  Utils / Logger
 * =======================================================*/
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randJitter = (base = 200) => base + Math.floor(Math.random() * base);
const log = {
  debug: (...args: any[]) => DEBUG && console.debug("[PIAC]", ...args),
  info: (...args: any[]) => console.info("[PIAC]", ...args),
  warn: (...args: any[]) => console.warn("[PIAC]", ...args),
  error: (...args: any[]) => console.error("[PIAC]", ...args),
};

/* =========================================================
 *  Parsers y dedupe (robustos como el primer gráfico)
 * =======================================================*/
const parseInvoiceDate = (invoice: AnyObject): Date | null => {
  if (!invoice || typeof invoice !== "object") return null;
  const candidates = [
    invoice.date,
    invoice.created,
    invoice.creation_date,
    invoice.created_at,
    invoice.issue_date,
    invoice.issueDate,
    invoice.fecha,
    invoice.fecha_emision,
    invoice.emitted_at,
    invoice.datetime,
    invoice.timestamp,
  ];

  if (invoice.period && typeof invoice.period === "object") {
    const y = invoice.period.year || invoice.period.Y || invoice.period.ano;
    const m = invoice.period.month || invoice.period.M;
    if (
      y &&
      m &&
      !Number.isNaN(Number(y)) &&
      !Number.isNaN(Number(m))
    ) {
      const monthIndex = Math.max(0, Math.min(11, Number(m) - 1));
      return new Date(Number(y), monthIndex, 1);
    }
  }

  const altYear = invoice.year || invoice.ano || invoice.yr;
  const altMonth = invoice.month || invoice.mes || invoice.mon;
  if (
    altYear &&
    altMonth &&
    !Number.isNaN(Number(altYear)) &&
    !Number.isNaN(Number(altMonth))
  ) {
    return new Date(
      Number(altYear),
      Math.max(0, Math.min(11, Number(altMonth) - 1)),
      1
    );
  }

  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === "number" && Number.isFinite(c)) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d;
    }
    const s = String(c).trim();
    if (/^\d{4}-\d{2}(-\d{2})?/.test(s)) {
      const normalized = s.length === 7 ? `${s}-01` : s; // YYYY-MM → día 1
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

const parseInvoiceAmount = (invoice: AnyObject): number => {
  if (!invoice || typeof invoice !== "object") return 0;
  const fields = [
    "total",
    "amount",
    "value",
    "subtotal",
    "monto",
    "total_amount",
    "net_total",
  ];
  for (const f of fields) {
    const v = invoice[f];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^\d.-]/g, ""));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (Array.isArray(invoice.items) && invoice.items.length) {
    const sum = invoice.items.reduce((s: number, it: AnyObject) => {
      const itTotal =
        typeof it.total === "number"
          ? it.total
          : typeof it.amount === "number"
          ? it.amount
          : parseFloat(
              String(
                it.total ||
                  it.amount ||
                  (it.price && it.quantity
                    ? Number(it.price) * Number(it.quantity)
                    : "0")
              ).replace(/[^\d.-]/g, "")
            ) || 0;
      return s + (Number.isNaN(itTotal) ? 0 : itTotal);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
};

const dedupeInvoices = (arr: AnyObject[]): AnyObject[] => {
  const map = new Map<string, AnyObject>();
  for (const inv of arr) {
    const id =
      String(inv?.id ?? inv?.number ?? inv?.reference ?? inv?.code ?? "")
        .trim() || JSON.stringify(inv || {});
    if (!map.has(id)) map.set(id, inv);
    else {
      const existing = map.get(id)!;
      const existingScore = existing ? Object.keys(existing).length : 0;
      const newScore = inv ? Object.keys(inv).length : 0;
      if (newScore > existingScore) map.set(id, inv);
    }
  }
  return Array.from(map.values());
};

/* =========================================================
 *  Cache layer (sessionStorage) – por rango de fechas
 * =======================================================*/
const cacheKeyForRange = (start: string, end: string) => `piac:${start}:${end}`;
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
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
};

/* =========================================================
 *  fetchAllPages (robusto) – detecta API local y deja al servidor paginar
 * =======================================================*/
const buildFetchUrl = (base: string, page: number) =>
  base.includes("?")
    ? `${base}&page=${page}&per_page=${PER_PAGE}`
    : `${base}?page=${page}&per_page=${PER_PAGE}`;

const fetchAllPagesFactory = (
  progressCb?: (p: LoadingProgress) => void
) => {
  return async (baseUrl: string, maxRetriesForPage = MAX_RETRIES_PER_PAGE) => {
    const collected: AnyObject[] = [];

    const isLocalApi = (u: string) => {
      try {
        if (typeof window === "undefined") return u.startsWith("/api/");
        const origin = window.location.origin;
        return u.startsWith("/api/") || u.startsWith(`${origin}/api/`);
      } catch (e) {
        return u.startsWith("/api/");
      }
    };

    // Para API local consolidada: el servidor hace la paginación (get_all_pages=true)
    if (isLocalApi(baseUrl)) {
      try {
        log.debug("[PIAC] Local API detected → server-side pagination:", baseUrl);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const res = await fetch(baseUrl, {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const t = await res.text().catch(() => res.statusText);
          throw new Error(`Local API HTTP ${res.status}: ${t}`);
        }
        const body: AnyObject = (await res.json().catch(() => null)) || {};
        // Intentar encontrar el array de items en diversas propiedades
        const candidates = [
          body.results,
          body.purchases,
          body.items,
          body.data,
          body.documents,
          Array.isArray(body) ? body : null,
        ].filter(Boolean);
        const arr = candidates.find((c: any) => Array.isArray(c)) as AnyObject[] | undefined;
        return Array.isArray(arr) ? arr : [];
      } catch (err: any) {
        log.error("[PIAC] fetchAllPages local error:", err?.message || err);
        throw err;
      }
    }

    // API externa (no usada aquí, pero mantenemos la robustez)
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
          log.debug(`[PIAC] Request page ${page} attempt ${attempt}: ${url}`);
          const res = await fetch(url, { method: "GET", signal: controller.signal });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const t = await res.text().catch(() => res.statusText);
            throw new Error(`HTTP ${res.status}: ${t}`);
          }

          const body = (await res.json().catch(() => null)) || {};
          let pageData: AnyObject[] = [];
          let paginationInfo: AnyObject | null = null;

          if (Array.isArray(body)) pageData = body;
          else if (Array.isArray(body?.results)) {
            pageData = body.results;
            paginationInfo = body.pagination || body.meta || body;
          } else if (Array.isArray(body?.data)) {
            pageData = body.data;
            paginationInfo = body.pagination || body.meta || body;
          } else {
            const props = ["items", "purchases", "documents", "rows"];
            for (const p of props) if (Array.isArray((body as AnyObject)?.[p])) pageData = (body as AnyObject)[p];
            paginationInfo = body?.pagination || body?.meta || body;
          }

          if (paginationInfo) {
            const tp =
              paginationInfo.total_pages ||
              paginationInfo.last_page ||
              paginationInfo.totalPages ||
              paginationInfo.total;
            if (tp && Number.isFinite(Number(tp))) totalPages = Number(tp);
            else if (paginationInfo.total_records && paginationInfo.per_page)
              totalPages = Math.ceil(
                Number(paginationInfo.total_records) / Number(paginationInfo.per_page)
              );
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
          const msg = err?.message || String(err);
          log.error(`[PIAC] Error page ${page} attempt ${attempt}:`, msg);
          if (attempt >= maxRetriesForPage) {
            log.warn(`[PIAC] Max retries alcanzado en página ${page}, skip.`);
            pageSucceeded = true;
          } else {
            const wait = Math.min(60000, 400 * Math.pow(2, attempt));
            await sleep(wait + randJitter(200));
          }
        }
      }

      page++;
      await sleep(MIN_THROTTLE_MS + Math.floor(Math.random() * 120));
    }

    log.info(`[PIAC] fetchAllPages finalizado: ${collected.length} registros`);
    return collected;
  };
};

/* =========================================================
 *  Componente Principal – réplica del diseño/UX del original
 * =======================================================*/
export default function PurchaseInvoicesAnalyticsChart(): React.ReactElement {
  // Estado UI
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFacturas, setTotalFacturas] = useState<number>(0);
  const [totalMonto, setTotalMonto] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [allInvoices, setAllInvoices] = useState<AnyObject[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    currentPage: 0,
    totalPages: 0,
    totalRecords: 0,
  });
  const [useCache, setUseCache] = useState(true);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allInvoices.forEach((inv) => {
      const d = parseInvoiceDate(inv);
      if (d) years.add(d.getFullYear());
      if (inv && inv.year && !Number.isNaN(Number(inv.year))) years.add(Number(inv.year));
    });
    if (years.size === 0) {
      // si aún no hay datos, no imponemos año mínimo
      const cy = new Date().getFullYear();
      for (let i = cy - 2; i <= cy; i++) years.add(i);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices]);

  // fetchAllPages preparado con callback de progreso
  const fetchAllPages = useMemo(
    () =>
      fetchAllPagesFactory((p) => {
        if (isMounted.current) setLoadingProgress(p);
      }),
    []
  );

  const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  // Construye URL base para un rango/mes usando el endpoint NUEVO /api/siigo/get-all-purchases
  const buildLocalUrl = (start: string, end: string) => {
    // get_all_pages=true → el servidor consolida la paginación y devuelve todo
    return `/api/siigo/get-all-purchases?get_all_pages=true&startDate=${start}&endDate=${end}&per_page=${PER_PAGE}`;
  };

  // Carga de datos principal (YTD → fallback por meses), idéntico en espíritu
  const fetchPurchaseData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ currentPage: 0, totalPages: 0, totalRecords: 0 });

    try {
      log.info(`[PIAC] Iniciando carga año ${selectedYear}`);
      const monthlyCollected: AnyObject[] = [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthZeroIndex = now.getMonth();

      // Si es año actual: intento YTD (enero → hoy) primero
      if (selectedYear === currentYear) {
        const startYTD = `${selectedYear}-01-01`;
        const endYTD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate()
        ).padStart(2, "0")}`;
        const ytdCacheKey = cacheKeyForRange(startYTD, endYTD);

        let ytdFromCache: AnyObject[] | null = null;
        if (useCache) ytdFromCache = getCache(ytdCacheKey);
        if (ytdFromCache && Array.isArray(ytdFromCache) && ytdFromCache.length > 0) {
          log.debug(`[PIAC] Cache YTD hit ${ytdCacheKey} (${ytdFromCache.length})`);
          monthlyCollected.push(...ytdFromCache);
        } else {
          try {
            const url = buildLocalUrl(startYTD, endYTD);
            log.debug("[PIAC] Intento YTD:", url);
            const resArr = await fetchAllPages(url);
            if (resArr && resArr.length > 0) {
              monthlyCollected.push(...resArr);
              if (useCache) setCache(ytdCacheKey, resArr, CACHE_TTL_MS);
              log.info(`[PIAC] YTD cargado: ${resArr.length} registros`);
            } else {
              log.warn("[PIAC] YTD vacío, fallback mensual");
            }
          } catch (e) {
            log.warn("[PIAC] YTD falló, fallback mensual:", e);
          }
        }
      }

      // Si YTD no trajo datos o año ≠ actual → cargar mes a mes
      if (selectedYear !== currentYear || monthlyCollected.length === 0) {
        const lastMonthIndex = selectedYear === currentYear ? currentMonthZeroIndex : 11;
        for (let month = 0; month <= lastMonthIndex; month++) {
          const start = `${selectedYear}-${String(month + 1).padStart(2, "0")}-01`;
          const end = `${selectedYear}-${String(month + 1).padStart(2, "0")}-${String(
            lastDayOf(selectedYear, month)
          ).padStart(2, "0")}`;
          const cacheKey = cacheKeyForRange(start, end);

          const cached = useCache ? getCache(cacheKey) : null;
          if (cached && Array.isArray(cached) && cached.length > 0) {
            log.debug(`[PIAC] Cache hit ${cacheKey} (${cached.length})`);
            monthlyCollected.push(...cached);
            await sleep(60 + Math.floor(Math.random() * 120));
            continue;
          }

          const url = buildLocalUrl(start, end);
          try {
            log.debug(`[PIAC] Fetch mes ${month + 1}/${selectedYear}: ${url}`);
            await sleep(120 + Math.floor(Math.random() * 200));
            const resArr = await fetchAllPages(url);
            if (resArr && resArr.length > 0) {
              monthlyCollected.push(...resArr);
              if (useCache) setCache(cacheKey, resArr, CACHE_TTL_MS);
              log.info(`[PIAC] Mes ${month + 1} OK (${resArr.length})`);
            } else {
              log.debug(`[PIAC] Mes ${month + 1} vacío`);
            }
          } catch (err) {
            log.warn(`[PIAC] Error mes ${month + 1}:`, err);
            await sleep(300 + Math.floor(Math.random() * 300));
          }

          // Pequeño throttle entre meses
          await sleep(200 + Math.floor(Math.random() * 360));
        }
      }

      log.info(`[PIAC] Registros sin dedupe: ${monthlyCollected.length}`);
      const deduped = dedupeInvoices(monthlyCollected);
      log.info(`[PIAC] Después de dedupe: ${deduped.length}`);

      if (isMounted.current) {
        // Mantener en memoria todo el universo cargado para calcular availableYears
        setAllInvoices((prev) => {
          const others = prev.filter((inv) => {
            const d = parseInvoiceDate(inv);
            return d ? d.getFullYear() !== selectedYear : true;
          });
          return [...others, ...deduped];
        });
      }

      const monthlyDataProcessed = processMonthlyData(deduped, selectedYear);
      const complete = generateEmptyYearData(selectedYear)
        .map((md) => {
          const found = monthlyDataProcessed.find((m) => m.month === md.month);
          return found || md;
        })
        .sort((a, b) => a.month - b.month);

      if (isMounted.current) {
        setChartData(complete);
        const computed = calculateTotals(complete);
        setTotalFacturas(computed.totalInvoices);
        setTotalMonto(computed.totalAmount);
        setError(null);
        log.info(
          `[PIAC] Procesado ${selectedYear}: facturas=${computed.totalInvoices}, monto=${computed.totalAmount}`
        );
      }
    } catch (err: any) {
      log.error("[PIAC] fetchPurchaseData error:", err?.message || err);
      if (isMounted.current) {
        setError(err?.message || "Error al cargar datos");
        toast.error(`Error al cargar datos: ${err?.message || "desconocido"}`);
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

  // Cargar cuando cambie el año
  useEffect(() => {
    fetchPurchaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Re-fetch automático al iniciar mes nuevo (si el dashboard queda abierto)
  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleNextMonthUpdate = () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0);
      const ms = nextMonth.getTime() - now.getTime();
      timeoutId = window.setTimeout(() => {
        log.info("[PIAC] Nuevo mes → refresh automático");
        fetchPurchaseData();
        scheduleNextMonthUpdate();
      }, ms);
    };
    scheduleNextMonthUpdate();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [fetchPurchaseData]);

  /* =========================================================
   *  Auxiliares de datos y formato
   * =======================================================*/
  const generateEmptyYearData = (year: number): ChartData[] => {
    const shortMonthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    return shortMonthNames.map((name, idx) => ({
      name,
      facturas: 0,
      monto: 0,
      month: idx,
      year,
      fullDate: `${year}-${String(idx + 1).padStart(2, "0")}`,
    }));
  };

  const processMonthlyData = (invoices: AnyObject[], year: number): ChartData[] => {
    if (!Array.isArray(invoices)) return generateEmptyYearData(year);
    const stats = Array.from({ length: 12 }, (_, i) => ({ month: i, facturas: 0, monto: 0 }));
    let valid = 0,
      invalid = 0;
    invoices.forEach((inv, idx) => {
      try {
        const d = parseInvoiceDate(inv);
        if (!d) {
          invalid++;
          log.debug(`[PIAC] Factura idx=${idx} sin fecha válida id=${inv?.id || inv?.number || "unknown"}`);
          return;
        }
        let invYear = d.getFullYear();
        if (invYear !== year) {
          if (inv.year && !Number.isNaN(Number(inv.year))) invYear = Number(inv.year);
          else if (inv.ano && !Number.isNaN(Number(inv.ano))) invYear = Number(inv.ano);
        }
        if (invYear !== year) return;
        const m = d.getMonth();
        if (m < 0 || m > 11) {
          invalid++;
          return;
        }
        const amount = Math.max(0, parseInvoiceAmount(inv));
        stats[m].facturas += 1;
        stats[m].monto += amount;
        valid++;
      } catch (e) {
        invalid++;
        log.error("[PIAC] processMonthlyData error:", e);
      }
    });
    log.info(`[PIAC] processMonthlyData ${year}: válidas=${valid} inválidas=${invalid}`);
    const names = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    return stats.map((s) => ({
      name: names[s.month],
      facturas: s.facturas,
      monto: s.monto,
      month: s.month,
      year,
      fullDate: `${year}-${String(s.month + 1).padStart(2, "0")}`,
    }));
  };

  const calculateTotals = (data: ChartData[]) =>
    data.reduce(
      (acc, m) => ({
        totalInvoices: acc.totalInvoices + (m.facturas || 0),
        totalAmount: acc.totalAmount + (m.monto || 0),
      }),
      { totalInvoices: 0, totalAmount: 0 }
    );

  const formatCurrency = (value: number): string => {
    if (isNaN(value) || value === 0) return "$0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  const handleYearChange = (inc: number) => {
    const newYear = selectedYear + inc;
    // Prevent going before 2025
    if (newYear >= 2025) {
      setSelectedYear(newYear);
    }
  };

  /* =========================================================
   *  UI (igual estilo y colores que el primer gráfico)
   * =======================================================*/
  const colors = {
    barGradientStart: "#3b82f6", // Tailwind blue-500
    barGradientEnd: "#1d4ed8", // Tailwind blue-700
    grid: "#e2e8f0", // slate-200
    axis: "#6b7280", // gray-500
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: any[];
  }) => {
    if (active && payload && payload.length > 0) {
      const data: ChartData = payload[0].payload;
      return (
        <div className="rounded-md bg-white p-4 shadow-lg ring-1 ring-gray-200">
          <p className="font-medium text-gray-900">
            {format(new Date(data.year, data.month, 1), "MMMM yyyy", { locale: es })}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{(data.facturas || 0).toLocaleString("es-ES")}</span>{" "}
            facturas
          </p>
          <p className="text-lg font-semibold text-blue-600">
            {formatCurrency(data.monto || 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="mb-4 h-4 w-64" />
          {loadingProgress.totalPages > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>
                  Cargando página {loadingProgress.currentPage} de {loadingProgress.totalPages}
                </span>
                <span>{loadingProgress.totalRecords} registros cargados</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (loadingProgress.currentPage / Math.max(1, loadingProgress.totalPages)) * 100
                    )}%`,
                  }}
                />
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
        <p className="mb-4 text-red-600">{error}</p>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchPurchaseData()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
      {/* Header con control de año (sin límite inferior) */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Facturas de Compra</h3>
          <p className="text-sm text-gray-500">Facturado por mes - {selectedYear}</p>
          <p className="text-xs text-gray-400">{allInvoices.length} facturas totales procesadas</p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleYearChange(-1)}
            className="h-8 w-8 p-0"
            disabled={selectedYear <= 2025}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="w-20 text-center font-medium">{selectedYear}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleYearChange(1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="p-4 pt-0">
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-gray-50 p-4 shadow-sm">
            <p className="mb-1 text-sm font-medium text-gray-500">Total Anual</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalMonto)}</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4 shadow-sm">
            <p className="mb-1 text-sm font-medium text-gray-500">Total Facturas</p>
            <p className="text-2xl font-bold text-gray-800">{totalFacturas.toLocaleString("es-ES")}</p>
          </div>
        </div>

        {/* Chart idéntico en estilo */}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              barSize={24}
              barCategoryGap="6%"
              barGap={1}
            >
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.barGradientStart} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={colors.barGradientEnd} stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.axis, fontSize: 11, fontWeight: 500 }}
                height={30}
                tickMargin={8}
              />
              <YAxis
                domain={[0, "dataMax"]}
                tickFormatter={(value) =>
                  value > 1_000_000
                    ? `$${(value / 1_000_000).toFixed(1)}M`
                    : `$${(value / 1_000).toFixed(0)}K`
                }
                tick={{ fill: colors.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={65}
                tickCount={5}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
              <Bar dataKey="monto" radius={[4, 4, 0, 0]} fill="url(#barGradient)" />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={() => (
                  <span className="text-sm font-medium text-gray-600">Monto Facturado</span>
                )}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-2 flex justify-center text-xs text-gray-500">
            <p>Resumen mensual de facturas para {selectedYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
