import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Buscar por código o nombre sin límite ni paginación
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  let sqlQuery = '';
  let values: any[] = [];

  if (!query) {
    sqlQuery = `SELECT codigo, nombre FROM productos ORDER BY codigo`;
  } else if (/^\d/.test(query)) {
    // Buscar por código
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE codigo ILIKE $1 ORDER BY codigo`;
    values = [`${query}%`];
  } else {
    // Buscar por nombre
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE nombre ILIKE $1 ORDER BY nombre`;
    values = [`${query}%`];
  }

  try {
    const result = await pool.query(sqlQuery, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}
