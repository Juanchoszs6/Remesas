// app/api/proveedores/route.ts
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

  if (query.trim() === '') {
    // Sin parámetro de búsqueda → devolver TODOS los proveedores
    sqlQuery = `
      SELECT codigo, nombre 
      FROM proveedores 
      ORDER BY nombre
    `;
    values = [];
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código (sin límite)
    sqlQuery = `
      SELECT codigo, nombre 
      FROM proveedores 
      WHERE codigo ILIKE $1
      ORDER BY codigo
    `;
    values = [`${query}%`];
  } else {
    // Empieza con letra → buscar por nombre (sin límite)
    sqlQuery = `
      SELECT codigo, nombre 
      FROM proveedores 
      WHERE nombre ILIKE $1
      ORDER BY nombre
    `;
    values = [`${query}%`];
  }

  try {
    const result = await pool.query(sqlQuery, values);
    console.log(`[PROVEEDORES API] Query: "${query}" - Resultados: ${result.rows.length}`);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar proveedores:', error);
    return new NextResponse('Error al consultar proveedores', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { codigo, nombre } = data;

    if (!codigo || !nombre) {
      return new NextResponse('Código y nombre son requeridos', { status: 400 });
    }

    const result = await pool.query(
      'INSERT INTO proveedores (codigo, nombre) VALUES ($1, $2) RETURNING *',
      [codigo, nombre]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    return new NextResponse('Error al crear proveedor', { status: 500 });
  }
}