// app/api/productos/route.ts
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
    sqlQuery = `SELECT codigo, nombre FROM productos_ ORDER BY codigo`;
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos_ 
      WHERE codigo ILIKE $1
      ORDER BY codigo
      LIMIT 10
    `;
    values = [`${query}%`];
  } else {
    // Empieza con letra → buscar por nombre
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos_ 
      WHERE nombre ILIKE $1
      ORDER BY nombre
      LIMIT 10
    `;
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
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { codigo, nombre, precio_base, tiene_iva } = data;

    if (!codigo || !nombre) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 });
    }

    const result = await pool.query(
      'INSERT INTO productos_ (codigo, nombre, precio_base, tiene_iva) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo, nombre, precio_base, tiene_iva]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al insertar producto:', error);
    return NextResponse.json({ error: 'Error al insertar producto' }, { status: 500 });
  }
}