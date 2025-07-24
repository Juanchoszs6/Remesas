import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Permite buscar por código o nombre (autocompletado)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  let sqlQuery = '';
  let values: any[] = [];

  if (!query) {
    sqlQuery = `SELECT codigo, nombre FROM productos ORDER BY codigo LIMIT 20`;
  } else if (/^\d/.test(query)) {
    // Buscar por código
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE codigo ILIKE $1 ORDER BY codigo LIMIT 20`;
    values = [`${query}%`];
  } else {
    // Buscar por nombre
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE nombre ILIKE $1 ORDER BY nombre LIMIT 20`;
    values = [`${query}%`];
  }

  try {
    const result = await pool.query(sqlQuery, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar cuentas contables:', error);
    return NextResponse.json({ error: 'Error al consultar cuentas contables' }, { status: 500 });
  }
}
