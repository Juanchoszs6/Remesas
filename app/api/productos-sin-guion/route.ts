import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  let sqlQuery = '';
  let values: any[] = [];

  if (!query) {
    // Si no hay parámetro de búsqueda, retornar todos los productos
    sqlQuery = `SELECT codigo_prod as codigo, nombre_prod as nombre FROM productos ORDER BY codigo_prod`;
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código
    sqlQuery = `
      SELECT codigo_prod as codigo, nombre_prod as nombre 
      FROM productos 
      WHERE codigo_prod ILIKE $1
      ORDER BY codigo_prod
      LIMIT 10
    `;
    values = [`${query}%`];
  } else {
    // Empieza con letra → buscar por nombre
    sqlQuery = `
      SELECT codigo_prod as codigo, nombre_prod as nombre 
      FROM productos 
      WHERE nombre_prod ILIKE $1
      ORDER BY nombre_prod
      LIMIT 10
    `;
    values = [`${query}%`];
  }

  try {
    const result = await pool.query(sqlQuery, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar tabla productos (sin guión bajo):', error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { codigo_prod, nombre_prod } = await req.json();

    if (!codigo_prod || !nombre_prod) {
      return NextResponse.json(
        { error: 'Código y nombre son requeridos' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'INSERT INTO productos (codigo_prod, nombre_prod) VALUES ($1, $2) RETURNING *',
      [codigo_prod, nombre_prod]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error al insertar en tabla productos (sin guión bajo):', error);
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
