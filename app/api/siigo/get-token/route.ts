// app/api/siigo/get-purchases/route.ts

import { NextResponse } from 'next/server';

const SIIGO_API_URL = 'https://api.siigo.com/v1';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

// Cache en memoria para token y datos
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;
let cachedPurchases: any[] | null = null;
let cachedPurchasesExpiry = 0;

// Obtener token de Siigo con cache
async function getToken() {
  const now = Date.now();

  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const authRes = await fetch(`${SIIGO_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.SIIGO_USERNAME,
      access_key: process.env.SIIGO_ACCESS_KEY,
    }),
  });

  if (!authRes.ok) {
    throw new Error(`Error autenticando con Siigo: ${authRes.statusText}`);
  }

  const { access_token, expires_in } = await authRes.json();
  cachedToken = access_token;
  cachedTokenExpiry = now + (expires_in - 60) * 1000; // Expira un poco antes para seguridad
  return access_token;
}

// Obtener compras con paginación
async function fetchAllPurchases(token: string) {
  let purchases: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${SIIGO_API_URL}/purchases?page=${page}&page_size=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Error obteniendo compras (página ${page}): ${res.statusText}`);
    }

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      purchases = purchases.concat(data.results);
      page++;
    } else {
      hasMore = false;
    }
  }

  return purchases;
}

export async function GET() {
  try {
    const now = Date.now();

    // Si está en cache, devolver directamente
    if (cachedPurchases && now < cachedPurchasesExpiry) {
      return NextResponse.json({ purchases: cachedPurchases, cached: true });
    }

    // Obtener token válido
    const token = await getToken();

    // Obtener todas las compras paginadas
    const purchases = await fetchAllPurchases(token);

    // Guardar en cache
    cachedPurchases = purchases;
    cachedPurchasesExpiry = now + CACHE_DURATION_MS;

    return NextResponse.json({ purchases, cached: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
