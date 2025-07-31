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
    
    // Verificar que las variables de entorno estén definidas
    const authUrl = process.env.SIIGO_AUTH_URL;
    const username = process.env.SIIGO_USERNAME;
    const accessKey = process.env.SIIGO_ACCESS_KEY;
    const partnerId = process.env.SIIGO_PARTNER_ID;

    if (!authUrl || !username || !accessKey || !partnerId) {
      debugError('Faltan variables de entorno para la autenticación', { 
        authUrl: !!authUrl, 
        username: !!username, 
        accessKey: !!accessKey, 
        partnerId: !!partnerId 
      });
      return null;
    }
    
    debugLog('Realizando solicitud directa a Siigo Auth API', { authUrl });
    
    // Realizar solicitud directa a la API de autenticación de Siigo
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': partnerId,
      },
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
    });

    if (!response.ok) {
      debugError('Error al obtener token directamente de Siigo', await response.text());
      return null;
    }

    const data = await response.json();
    debugLog('Token obtenido correctamente');
    return data.access_token;
  } catch (error) {
    debugError('Error en getSiigoToken', error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('created_start') || '';
  const endDate = searchParams.get('created_end') || '';
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('page_size') || '50';
  const getAllPages = searchParams.get('get_all_pages') === 'true';
  
  // Convertir fechas a objetos Date para filtrado posterior
  const startDateObj = startDate ? new Date(startDate) : null;
  const endDateObj = endDate ? new Date(endDate) : null;

  debugLog('Solicitud de compras recibida', { startDate, endDate, page, pageSize, getAllPages });

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

    // Función para obtener una página de resultados
    async function fetchPage(pageNum: string) {
      const queryParams = new URLSearchParams({
        ...(startDate && { created_start: startDate }),
        ...(endDate && { created_end: endDate }),
        page: pageNum,
        page_size: pageSize,
      });

      const siigoApiUrl = `https://api.siigo.com/v1/purchases?${queryParams.toString()}`;
      
      debugLog(`Solicitando datos a Siigo API - Página ${pageNum}`, { url: siigoApiUrl });

      const response = await fetch(siigoApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
        },
      });
      
      if (!response.ok) {
        debugError(`Error en la respuesta de Siigo API - Página ${pageNum}`, {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Error al obtener la página ${pageNum}: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    }

    // Si se solicitan todas las páginas, obtener múltiples páginas
    if (getAllPages) {
      debugLog('Obteniendo todas las páginas de resultados');
      
      // Obtener la primera página para saber el total de páginas
      const firstPageData = await fetchPage('1');
      
      if (!firstPageData || !firstPageData.results) {
        debugError('Formato de respuesta inesperado en la primera página', firstPageData);
        return NextResponse.json(
          { error: 'Formato de respuesta inesperado de Siigo API' },
          { status: 500 }
        );
      }
      
      // Calcular el número total de páginas
      const totalItems = firstPageData.pagination?.total_items || 0;
      const itemsPerPage = parseInt(pageSize);
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      
      debugLog('Información de paginación', { 
        totalItems, 
        itemsPerPage, 
        totalPages,
        currentResults: firstPageData.results.length
      });
      
      // Si solo hay una página, filtrar los resultados por fecha y devolverlos
      if (totalPages <= 1) {
        debugLog('Solo hay una página de resultados, filtrando por fecha');
        
        // Verificar las fechas de las facturas recibidas
        if (firstPageData.results && Array.isArray(firstPageData.results)) {
          const sampleInvoices = firstPageData.results.slice(0, 5);
          debugLog('Muestra de fechas de facturas (antes de filtrar):', sampleInvoices.map((invoice: any) => ({
            id: invoice.id,
            date: invoice.date,
            created: invoice.created,
          })));
          
          // Filtrar resultados por fecha si se especificaron fechas
          if (startDateObj || endDateObj) {
            debugLog('Aplicando filtro de fechas en el servidor', { startDate, endDate });
            
            const filteredResults = firstPageData.results.filter((invoice: any) => {
              const invoiceDate = new Date(invoice.date);
              
              // Verificar si la fecha de la factura está dentro del rango especificado
              const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
              const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
              
              return afterStartDate && beforeEndDate;
            });
            
            debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${firstPageData.results.length}`);
            
            // Actualizar los resultados y la paginación
            const filteredResponse = {
              ...firstPageData,
              results: filteredResults,
              pagination: {
                ...firstPageData.pagination,
                total_items: filteredResults.length,
                filtered_by_server: true
              }
            };
            
            return NextResponse.json(filteredResponse);
          }
        }
        
        return NextResponse.json(firstPageData);
      }
      
      // Obtener el resto de las páginas (máximo 5 páginas para evitar sobrecarga)
      const maxPages = Math.min(totalPages, 5);
      debugLog(`Obteniendo ${maxPages} páginas de resultados`);
      
      const pagePromises = [];
      for (let i = 2; i <= maxPages; i++) {
        pagePromises.push(fetchPage(i.toString()));
      }
      
      // Esperar a que todas las solicitudes se completen
      const additionalPagesData = await Promise.all(pagePromises);
      
      // Combinar los resultados de todas las páginas
      const allResults = [...firstPageData.results];
      
      for (const pageData of additionalPagesData) {
        if (pageData && pageData.results && Array.isArray(pageData.results)) {
          allResults.push(...pageData.results);
        }
      }
      
      // Verificar las fechas de una muestra de facturas antes de filtrar
      const sampleInvoices = allResults.slice(0, 5);
      debugLog('Muestra de fechas de facturas (combinadas, antes de filtrar):', sampleInvoices.map((invoice: any) => ({
        id: invoice.id,
        date: invoice.date,
        created: invoice.created,
      })));
      
      // Filtrar resultados por fecha si se especificaron fechas
      let filteredResults = allResults;
      if (startDateObj || endDateObj) {
        debugLog('Aplicando filtro de fechas en el servidor para resultados combinados', { startDate, endDate });
        
        filteredResults = allResults.filter((invoice: any) => {
          const invoiceDate = new Date(invoice.date);
          
          // Verificar si la fecha de la factura está dentro del rango especificado
          const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
          const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
          
          return afterStartDate && beforeEndDate;
        });
        
        debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${allResults.length}`);
      }
      
      // Crear un objeto de respuesta combinado
      const combinedResponse = {
        ...firstPageData,
        results: filteredResults,
        pagination: {
          ...firstPageData.pagination,
          page: '1',
          pages_fetched: maxPages,
          total_items: filteredResults.length,
          original_total_items: allResults.length,
          filtered_by_server: startDateObj || endDateObj ? true : false
        }
      };
      
      debugLog('Datos combinados de múltiples páginas', { 
        totalPages: maxPages,
        totalResultsBeforeFilter: allResults.length,
        totalResultsAfterFilter: filteredResults.length
      });
      
      return NextResponse.json(combinedResponse);
    } else {
      // Comportamiento original: obtener solo una página
      const responseData = await fetchPage(page);
      
      // Verificar las fechas de las facturas recibidas
      if (responseData.results && Array.isArray(responseData.results)) {
        const sampleInvoices = responseData.results.slice(0, 5);
        debugLog('Muestra de fechas de facturas (antes de filtrar):', sampleInvoices.map((invoice: any) => ({
          id: invoice.id,
          date: invoice.date,
          created: invoice.created,
        })));
        
        // Filtrar resultados por fecha si se especificaron fechas
        if (startDateObj || endDateObj) {
          debugLog('Aplicando filtro de fechas en el servidor (página única)', { startDate, endDate });
          
          const originalCount = responseData.results.length;
          
          const filteredResults = responseData.results.filter((invoice: any) => {
            const invoiceDate = new Date(invoice.date);
            
            // Verificar si la fecha de la factura está dentro del rango especificado
            const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
            const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
            
            return afterStartDate && beforeEndDate;
          });
          
          debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${originalCount}`);
          
          // Actualizar los resultados y la paginación
          responseData.results = filteredResults;
          if (responseData.pagination) {
            responseData.pagination.total_items = filteredResults.length;
            responseData.pagination.original_total_items = originalCount;
            responseData.pagination.filtered_by_server = true;
          }
        }
      }

      debugLog('Datos recibidos de Siigo API (página única)', { 
        count: responseData.results?.length || 0,
        filtered: startDateObj || endDateObj ? true : false
      });

      return NextResponse.json(responseData);
    }
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
