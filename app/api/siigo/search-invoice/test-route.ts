import { NextResponse } from 'next/server';

// This is a test endpoint to simulate the Siigo API response
// In production, this would call the actual Siigo API
export async function GET(request: Request) {
  // Get the CUFE from query parameters
  const { searchParams } = new URL(request.url);
  const cufe = searchParams.get('cufe');

  if (!cufe) {
    return NextResponse.json(
      { error: 'El parámetro CUFE es requerido' },
      { status: 400 }
    );
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return a mock response based on the CUFE
  if (cufe === 'TEST1234567890') {
    return NextResponse.json({
      success: true,
      data: {
        id: 'test-invoice-123',
        number: '12345',
        date: new Date().toISOString().split('T')[0],
        provider_invoice: {
          prefix: 'FC',
          number: '12345',
          cufe: 'TEST1234567890'
        },
        supplier: {
          identification: '900123456-7',
          name: 'Proveedor de Prueba S.A.S.',
          branch_office: 0
        },
        observations: 'Factura de prueba generada automáticamente',
        cost_center: 'CC001',
        items: [
          {
            id: 'item-1',
            type: 'product',
            code: 'PROD001',
            description: 'Producto de prueba',
            quantity: 2,
            price: 100000,
            discount: 0,
            taxes: [
              {
                id: 18384,
                tax_base: 200000,
                type: 'IVA'
              }
            ]
          }
        ]
      }
    });
  }

  // Return not found for any other CUFE
  return NextResponse.json(
    { error: 'No se encontró una factura con el CUFE proporcionado' },
    { status: 404 }
  );
}
