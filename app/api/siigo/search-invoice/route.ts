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

    // Obtener token de autenticación (siempre solicitar un token nuevo)
    const siigoToken = await obtenerTokenSiigo();
    const partnerId = process.env.SIIGO_PARTNER_ID;

    if (!siigoToken || !partnerId) {
      console.error('[SEARCH-INVOICE] Error: Faltan credenciales de Siigo');
      return NextResponse.json(
        {
          error: 'Error de autenticación',
          details: 'No se pudieron obtener las credenciales de Siigo',
          message: 'Verifique que las credenciales de Siigo estén configuradas correctamente',
        },
        { status: 401 }
      );
    }

    // Paso 1: Realizar la búsqueda en Siigo por CUFE
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

      // Si el error es de autenticación (401), intentar obtener un nuevo token
      if (siigoResponse.status === 401) {
        console.log('[SEARCH-INVOICE] Token expirado, intentando obtener uno nuevo...');
        // Intentar obtener un nuevo token y reintentar la solicitud
        const newToken = await obtenerTokenSiigo();
        
        if (newToken) {
          console.log('[SEARCH-INVOICE] Nuevo token obtenido, reintentando solicitud...');
          // Reintentar la solicitud con el nuevo token
          const retryResponse = await fetch(
            `https://api.siigo.com/v1/purchases?cufe=${encodeURIComponent(cufe)}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${newToken}`,
                'Partner-Id': partnerId,
              },
            }
          );
          
          if (retryResponse.ok) {
            // Si el reintento fue exitoso, continuar con el flujo normal
            const retryData = await retryResponse.json();
            responseData.results = retryData.results;
          } else {
            // Si el reintento también falló, devolver el error
            const retryErrorData = await retryResponse.json();
            return NextResponse.json(
              {
                error: 'Error al buscar la factura en Siigo después de renovar el token',
                message: retryErrorData.message || retryErrorData.error || 'Error desconocido',
                status: retryResponse.status,
              },
              { status: retryResponse.status }
            );
          }
        } else {
          return NextResponse.json(
            {
              error: 'Error de autenticación',
              message: 'No se pudo renovar el token de autenticación',
              status: 401,
            },
            { status: 401 }
          );
        }
      } else {
        // Para otros errores que no sean de autenticación
        return NextResponse.json(
          {
            error: 'Error al buscar la factura en Siigo',
            message: responseData.message || responseData.error || 'Error desconocido',
            status: siigoResponse.status,
          },
          { status: siigoResponse.status }
        );
      }
    }

    // Verificar si se encontraron resultados
    if (!responseData.results || responseData.results.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No se encontró ninguna factura con el CUFE proporcionado',
      }, { status: 404 });
    }

    // Obtener el ID de la primera factura encontrada
    const invoiceId = responseData.results[0].id;
    console.log(`[SEARCH-INVOICE] Factura encontrada con ID: ${invoiceId}`);

    // Paso 2: Obtener los detalles completos de la factura usando su ID
    const detailsResponse = await fetch(
      `https://api.siigo.com/v1/purchases/${invoiceId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${siigoToken}`,
          'Partner-Id': partnerId,
        },
      }
    );

    const detailsData = await detailsResponse.json();

    if (!detailsResponse.ok) {
      console.error('[SEARCH-INVOICE] Error al obtener detalles de la factura:', {
        status: detailsResponse.status,
        error: detailsData,
      });

      // Si el error es de autenticación (401), intentar obtener un nuevo token
      if (detailsResponse.status === 401) {
        console.log('[SEARCH-INVOICE] Token expirado al obtener detalles, intentando obtener uno nuevo...');
        // Intentar obtener un nuevo token y reintentar la solicitud
        const newToken = await obtenerTokenSiigo();
        
        if (newToken) {
          console.log('[SEARCH-INVOICE] Nuevo token obtenido, reintentando solicitud de detalles...');
          // Reintentar la solicitud con el nuevo token
          const retryDetailsResponse = await fetch(
            `https://api.siigo.com/v1/purchases/${invoiceId}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${newToken}`,
                'Partner-Id': partnerId,
              },
            }
          );
          
          if (retryDetailsResponse.ok) {
            // Si el reintento fue exitoso, continuar con el flujo normal
            const retryDetailsData = await retryDetailsResponse.json();
            return NextResponse.json(retryDetailsData);
          } else {
            // Si el reintento también falló, devolver el error
            const retryErrorData = await retryDetailsResponse.json();
            return NextResponse.json({
              error: 'Error al obtener los detalles de la factura después de renovar el token',
              message: retryErrorData.message || retryErrorData.error || 'Error desconocido',
              status: retryDetailsResponse.status,
            }, { status: retryDetailsResponse.status });
          }
        } else {
          return NextResponse.json({
            error: 'Error de autenticación',
            message: 'No se pudo renovar el token de autenticación',
            status: 401,
          }, { status: 401 });
        }
      } else {
        // Para otros errores que no sean de autenticación
        return NextResponse.json({
          error: 'Error al obtener los detalles de la factura',
          message: detailsData.message || detailsData.error || 'Error desconocido',
          status: detailsResponse.status,
        }, { status: detailsResponse.status });
      }
    }

    console.log('[SEARCH-INVOICE] Detalles de factura obtenidos correctamente:', {
      id: detailsData.id,
      number: detailsData.number,
    });

    return NextResponse.json({
      success: true,
      data: detailsData,
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
