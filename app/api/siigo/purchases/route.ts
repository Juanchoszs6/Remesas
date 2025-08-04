import { NextRequest, NextResponse } from "next/server";
import { obtenerTokenSiigo } from "../auth/route";

// Tipos para la API de Siigo
interface SiigoDocument {
  id: number;
}

interface SiigoSupplier {
  identification: string;
  branch_office?: number;
}

interface SiigoProviderInvoice {
  prefix: string;
  number: string;
}

interface SiigoCurrency {
  code: string;
  exchange_rate: number;
}

// Definición de tipos para los ítems de Siigo
type SiigoItemType = 'Product' | 'Service' | 'Activo' | 'Contable';

interface SiigoItemBase {
  code: string;
  description: string;
  quantity: number;
  price: number;
  total?: number;
  hasIVA?: boolean;
  type?: SiigoItemType;
}

interface SiigoItemWithDiscount extends SiigoItemBase {
  discount?: {
    value?: number;
    percentage?: number;
  };
  taxes?: Array<{
    id: number;
    name?: string;
    type?: string;
    percentage?: number;
    value?: number;
  }>;
}

// Tipo final para los ítems de Siigo
type SiigoItem = SiigoItemWithDiscount;

interface SiigoPayment {
  id: number;
  value: number;
  due_date: string;
}

// Interfaces para los items de la factura
interface RequestItemTax {
  id: number;
  name: string;
  type: string;
  percentage: number;
  value: number;
}

interface RequestItemDiscount {
  value?: number;
  percentage?: number;
}

interface RequestItem {
  id: string;
  type: 'product' | 'activo' | 'contable';
  code: string;
  description: string;
  quantity: number;
  price: number;
  hasIVA?: boolean;
  discount?: RequestItemDiscount;
  taxes?: RequestItemTax[];
  total?: number;
}

interface Provider {
  identificacion: string;
  nombre: string;
  tipo_documento: string;
  nombre_comercial: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  correo_electronico: string;
}

interface RequestBody {
  provider: Provider;
  items: RequestItem[];
  documentId: string; // CUFE
  providerInvoiceNumber: string;
  providerInvoicePrefix?: string; // Added missing prefix
  invoiceDate: string;
  ivaPercentage?: number;
  observations?: string;
}

// Utilidad para formatear fechas
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Función para extraer prefijo y número de factura
function extractInvoiceNumber(invoiceNumber: string): { prefix: string, number: string } {
  // Si el número ya tiene un guión, separar por guión
  if (invoiceNumber.includes('-')) {
    const [prefix, ...numberParts] = invoiceNumber.split('-');
    return {
      prefix: prefix.trim() || 'FACT',
      number: numberParts.join('').trim()
    };
  }
  
  // Si no tiene guión pero tiene letras seguidas de números
  const match = invoiceNumber.match(/^([A-Za-z]+)(\d+)$/i);
  if (match) {
    return {
      prefix: match[1] || 'FACT',
      number: match[2] || invoiceNumber
    };
  }
  
  // Si no se puede extraer prefijo, usar valor por defecto
  return {
    prefix: 'FACT',
    number: invoiceNumber
  };
}

function calculateItemTotal(item: RequestItem, ivaPercentage: number = 19): number {
  const subtotal = item.quantity * item.price;
  const ivaAmount = item.hasIVA ? (subtotal * ivaPercentage / 100) : 0;
  return subtotal + ivaAmount;
}

function calculateGrandTotal(items: RequestItem[], ivaPercentage: number = 19): number {
  return items.reduce((total, item) => total + calculateItemTotal(item, ivaPercentage), 0);
}

export async function POST(request: NextRequest) {
  try {
    console.log("[PURCHASES] Iniciando proceso de creación de compra");
    
    const body: RequestBody = await request.json();
    console.log("[PURCHASES] Datos recibidos:", {
      proveedor: body.provider?.identificacion,
      itemsCount: body.items?.length,
      factura: body.providerInvoicePrefix ? 
        `${body.providerInvoicePrefix}-${body.providerInvoiceNumber}` : 
        body.providerInvoiceNumber
    });

    // Validaciones básicas mejoradas
    if (!body.provider?.identificacion) {
      console.error('[PURCHASES] Error: Proveedor no proporcionado');
      return NextResponse.json({ 
        error: "Datos de proveedor incompletos",
        details: {
          message: "El proveedor es requerido",
          fields: ["provider.identificacion"],
          received: {
            provider: body.provider,
            hasIdentification: !!body.provider?.identificacion
          }
        }
      }, { status: 400 });
    }

    if (!body.items?.length) {
      console.error('[PURCHASES] Error: No se enviaron items');
      return NextResponse.json({ 
        error: "Datos de ítems incompletos",
        details: {
          message: "Debe incluir al menos un ítem en la compra",
          itemsCount: 0
        }
      }, { status: 400 });
    }

    // Validar que los ítems tengan la estructura correcta
    const invalidItems = body.items.filter(item => 
      !item.code || 
      !item.description || 
      !item.quantity || 
      item.price === undefined ||
      item.price === null
    );

    if (invalidItems.length > 0) {
      console.error('[PURCHASES] Error: Ítems inválidos', invalidItems);
      return NextResponse.json({
        error: "Datos de ítems inválidos",
        details: {
          message: `Hay ${invalidItems.length} ítems con datos incompletos`,
          invalidItems: invalidItems.map((item, index) => ({
            index,
            missingFields: [
              !item.code && 'código',
              !item.description && 'descripción',
              !item.quantity && 'cantidad',
              (item.price === undefined || item.price === null) && 'precio'
            ].filter(Boolean)
          }))
        }
      }, { status: 400 });
    }

    // Validar que el número de factura esté presente
    if (!body.providerInvoiceNumber) {
      console.error('[PURCHASES] Error: Número de factura no proporcionado');
      return NextResponse.json({
        error: "Datos de factura incompletos",
        details: {
          message: "El número de factura es requerido",
          received: {
            providerInvoiceNumber: body.providerInvoiceNumber,
            providerInvoicePrefix: body.providerInvoicePrefix
          }
        }
      });
    }

    if (!body.provider || !body.provider.identificacion || !body.provider.nombre) {
      return NextResponse.json(
        { error: "Los datos del proveedor son requeridos" },
        { status: 400 }
      );
    }

    console.log("[PURCHASES] Validaciones completadas exitosamente");

    // Verificar que todos los ítems tengan un tipo válido
    const validTypes = ['product', 'activo', 'contable'];
    const invalidTypeItems = body.items.filter(item => !validTypes.includes(item.type));
    
    if (invalidTypeItems.length > 0) {
      console.error('Tipos de ítems no válidos:', invalidTypeItems);
      return NextResponse.json(
        { error: `Los siguientes ítems tienen tipos no válidos: ${invalidTypeItems.map(i => i.type).join(', ')}. Los tipos válidos son: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    try {
      // Obtener el token de autenticación de Siigo
      const siigoToken = await obtenerTokenSiigo();
      const partnerId = process.env.SIIGO_PARTNER_ID;

      // Validar que tengamos el token y el partner ID
      if (!siigoToken || !partnerId) {
        console.error('[PURCHASES] Error: Faltan credenciales de Siigo', {
          hasToken: !!siigoToken,
          hasPartnerId: !!partnerId
        });
        return NextResponse.json({
          error: 'Error de autenticación',
          message: 'No se pudieron obtener las credenciales necesarias de Siigo',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }

      // Construir el cuerpo de la petición a la API de Siigo
      const siigoRequestBody = {
        document: { 
          id: 1 // ID del tipo de documento (debe obtenerse de la API de Siigo)
        },
        date: formatDate(new Date()),
        supplier: { 
          identification: body.provider.identificacion,
          branch_office: 0
        },
        cost_center: 1, // ID del centro de costos
        provider_invoice: {
          prefix: 'FC',
          number: body.providerInvoiceNumber
        },
        currency: {
          code: 'COP',
          exchange_rate: 1
        },
        observations: body.observations || 'Factura de compra generada desde el sistema',
        discount_type: 'Value',
        supplier_by_item: false,
        tax_included: false,
        items: body.items.map(item => ({
          code: item.code,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount?.value || 0,
          taxes: item.hasIVA ? [{
            id: 1, // ID del impuesto (debe obtenerse de la API de Siigo)
            name: 'IVA',
            type: 'Percentage',
            percentage: 19, // Este valor debería venir de la configuración
            value: item.quantity * item.price * 0.19 // Calcular el valor del IVA
          }] : [],
          type: (() => {
            // Map the request item type to SiigoItemType
            switch (item.type) {
              case 'product': return 'Product' as const;
              case 'activo': return 'Activo' as const;
              case 'contable': return 'Contable' as const;
              default: return 'Product' as const;
            }
          })()
        })),
        payments: [{
          id: 1, // ID del método de pago (debe obtenerse de la API de Siigo)
          value: body.items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
          due_date: formatDate(new Date())
        }]
      };

      // Log de la petición (sin información sensible)
      console.log('Enviando petición a Siigo API:', {
        url: 'https://api.siigo.com/v1/purchases',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${siigoToken.substring(0, 10)}...`,
          'Partner-Id': '***'
        },
        body: {
          ...siigoRequestBody,
          items: siigoRequestBody.items.map(item => ({
            ...item,
            code: item.code,
            description: item.description.substring(0, 50) + (item.description.length > 50 ? '...' : '')
          }))
        }
      });

      // Realizar la petición a la API de Siigo
      const siigoResponse = await fetch('https://api.siigo.com/v1/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${siigoToken}`,
          'Partner-Id': partnerId
        },
        body: JSON.stringify(siigoRequestBody)
      });

      // Procesar la respuesta
      const responseText = await siigoResponse.text();
      let responseData;
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('[PURCHASES] Error al parsear la respuesta JSON:', e);
        responseData = { 
          error: 'No se pudo parsear la respuesta',
          raw: responseText.substring(0, 500)
        };
      }

      // Log de la respuesta
      console.log("\n[PURCHASES] ===== RESPUESTA DE SIGO API =====");
      console.log(`[PURCHASES] Estado: ${siigoResponse.status} ${siigoResponse.statusText}`);
      
      // Mostrar solo los headers relevantes
      const headers = Object.fromEntries(siigoResponse.headers.entries());
      console.log("[PURCHASES] Headers:", {
        'content-type': headers['content-type'],
        'content-length': headers['content-length'],
        'date': headers['date']
      });

      // Manejar la respuesta
      if (!siigoResponse.ok) {
        console.error('[PURCHASES] Error en la respuesta:', {
          status: siigoResponse.status,
          error: responseData.error || 'Error desconocido',
          message: responseData.message,
          details: responseData.details || responseData
        });

        return NextResponse.json({
          error: 'Error al procesar la factura en Siigo',
          message: responseData.message || 'Error desconocido',
          details: responseData.details || responseData,
          status: siigoResponse.status
        }, { 
          status: siigoResponse.status,
          statusText: siigoResponse.statusText
        });
      }

      // Si llegamos aquí, la petición fue exitosa
      console.log('[PURCHASES] Factura creada exitosamente:', {
        id: responseData.id,
        number: responseData.number,
        status: responseData.status,
        total: responseData.total
      });

      return NextResponse.json({
        success: true,
        message: `Factura creada exitosamente. Número: ${responseData.number || 'N/A'}`,
        data: {
          id: responseData.id,
          number: responseData.number,
          total: responseData.total,
          date: responseData.date,
          status: responseData.status
        }
      });
    } catch (error) {
      console.error("[PURCHASES] Error en la petición a Siigo:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error("[PURCHASES] Stack trace:", errorStack);

      return NextResponse.json({
        error: "Error al procesar la solicitud",
        message: errorMessage,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[PURCHASES] Error en el proceso general:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    
    return NextResponse.json({
      error: "Error interno del servidor",
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
