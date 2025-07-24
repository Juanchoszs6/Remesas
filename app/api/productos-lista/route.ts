import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  try {
    const result = await pool.query('SELECT codigo, descripcion FROM productos_ ORDER BY codigo');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar productos_:', error);
    return new NextResponse('Error al consultar productos_', { status: 500 });
  }
} 