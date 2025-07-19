// app/api/productos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  let sqlQuery = '';
  let values: any[] = [];

  if (/^\d/.test(query)) {
    // Empieza con número → buscar por código
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos 
      WHERE codigo ILIKE $1
      ORDER BY codigo
      LIMIT 10
    `;
    values = [`${query}%`];
  } else {
    // Empieza con letra → buscar por nombre
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos 
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
    return new NextResponse('Error al consultar productos', { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { codigo, nombre, precio_base, tiene_iva } = data;

    if (!codigo || !nombre) {
      return new NextResponse('Código y nombre son requeridos', { status: 400 });
    }

    const result = await pool.query(
      'INSERT INTO productos (codigo, nombre, precio_base, tiene_iva) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo, nombre, precio_base, tiene_iva]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al insertar producto:', error);
    return new NextResponse('Error al insertar producto', { status: 500 });
  }
}