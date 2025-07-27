import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Buscar por código o nombre con paginación para mejorar rendimiento
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let sqlQuery = '';
  let countQuery = '';
  let values: any[] = [];
  let countValues: any[] = [];

  if (!query) {
    sqlQuery = `SELECT codigo, nombre FROM productos ORDER BY codigo LIMIT $1 OFFSET $2`;
    values = [limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos`;
    countValues = [];
  } else if (/^\d/.test(query)) {
    // Buscar por código con paginación
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE codigo ILIKE $1 ORDER BY codigo LIMIT $2 OFFSET $3`;
    values = [`${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos WHERE codigo ILIKE $1`;
    countValues = [`${query}%`];
  } else {
    // Buscar por nombre con paginación
    sqlQuery = `SELECT codigo, nombre FROM productos WHERE nombre ILIKE $1 ORDER BY nombre LIMIT $2 OFFSET $3`;
    values = [`${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos WHERE nombre ILIKE $1`;
    countValues = [`${query}%`];
  }

  try {
    // Ejecutar ambas consultas en paralelo para obtener datos y total
    const [result, countResult] = await Promise.all([
      pool.query(sqlQuery, values),
      pool.query(countQuery, countValues)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`[GASTOS/CUENTAS API] Query: "${query}" - Página: ${page}/${totalPages} - Resultados: ${result.rows.length}/${total}`);
    
    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}
