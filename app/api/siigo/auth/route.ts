import { NextRequest, NextResponse } from 'next/server';

// Enable debug logging in development
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[SIIGO-AUTH] ${new Date().toISOString()}: ${message}`, data || '');
  }
}

export async function POST(request: NextRequest) {
  try {
    debugLog('🔐 Iniciando proceso de autenticación con Siigo');
    
    // Obtener credenciales desde variables de entorno del servidor
    const username = process.env.SIIGO_USERNAME;
    const accessKey = process.env.SIIGO_ACCESS_KEY;
    const partnerId = process.env.SIIGO_PARTNER_ID || '';
    
    // Validar que todas las variables de entorno estén configuradas
    const missingVars = [];
    if (!username) missingVars.push('SIIGO_USERNAME');
    if (!accessKey) missingVars.push('SIIGO_ACCESS_KEY');
    if (!partnerId) missingVars.push('SIIGO_PARTNER_ID');
    
    if (missingVars.length > 0) {
      const errorMsg = `Credenciales de Siigo no configuradas: ${missingVars.join(', ')}`;
      console.error(`❌ ${errorMsg}`);
      return NextResponse.json(
        { 
          success: false,
          error: errorMsg,
          message: 'Configuración incompleta del servidor. Contacte al administrador.'
        },
        { status: 500 }
      );
    }
    
    // Crear las credenciales en base64
    const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');
    const authUrl = 'https://api.siigo.com/auth';
    
    debugLog('📡 Configurando petición a Siigo API', {
      url: authUrl,
      username: username ? '***' : 'undefined',
      accessKey: accessKey ? '***' : 'undefined',
      partnerId: partnerId ? '***' : 'undefined'
    });
    
    // Hacer petición a Siigo para obtener el token
    const startTime = Date.now();
    let response;
    
    try {
      response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`,
          'Partner-Id': partnerId
        },
        body: JSON.stringify({
          username: username,
          access_key: accessKey
        })
      });
      
      debugLog(`🔄 Respuesta recibida en ${Date.now() - startTime}ms`, {
        status: response.status,
        statusText: response.statusText
      });
      
    } catch (fetchError) {
      console.error('❌ Error de red al conectar con Siigo:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Error de conexión con Siigo',
          message: 'No se pudo establecer conexión con el servicio de autenticación de Siigo.'
        },
        { status: 503 }
      );
    }
    
    let responseData;
    try {
      responseData = await response.json();
      debugLog('📥 Datos de respuesta de Siigo:', responseData);
    } catch (jsonError) {
      const textResponse = await response.text();
      console.error('❌ Error al procesar la respuesta de Siigo:', {
        status: response.status,
        statusText: response.statusText,
        responseText: textResponse,
        error: jsonError
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Respuesta inválida del servidor de autenticación',
          message: 'El servicio de autenticación de Siigo devolvió una respuesta inesperada.'
        },
        { status: 502 }
      );
    }
    
    if (!response.ok) {
      console.error('❌ Error en la autenticación con Siigo:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: `Error de autenticación (${response.status})`,
          message: responseData?.error || 'No se pudo autenticar con las credenciales proporcionadas.',
          details: responseData
        },
        { status: response.status }
      );
    }
    
    if (!responseData.access_token) {
      console.error('❌ No se recibió access_token en la respuesta:', responseData);
      return NextResponse.json(
        { 
          success: false,
          error: 'Respuesta de autenticación incompleta',
          message: 'El servicio de autenticación no devolvió un token de acceso válido.'
        },
        { status: 500 }
      );
    }
    
    const expiresIn = responseData.expires_in || 86400; // 24 horas por defecto
    debugLog('✅ Autenticación exitosa', {
      token: `${responseData.access_token.substring(0, 10)}...`,
      expiresIn: `${expiresIn} segundos`
    });
    
    return NextResponse.json({
      success: true,
      access_token: responseData.access_token,
      expires_in: expiresIn,
      token_type: responseData.token_type || 'Bearer'
    });
    
  } catch (error) {
    console.error('💥 Error inesperado en el proceso de autenticación:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error interno del servidor',
        message: 'Ocurrió un error inesperado al intentar autenticarse con Siigo.'
      },
      { status: 500 }
    );
  }
}
