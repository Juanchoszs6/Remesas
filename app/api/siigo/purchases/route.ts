import { NextRequest, NextResponse } from 'next/server';
import type { 
  FormData, 
  SiigoPurchaseInvoiceRequest, 
  SiigoPurchaseItemRequest, 
  SiigoAuthResponse,
  InvoiceItem,
  SiigoPurchaseInvoiceResponse
} from '../../../../types/siigo';

// Configuración de debugging
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[SIIGO-PURCHASES] ${new Date().toISOString()}: ${message}`);
    if (data) {
      console.log('[SIIGO-PURCHASES] Data:', JSON.stringify(data, null, 2));
    }
  }
}

function debugError(message: string, error: unknown): void {
  console.error(`[SIIGO-PURCHASES] ERROR ${new Date().toISOString()}: ${message}`);
  console.error('[SIIGO-PURCHASES] Error details:', error);
}

// Función para obtener token desde nuestra API
async function obtenerToken(): Promise<string | null> {
  try {
    debugLog('Iniciando obtención de token de autenticación');
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/siigo/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      debugError(`Error en respuesta de autenticación: ${response.status}`, await response.text());
      return null;
    }

    const authData: SiigoAuthResponse = await response.json();
    debugLog('Token obtenido exitosamente', { expires_in: authData.expires_in });
    
    return authData.access_token;
  } catch (error) {
    debugError('Error obteniendo token de autenticación', error);
    return null;
  }
}

// Función para mapear tipos de items del formulario a tipos de Siigo
function mapItemTypeToSiigo(type: string): "Product" | "FixedAsset" | "Account" {
  debugLog(`Mapeando tipo de item: ${type}`);
  
  switch (type) {
    case 'product':
    case 'service':
      return 'Product';
    case 'charge':
      return 'Account';
    case 'discount':
      return 'Account';
    default:
      debugLog(`Tipo de item no reconocido: ${type}, usando Product por defecto`);
      return 'Product';
  }
}

// Función para transformar datos del formulario a formato Siigo
function transformarDatosParaSiigo(datosFormulario: FormData): SiigoPurchaseInvoiceRequest {
  debugLog('Iniciando transformación de datos del formulario');
  debugLog('Datos del formulario recibidos', datosFormulario);

  if (!datosFormulario.selectedProvider) {
    throw new Error('Proveedor es requerido para crear la factura de compra');
  }

  // Mapear items del formulario a formato Siigo
  const items: SiigoPurchaseItemRequest[] = datosFormulario.items.map((item: InvoiceItem) => {
    debugLog(`Procesando item: ${item.code}`, item);
    
    const siigoItem: SiigoPurchaseItemRequest = {
      type: mapItemTypeToSiigo(item.type),
      code: item.code,
      description: item.description,
      quantity: Number(item.quantity),
      price: Number(item.price),
      warehouse: item.warehouse ? Number(item.warehouse) : undefined,
    };

    // Agregar impuestos si el item tiene IVA
    if (item.hasIVA && datosFormulario.hasIVA) {
      siigoItem.taxes = [{
        id: 13156 // ID del IVA 19% en Siigo
      }];
      debugLog(`Agregando IVA al item ${item.code}`);
    }

    debugLog(`Item transformado:`, siigoItem);
    return siigoItem;
  });

  // Calcular total de la factura
  const subtotal = datosFormulario.items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.price;
    return item.type === "discount" ? sum - itemTotal : sum + itemTotal;
  }, 0);

  const ivaTotal = datosFormulario.hasIVA ? datosFormulario.items.reduce((sum, item) => {
    if (item.hasIVA && item.type !== "discount") {
      const itemTotal = item.quantity * item.price;
      return sum + (itemTotal * datosFormulario.ivaPercentage) / 100;
    }
    return sum;
  }, 0) : 0;

  const total = subtotal + ivaTotal;

  debugLog('Cálculos de totales', { subtotal, ivaTotal, total });

  // Crear objeto de petición para Siigo
  const siigoRequest: SiigoPurchaseInvoiceRequest = {
    document: {
      id: 24446 // ID del tipo de documento para factura de compra en Siigo
    },
    date: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
    supplier: {
      identification: datosFormulario.selectedProvider.identification,
      branch_office: datosFormulario.selectedProvider.branch_office || 0
    },
    observations: datosFormulario.observations || 'Factura de compra generada desde formulario web',
    discount_type: "Value", // Tipo de descuento por valor
    supplier_by_item: false,
    tax_included: false, // Los precios no incluyen impuestos
    items: items,
    payments: [{
      id: 8468, // ID del método de pago configurado en Siigo
      value: Number(total.toFixed(2)),
      due_date: new Date().toISOString().split('T')[0] // Fecha de vencimiento (hoy)
    }]
  };

  debugLog('Datos transformados para Siigo', siigoRequest);
  return siigoRequest;
}

// Función principal para enviar factura a Siigo
async function enviarFacturaCompraASiigo(datosFormulario: FormData): Promise<SiigoPurchaseInvoiceResponse> {
  debugLog('=== INICIANDO PROCESO DE ENVÍO DE FACTURA DE COMPRA A SIIGO ===');
  
  try {
    // Paso 1: Obtener token de autenticación
    debugLog('Paso 1: Obteniendo token de autenticación');
    const token = await obtenerToken();
    
    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de Siigo');
    }

    // Paso 2: Transformar datos del formulario
    debugLog('Paso 2: Transformando datos del formulario');
    const datosParaSiigo = transformarDatosParaSiigo(datosFormulario);

    // Paso 3: Enviar factura a Siigo
    debugLog('Paso 3: Enviando factura a Siigo API');
    debugLog('URL de la API:', 'https://api.siigo.com/v1/purchases');
    debugLog('Headers que se enviarán:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.substring(0, 20)}...`,
      'Partner-Id': process.env.SIIGO_PARTNER_ID || 'InvoiceFormApp'
    });

    const response = await fetch('https://api.siigo.com/v1/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'InvoiceFormApp'
      },
      body: JSON.stringify(datosParaSiigo)
    });

    debugLog(`Respuesta de Siigo API: Status ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      debugError(`Error en la respuesta de Siigo API (${response.status})`, errorText);
      
      let errorMessage = `Error ${response.status} de Siigo API`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
        debugLog('Error parseado de Siigo:', errorData);
      } catch {
        debugLog('Error no pudo ser parseado como JSON:', errorText);
      }
      
      throw new Error(errorMessage);
    }

    // Paso 4: Procesar respuesta exitosa
    const facturaCreada: SiigoPurchaseInvoiceResponse = await response.json();
    debugLog('=== FACTURA CREADA EXITOSAMENTE ===');
    debugLog('Respuesta completa de Siigo:', facturaCreada);
    debugLog(`Factura ID: ${facturaCreada.id}`);
    debugLog(`Número de factura: ${facturaCreada.number}`);
    debugLog(`Total: ${facturaCreada.total}`);

    return facturaCreada;

  } catch (error) {
    debugError('=== ERROR EN EL PROCESO DE ENVÍO ===', error);
    throw error;
  }
}

// Handler principal del endpoint
export async function POST(request: NextRequest): Promise<NextResponse> {
  debugLog('=== NUEVA PETICIÓN RECIBIDA EN /api/siigo/purchases ===');
  
  try {
    // Validar Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      debugError('Content-Type inválido', contentType);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Content-Type debe ser application/json',
          message: 'Formato de petición inválido'
        },
        { status: 400 }
      );
    }

    // Parsear datos del cuerpo de la petición
    let datosFormulario: FormData;
    try {
      datosFormulario = await request.json();
      debugLog('Datos recibidos del formulario:', datosFormulario);
    } catch (error) {
      debugError('Error parseando JSON del cuerpo de la petición', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'JSON inválido en el cuerpo de la petición',
          message: 'Los datos enviados no son válidos'
        },
        { status: 400 }
      );
    }

    // Validaciones básicas
    if (!datosFormulario.selectedProvider) {
      debugError('Validación fallida: Proveedor no seleccionado', datosFormulario);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Proveedor es requerido',
          message: 'Debe seleccionar un proveedor para crear la factura'
        },
        { status: 400 }
      );
    }

    if (!datosFormulario.items || datosFormulario.items.length === 0) {
      debugError('Validación fallida: No hay items en la factura', datosFormulario);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Items son requeridos',
          message: 'Debe agregar al menos un item a la factura'
        },
        { status: 400 }
      );
    }

    // Validar que todos los items tengan código y cantidad
    for (const item of datosFormulario.items) {
      if (!item.code || !item.quantity || item.quantity <= 0) {
        debugError('Validación fallida: Item inválido', item);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Item inválido',
            message: 'Todos los items deben tener código y cantidad válida'
          },
          { status: 400 }
        );
      }
    }

    debugLog('Validaciones básicas completadas exitosamente');

    // Enviar factura a Siigo
    const facturaCreada = await enviarFacturaCompraASiigo(datosFormulario);

    // Respuesta exitosa
    debugLog('=== PROCESO COMPLETADO EXITOSAMENTE ===');
    return NextResponse.json(
      {
        success: true,
        data: facturaCreada,
        message: `Factura de compra creada exitosamente. ID: ${facturaCreada.id}, Número: ${facturaCreada.number}`
      },
      { status: 201 }
    );

  } catch (error) {
    debugError('=== ERROR GENERAL EN EL ENDPOINT ===', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Error al crear la factura de compra en Siigo'
      },
      { status: 500 }
    );
  }
}
