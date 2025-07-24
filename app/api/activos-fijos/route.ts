import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // Consultar todos los activos de la tabla 'activos'
    const result = await pool.query(
      'SELECT codigo, nombre FROM activos ORDER BY codigo'
    );
    
    // Formatear los datos para el Autocomplete
    const activosFormateados = result.rows.map(activo => ({
      codigo: activo.codigo,
      nombre: activo.nombre
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
    