import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Obteniendo token de Siigo...');
    
    // Obtener credenciales desde variables de entorno del servidor
    const username = process.env.SIIGO_USERNAME;
    const accessKey = process.env.SIIGO_ACCESS_KEY;
    
    if (!username || !accessKey) {
      console.error('❌ Credenciales de Siigo no configuradas');
      return NextResponse.json(
        { error: 'Credenciales de Siigo no configuradas' },
        { status: 500 }
      );
    }
    
    // Crear las credenciales en base64
    const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');
    
    console.log('📡 Realizando petición a Siigo API...');
    
    // Hacer petición a Siigo para obtener el token
    const response = await fetch('https://api.siigo.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'Partner-Id': 'tu-partner-id' // Reemplaza con tu Partner ID real
      },
      body: JSON.stringify({
        username: username,
        access_key: accessKey
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Error en respuesta de Siigo:', response.status, errorData);
      return NextResponse.json(
        { error: `Error de autenticación: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      console.error('❌ No se recibió access_token en la respuesta');
      return NextResponse.json(
        { error: 'No se pudo obtener el token de acceso' },
        { status: 500 }
      );
    }
    
    console.log('✅ Token obtenido exitosamente');
    
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in || 86400 // 24 horas por defecto
    });
    
  } catch (error) {
    console.error('💥 Error al obtener token:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
