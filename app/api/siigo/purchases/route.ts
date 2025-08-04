import { NextRequest, NextResponse } from "next/server";
import { obtenerTokenSiigo } from "../auth/route";

// Interfaces para los items de la factura
interface RequestItem {
  id: string;
  type: 'product' | 'activo' | 'contable' | 'service'; // Added 'service' type
  code: string;
  description: string;
  quantity: number;
  price: number;
  hasIVA?: boolean;
  discount?: {
    value?: number;
    percentage?: number;
  };
  taxes?: Array<{
    id: number;
    name: string;
    type: string;
    percentage: number;
    value: number;
  }>;
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

interface SiigoItem {
  id?: string;
  type: "Product" | "Activo" | "Contable";
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: {
    value?: number;
    percentage?: number;
  };
  taxes?: Array<{
    id: number;
    name: string;
    type: string;
    percentage: number;
    value: number;
  }>;
  total: number;
  hasIVA?: boolean; // Mantenido por compatibilidad, pero debería manejarse con taxes
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

    // Validaciones básicas
    if (!body.provider?.identificacion) {
      return NextResponse.json({ 
        error: "Proveedor requerido",
        details: "Debe seleccionar un proveedor válido"
      }, { status: 400 });
    }

    if (!body.items?.length) {
      return NextResponse.json({ 
        error: "Items requeridos",
        details: "Debe enviar al menos un item en la compra"
      }, { status: 400 });
    }

    // Validar que el CUFE (documentId) y el número de factura estén presentes
    if (!body.documentId) {
      return NextResponse.json(
        { message: "El CUFE es requerido" },
        { status: 400 }
      );
    }

    if (!body.providerInvoiceNumber) {
      return NextResponse.json(
        { message: "El número de factura es requerido" },
        { status: 400 }
      );
    }

    // Validar datos del proveedor
    if (!body.provider || !body.provider.identificacion || !body.provider.nombre) {
      return NextResponse.json(
        { message: "Los datos del proveedor son requeridos" },
        { status: 400 }
      );
    }

    // Validar items
    for (const item of body.items) {
      if (!item.code?.trim()) {
        return NextResponse.json({ 
          error: "Código de item requerido",
          details: `El item "${item.description || 'sin descripción'}" debe tener un código`
        }, { status: 400 });
      }

      if (!item.description?.trim()) {
        return NextResponse.json({ 
          error: "Descripción de item requerida",
          details: `El item con código "${item.code}" debe tener una descripción`
        }, { status: 400 });
      }

      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return NextResponse.json({ 
          error: "Cantidad inválida",
          details: `El item "${item.code}" debe tener una cantidad mayor a 0`
        }, { status: 400 });
      }

      if (typeof item.price !== 'number' || item.price < 0) {
        return NextResponse.json({ 
          error: "Precio inválido",
          details: `El item "${item.code}" debe tener un precio válido (mayor o igual a 0)`
        }, { status: 400 });
      }
    }

    console.log("[PURCHASES] Validaciones completadas exitosamente");

    // ✅ Token y Configuración
    const siigoToken = await obtenerTokenSiigo();
    const partnerId = process.env.SIIGO_PARTNER_ID;
    
    if (!siigoToken || !partnerId) {
      console.error("[PURCHASES] Token o Partner ID inválidos");
      return NextResponse.json({ 
        error: "Autenticación fallida con Siigo",
        details: "No se pudo obtener token de autenticación"
      }, { status: 500 });
    }

    console.log("[PURCHASES] Validaciones completadas exitosamente");

    // 📅 Fechas
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30); // Vencimiento a 30 días

    // 🎯 IDs y configuraciones
    const id = body.documentId; // CUFE como ID único de la factura
    const numeroFactura = body.providerInvoiceNumber;
    const COST_CENTER_ID = 235; // ID del centro de costos
    const PAYMENT_METHOD_ID = 5636; // ID del método de pago
    const IVA_TAX_ID = 13156; // ID del impuesto IVA 19%
    const ivaPercentage = body.ivaPercentage || 19;

    // Obtener el tipo de documento de la API de Siigo
    const documentTypesResponse = await fetch('https://api.siigo.com/v1/document-types', {
      headers: {
        'Authorization': `Bearer ${siigoToken}`,
        'Partner-Id': partnerId
      }
    });

    if (!documentTypesResponse.ok) {
      console.error('Error al obtener los tipos de documento:', await documentTypesResponse.text());
      return NextResponse.json({
        error: 'No se pudieron obtener los tipos de documento de Siigo',
        details: 'Error al consultar la API de tipos de documento'
      }, { status: 500 });
    }

    const documentTypes = await documentTypesResponse.json();
    console.log('Tipos de documento disponibles:', documentTypes);

    // Buscar el ID del tipo de documento de factura de compra
    const purchaseInvoiceType = documentTypes.find((type: any) => 
      type.name?.toLowerCase().includes('factura de compra') || 
      type.name?.toLowerCase().includes('factura de proveedor')
    );

    if (!purchaseInvoiceType) {
      console.error('No se encontró el tipo de documento para factura de compra');
      return NextResponse.json({
        error: 'Configuración de Siigo incompleta',
        details: 'No se encontró el tipo de documento para factura de compra en Siigo'
      }, { status: 500 });
    }

    console.log('Tipo de documento seleccionado:', purchaseInvoiceType);

    // Preparar items para Siigo
    const siigoItems: SiigoItem[] = body.items.map((item) => {
      const subtotal = item.quantity * item.price;
      const ivaValue = item.hasIVA ? (subtotal * ivaPercentage) / 100 : 0;
      const total = subtotal + ivaValue;
      
      const siigoItem: SiigoItem = {
        type: item.type === 'service' || item.type === 'product' ? 'Product' : item.type === 'activo' ? 'Activo' : 'Contable',
        code: item.code.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        price: item.price,
        total: Number(total.toFixed(2))
      };

      // Agregar impuestos si el item tiene IVA
      if (item.hasIVA) {
        const ivaPercentage = body.ivaPercentage || 19; // Usar 19% como valor por defecto si no está definido
        siigoItem.taxes = [
          {
            id: IVA_TAX_ID,
            name: `IVA ${ivaPercentage}%`,
            type: "IVA",
            percentage: ivaPercentage,
            value: Number(ivaValue.toFixed(2))
          }
        ];
      }
      
      // Agregar descuento si existe
      if (item.discount?.value) {
        siigoItem.discount = {
          value: item.discount.value,
          percentage: (item.discount.value / subtotal) * 100
        };
      }

      return siigoItem;
    });

    // Calcular total general
    const grandTotal = calculateGrandTotal(body.items, body.ivaPercentage);
    
    // Calcular subtotal (suma de precios * cantidades)
    const subtotal = body.items.reduce((sum, item) => {
      return sum + (item.quantity * item.price);
    }, 0);
    
    // Calcular total de impuestos
    const totalTaxes = body.items.reduce((sum, item) => {
      if (item.hasIVA) {
        const itemSubtotal = item.quantity * item.price;
        return sum + (itemSubtotal * (body.ivaPercentage || 19) / 100);
      }
      return sum;
    }, 0);
    
    // Calcular total de descuentos
    const totalDiscounts = body.items.reduce((sum, item) => {
      if (item.discount?.value) {
        return sum + item.discount.value;
      }
      return sum;
    }, 0);

    // Preparar pagos
    const payments = [
      {
        id: PAYMENT_METHOD_ID,
        name: "Crédito",
        value: Number(grandTotal.toFixed(2)),
        due_date: formatDate(dueDate)
      }
    ];
    
    console.log('[PURCHASES] Resumen de totales:', {
      subtotal: Number(subtotal.toFixed(2)),
      total_impuestos: Number(totalTaxes.toFixed(2)),
      total_descuentos: Number(totalDiscounts.toFixed(2)),
      total_factura: Number(grandTotal.toFixed(2))
    });

    // Extraer prefijo y número de factura
    const { prefix, number: invoiceNumber } = extractInvoiceNumber(numeroFactura);
    
    // Generar un número de factura secuencial si es necesario
    const invoiceNumberValue = parseInt(invoiceNumber) || Date.now() % 1000000;

    // Construir el cuerpo de la petición a la API de Siigo
    const siigoRequestBody = {
      document: { 
        id: 24446 // ID fijo para factura de compra según el ejemplo
      },
      number: invoiceNumberValue,
      name: `"${prefix || 'FV'}"`, // Formato requerido por Siigo
      date: formatDate(today),
      supplier: { 
        identification: body.provider.identificacion.trim(),
        branch_office: 0
      },
      cost_center: COST_CENTER_ID,
      provider_invoice: {
        prefix: prefix || 'FV1',
        number: invoiceNumber
      },
      discount_type: "Value", // o "Percentage" según corresponda
      currency: {
        code: 'USD', // O la moneda correspondiente
        exchange_rate: 1
      },
      items: siigoItems,
      payments: payments,
      observations: body.observations || "",
      total: Number(calculateGrandTotal(body.items, ivaPercentage).toFixed(2))
    };

    console.log("[PURCHASES] Preparando petición a Siigo API:", {
      endpoint: "https://api.siigo.com/v1/purchases",
      documentId: numeroFactura,
      supplierId: body.provider.identificacion,
      itemsCount: siigoItems.length,
      total: grandTotal
    });

    // 🔍 Log completo del payload para debugging
    console.log("[PURCHASES] Payload completo a enviar a Siigo:", JSON.stringify(siigoRequestBody, null, 2));

    // 🚀 Envío a Siigo API
    console.log("[PURCHASES] Enviando solicitud a Siigo API:", JSON.stringify(siigoRequestBody, null, 2));
    
    const siigoResponse = await fetch("https://api.siigo.com/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${siigoToken}`,
        "Partner-Id": partnerId
      },
      body: JSON.stringify(siigoRequestBody)
    });

    console.log("[PURCHASES] Respuesta de Siigo:", {
      status: siigoResponse.status,
      statusText: siigoResponse.statusText,
      ok: siigoResponse.ok
    });

    // 📥 Procesar respuesta
    let siigoResult: any;
    const responseText = await siigoResponse.text();
    
    try {
      siigoResult = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("[PURCHASES] Error parseando respuesta de Siigo:", parseError);
      siigoResult = { 
        error: "Respuesta inválida de Siigo", 
        raw_response: responseText.substring(0, 500) 
      };
    }

    if (!siigoResponse.ok) {
      console.error("[PURCHASES] Error de Siigo API:", {
        status: siigoResponse.status,
        statusText: siigoResponse.statusText,
        response: siigoResult,
        request: siigoRequestBody
      });

      // 🔍 Log detallado para errores 400
      if (siigoResponse.status === 400) {
        console.error("[PURCHASES] Detalles del error 400:", {
          url: "https://api.siigo.com/v1/purchases",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${siigoToken.substring(0, 20)}...`,
            "Partner-Id": partnerId
          },
          payload: JSON.stringify(siigoRequestBody, null, 2),
          response_text: responseText,
          response_parsed: siigoResult
        });
      }

      // Respuesta de error más específica
      const errorMessage = siigoResult?.error || 
                          siigoResult?.message || 
                          siigoResult?.errors?.[0]?.message ||
                          siigoResult?.errors?.[0]?.error ||
                          `Error ${siigoResponse.status}: ${siigoResponse.statusText}`;

      return NextResponse.json({ 
        error: "Error al registrar la compra en Siigo",
        details: errorMessage,
        siigo_status: siigoResponse.status,
        siigo_response: siigoResult,
        debug_info: siigoResponse.status === 400 ? {
          payload_sent: siigoRequestBody,
          response_received: responseText
        } : undefined
      }, { status: siigoResponse.status });
    }

    // ✅ Éxito
    console.log("[PURCHASES] Compra registrada exitosamente:", {
      id: siigoResult.id,
      number: siigoResult.number,
      total: siigoResult.total
    });

    return NextResponse.json({
      success: true,
      message: `Compra registrada exitosamente. Número: ${siigoResult.number || 'N/A'}`,
      data: {
        id: siigoResult.id,
        number: siigoResult.number,
        total: siigoResult.total,
        date: siigoResult.date,
        supplier: siigoResult.supplier,
        provider_invoice: siigoResult.provider_invoice
      },
      siigo_response: siigoResult
    });

  } catch (error) {
    console.error("[PURCHASES] Excepción no controlada:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[PURCHASES] Stack trace:", errorStack);

    return NextResponse.json({
      error: "Error interno del servidor",
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}