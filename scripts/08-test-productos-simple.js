const { Client } = require('pg');
require('dotenv').config();

async function testProductos() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Verificar si existe la tabla productos_
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'productos_'
      );
    `);
    
    console.log('📋 ¿Existe tabla productos_?', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Contar registros
      const count = await client.query('SELECT COUNT(*) as total FROM productos_');
      console.log('📊 Total de productos_:', count.rows[0].total);

      // Mostrar algunos productos
      const sample = await client.query('SELECT codigo, nombre FROM productos_ LIMIT 5');
      console.log('📝 Productos de ejemplo:');
      console.table(sample.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testProductos();
