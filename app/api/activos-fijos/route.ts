import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // Consultar todos los activos de la tabla 'activos' con los campos necesarios
    const result = await pool.query(
      'SELECT codigo, nombre, precio_compra as "precio_base", true as "tiene_iva" FROM activos ORDER BY codigo'
    );
    
    // Formatear los datos para el Autocomplete
    const activosFormateados = result.rows.map(activo => ({
      codigo: activo.codigo,
      nombre: activo.nombre,
      precio_base: Number(activo.precio_base) || 0,
      tiene_iva: activo.tiene_iva !== false // Default to true if not specified
    }));
    
    return NextResponse.json(activosFormateados);
  } catch (error) {
    console.error('Error al consultar activos:', error);
    return NextResponse.json(
      { error: 'Error al consultar activos' }, 
      { status: 500 }
    );
  }
}
    