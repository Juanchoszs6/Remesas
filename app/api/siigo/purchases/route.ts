// app/api/siigo/purchases/route.ts

import { NextRequest, NextResponse } from "next/server";
import { obtenerTokenSiigo } from '../auth/route'

// Función para manejar una solicitud POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siigoToken = await obtenerTokenSiigo();

    if (!siigoToken) {
      console.error("[PURCHASES] No se pudo obtener el token de Siigo");
      return NextResponse.json({ error: "Token inválido" }, { status: 500 });
    }

    const partnerId = process.env.SIIGO_PARTNER_ID;
    if (!partnerId) {
      console.error("[PURCHASES] Error: SIIGO_PARTNER_ID no está configurado");
      return NextResponse.json({ error: "Error de configuración del servidor" }, { status: 500 });
    }

    // Asegurarse de que los IDs sean números
    const requestBody = {
      ...body,
      document: {
        id: Number(body.document?.id) || 1 // Usar el ID del documento o un valor por defecto
      },
      // Asegurarse de que los ítems tengan IDs numéricos
      items: Array.isArray(body.items) ? body.items.map((item: any) => ({
        ...item,
        id: Number(item.id) || undefined // Convertir a número o quitar el ID si no es válido
      })) : []
    };

    console.log("[PURCHASES] Enviando a API Siigo:", JSON.stringify(requestBody, null, 2));

    const siigoResponse = await fetch("https://api.siigo.com/v1/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${siigoToken}`,
        "Partner-Id": partnerId,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await siigoResponse.json();

    if (!siigoResponse.ok) {
      console.error("[PURCHASES] Error al registrar compra:", result);
      return NextResponse.json({ error: "Error en API Siigo", details: result }, { status: 400 });
    }

    console.log("[PURCHASES] Compra registrada correctamente:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PURCHASES] Error inesperado:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
