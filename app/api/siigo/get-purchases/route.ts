import { NextResponse } from 'next/server';

// Configuración de debugging
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[SIIGO-GET-PURCHASES] ${new Date().toISOString()}: ${message}`);
    if (data) {
      console.log('[SIIGO-GET-PURCHASES] Data:', JSON.stringify(data, null, 2));
    }
  }
}

function debugError(message: string, error: unknown): void {
  console.error(`[SIIGO-GET-PURCHASES] ERROR ${new Date().toISOString()}: ${message}`);
  console.error('[SIIGO-GET-PURCHASES] Error details:', error);
}

// Función para obtener token de autenticación de Siigo
async function getSiigoToken(): Promise<string | null> {
  try {
    debugLog('Obteniendo token de autenticación...');
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/siigo`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      debugError('Error al obtener token', await response.text());
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    debugError('Error en getSiigoToken', error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('page_size') || '50';

  debugLog('Solicitud de compras recibida', { startDate, endDate, page, pageSize });

  try {
    // Obtener el token de autenticación
    const token = await getSiigoToken();
    if (!token) {
      debugError('No se pudo obtener el token de autenticación', null);
      return NextResponse.json(
        { error: 'Error de autenticación con Siigo' },
        { status: 401 }
      );
    }

    // Construir la URL de la API de Siigo con los parámetros de consulta
    const queryParams = new URLSearchParams({
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
      page,
      page_size: pageSize,
    });

    const siigoApiUrl = `https://api.siigo.com/v1/purchases?${queryParams.toString()}`;
    
    debugLog('Solicitando datos a Siigo API', { url: siigoApiUrl });

    // Realizar la solicitud a la API de Siigo
    const response = await fetch(siigoApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugError('Error en la respuesta de Siigo API', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          error: 'Error al obtener las compras de Siigo',
          details: errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    debugLog('Datos recibidos de Siigo API', { count: data.results?.length || 0 });

    return NextResponse.json(data);
  } catch (error) {
    debugError('Error en el servidor', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
