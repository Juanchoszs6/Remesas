// app/api/siigo/route.ts
import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from './siigoAuth';

export async function GET() {
  const token = await obtenerTokenSiigo();
  if (token) {
    return NextResponse.json({ token });
  } else {
    return NextResponse.json({ error: 'No se pudo obtener el token' }, { status: 500 });
  }
}
