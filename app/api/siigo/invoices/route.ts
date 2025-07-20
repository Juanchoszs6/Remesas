import { NextRequest, NextResponse } from 'next/server';
import type { 
  FormData, 
  SiigoInvoiceRequest, 
  SiigoInvoiceItemRequest, 
  SiigoAuthResponse,
  InvoiceItem
} from '../../../../types/siigo';

// Función para obtener token desde nuestra API
async function obtenerToken(): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/siigo/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('💥 Error en obtenerToken:', error);
    return null;
  }
}

// Función para mapear los datos del formulario a la estructura de Siigo
function mapearDatosFormularioASiigo(datosFormulario: FormData): SiigoInvoiceRequest {
  const fechaActual = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Mapear items del formulario
  const items: SiigoInvoiceItemRequest[] = datosFormulario.items.map((item: InvoiceItem) => ({
    code: item.code || 'PROD001', // Código por defecto si no existe
    description: item.description || 'Producto/Servicio',
    quantity: item.quantity || 1,
    price: item.price || 0,
    warehouse: item.warehouse ? parseInt(item.warehouse) : undefined,
    taxes: item.hasIVA ? [{ id: 13156 }] : [] // ID de IVA 19% (ejemplo)
  }));

  // Calcular total de pagos
  const totalFactura = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.price;
    const ivaTotal = item.taxes && item.taxes.length > 0 ? itemTotal * 0.19 : 0;
    return sum + itemTotal + ivaTotal;
  }, 0);

  return {
    document: {
      id: 138531 // ID del tipo de documento de factura electrónica (ejemplo)
    },
    date: fechaActual,
    customer: {
      identification: datosFormulario.selectedProvider?.identification || '12345678',
      branch_office: 0
    },
    seller: 35260, // ID del vendedor (ejemplo)
    stamp: {
      send: true // Enviar a la DIAN
    },
    mail: {
      send: false // No enviar por correo por defecto
    },
    observations: datosFormulario.observations || 'Factura generada desde formulario web',
    items: items,
    payments: [
      {
        id: 8468, // ID del método de pago que tienes en el formulario
        value: Math.round(totalFactura * 100) / 100 // Redondear a 2 decimales
      }
    ]
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando envío de factura a Siigo...');
    
    // Obtener datos del formulario desde el body de la petición
    const datosFormulario: FormData = await request.json();
    
    // 1. Obtener token de autenticación
    const token = await obtenerToken();
    if (!token) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de autenticación' },
        { status: 500 }
      );
    }
    
    // 2. Mapear datos del formulario a estructura de Siigo
    const facturaData = mapearDatosFormularioASiigo(datosFormulario);
    
    console.log('📋 Datos de factura mapeados:', JSON.stringify(facturaData, null, 2));
    
    // 3. Enviar factura a Siigo API
    const response = await fetch('https://api.siigo.com/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(facturaData)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error en la respuesta de Siigo:', responseData);
      return NextResponse.json(
        { 
          error: `Error ${response.status}: ${JSON.stringify(responseData)}`,
          details: responseData 
        },
        { status: response.status }
      );
    }
    
    console.log('✅ Factura enviada exitosamente:', responseData);
    
    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Factura enviada exitosamente a Siigo'
    });
    
  } catch (error) {
    console.error('💥 Error al enviar factura:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        message: 'Error al enviar la factura a Siigo'
      },
      { status: 500 }
    );
  }
}
