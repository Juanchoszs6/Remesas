import { NextRequest, NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '../auth/route';

export async function GET(request: NextRequest) {
  try {
    // Obtener el parámetro CUFE de la URL
    const searchParams = request.nextUrl.searchParams;
    const cufe = searchParams.get('cufe');

    if (!cufe) {
      return NextResponse.json(
        { error: 'El parámetro CUFE es requerido' },
        { status: 400 }
      );
    }

    console.log(`[SEARCH-INVOICE] Buscando factura con CUFE: ${cufe}`);

    // Obtener token de autenticación
    const siigoToken = await obtenerTokenSiigo();
    const partnerId = process.env.SIIGO_PARTNER_ID;

    if (!siigoToken || !partnerId) {
      console.error('[SEARCH-INVOICE] Error: Faltan credenciales de Siigo');
      return NextResponse.json(
        {
          error: 'Error de autenticación',
          details: 'No se pudieron obtener las credenciales de Siigo',
        },
        { status: 500 }
      );
    }

    // Realizar la búsqueda en Siigo
    const siigoResponse = await fetch(
      `https://api.siigo.com/v1/purchases?cufe=${encodeURIComponent(cufe)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${siigoToken}`,
          'Partner-Id': partnerId,
        },
      }
    );

    const responseData = await siigoResponse.json();

    if (!siigoResponse.ok) {
      console.error('[SEARCH-INVOICE] Error en respuesta de Siigo:', {
        status: siigoResponse.status,
        error: responseData,
      });

      return NextResponse.json(
        {
          error: 'Error al buscar la factura en Siigo',
          message: responseData.message || responseData.error || 'Error desconocido',
          status: siigoResponse.status,
        },
        { status: siigoResponse.status }
      );
    }

    console.log('[SEARCH-INVOICE] Factura encontrada:', {
      id: responseData.id,
      number: responseData.number,
    });

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[SEARCH-INVOICE] Error general:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
