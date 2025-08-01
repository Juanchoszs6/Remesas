import { NextRequest, NextResponse } from "next/server";
import { obtenerTokenSiigo } from "../auth/route";

// 👉 Interfaces para tipado
interface SiigoItem {
  type: "Product" | "Service";
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: {
    percentage?: number;
    value?: number;
  };
  taxes?: Array<{
    id: number;
    name?: string;
    type?: string;
    percentage?: number;
    value?: number;
  }>;
}

interface SiigoPayment {
  id: number;
  name?: string;
  value: number;
  due_date: string;
}

interface SiigoPurchaseRequest {
  document: {
    id: number;
  };
  date: string;
  supplier: {
    identification: string;
    branch_office: number;
  };
  cost_center?: number;
  provider_invoice: {
    prefix: string;
    number: string;
    date?: string;
  };
  discount_type?: "Percentage" | "Value";
  currency: {
    code: string;
    exchange_rate: number;
  };
  observations?: string;
  items: SiigoItem[];
  payments: SiigoPayment[];
}

interface RequestItem {
  code: string;
  description: string;
  quantity: number;
  price: number;
  hasIVA: boolean;
  type?: string;
  warehouse?: string;
}

interface RequestBody {
  selectedProvider: {
    identification: string;
    name: string;
  };
  items: RequestItem[];
  provider_invoice: {
    prefix: string;
    number: string;
    date?: string;
  };
  hasIVA?: boolean;
  ivaPercentage?: number;
  observations?: string;
  sedeEnvio?: string;
}

// 👉 Utilidades
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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
      proveedor: body.selectedProvider?.identification,
      itemsCount: body.items?.length,
      provider_invoice: body.provider_invoice
    });

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

    // 🔒 Validaciones básicas
    if (!body.selectedProvider?.identification) {
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

    if (!body.provider_invoice?.prefix?.trim()) {
      return NextResponse.json({ 
        error: "Prefijo de factura requerido",
        details: "El campo provider_invoice.prefix es obligatorio"
      }, { status: 400 });
    }

    if (!body.provider_invoice?.number?.trim()) {
      return NextResponse.json({ 
        error: "Número de factura requerido",
        details: "El campo provider_invoice.number es obligatorio"
      }, { status: 400 });
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

    // 📅 Fechas
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30); // Vencimiento a 30 días

    // 🎯 IDs y configuraciones fijas (ajusta según tu configuración en Siigo)
    const DOCUMENT_ID = 1; // ID del tipo de documento en Siigo
    const COST_CENTER_ID = 235; // ID del centro de costos
    const PAYMENT_METHOD_ID = 8468; // ID del método de pago
    const IVA_TAX_ID = 13156; // ID del impuesto IVA en Siigo

    // 🧮 Preparar items para Siigo
    const ivaPercentage = body.ivaPercentage || 19;
    const siigoItems: SiigoItem[] = body.items.map((item) => {
      const subtotal = item.quantity * item.price;
      const siigoItem: SiigoItem = {
        type: "Product", // Siigo espera "Product" o "Service"
        code: item.code.trim(),
        description: item.description.trim(),
        quantity: item.quantity,
        price: item.price
      };

      // Agregar impuestos si el item tiene IVA
      if (item.hasIVA && body.hasIVA) {
        const ivaValue = (subtotal * ivaPercentage) / 100;
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

      return siigoItem;
    });

    // 🧮 Calcular total
    const grandTotal = calculateGrandTotal(body.items, ivaPercentage);

    // 💰 Preparar pagos
    const payments: SiigoPayment[] = [
      {
        id: PAYMENT_METHOD_ID,
        value: Number(grandTotal.toFixed(2)),
        due_date: formatDate(dueDate)
      }
    ];

    // 🧱 Construcción del body exacto para Siigo API
    const siigoRequestBody: SiigoPurchaseRequest = {
      document: { 
        id: DOCUMENT_ID 
      },
      date: formatDate(today),
      supplier: {
        identification: body.selectedProvider.identification.trim(),
        branch_office: 0 // Sucursal principal
      },
      cost_center: COST_CENTER_ID,
      provider_invoice: {
        prefix: body.provider_invoice.prefix.trim(),
        number: body.provider_invoice.number.trim(),
        ...(body.provider_invoice.date && { date: body.provider_invoice.date })
      },
      discount_type: "Value", // o "Percentage" según necesites
      currency: {
        code: "COP", // Peso colombiano
        exchange_rate: 1 // Para COP es 1
      },
      observations: body.observations?.trim() || "Factura de compra generada desde sistema web",
      items: siigoItems,
      payments: payments
    };

    console.log("[PURCHASES] Preparando petición a Siigo API:", {
      endpoint: "https://api.siigo.com/v1/purchases",
      documentId: DOCUMENT_ID,
      supplierId: body.selectedProvider.identification,
      itemsCount: siigoItems.length,
      total: grandTotal,
      provider_invoice: siigoRequestBody.provider_invoice
    });

    // 🚀 Envío a Siigo API
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

      // Respuesta de error más específica
      const errorMessage = siigoResult?.error || 
                          siigoResult?.message || 
                          siigoResult?.errors?.[0]?.message ||
                          `Error ${siigoResponse.status}: ${siigoResponse.statusText}`;

      return NextResponse.json({ 
        error: "Error al registrar la compra en Siigo",
        details: errorMessage,
        siigo_status: siigoResponse.status,
        siigo_response: siigoResult
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