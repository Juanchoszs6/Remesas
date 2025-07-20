import { pruebaEnvioFactura, enviarFacturaASiigo, obtenerToken } from '../enviarFactura';

// Función para ejecutar pruebas de envío de factura
async function ejecutarPruebas() {
  console.log('🧪 === INICIANDO PRUEBAS DE ENVÍO DE FACTURA ===');
  
  try {
    // Prueba 1: Obtener token de autenticación
    console.log('\n🔐 Prueba 1: Obtener token de Siigo');
    const token = await obtenerToken();
    if (token) {
      console.log('✅ Token obtenido exitosamente (longitud:', token.length, 'caracteres)');
    } else {
      console.log('❌ No se pudo obtener el token');
    }
    
    // Datos de ejemplo para las pruebas
    const datosFormulario = {
      selectedProvider: {
        identification: '12345678'
      },
      items: [
        {
          id: '1',
          code: 'PROD001',
          description: 'Producto de prueba API',
          quantity: 1,
          price: 100000,
          warehouse: '',
          hasIVA: true
        },
        {
          id: '2',
          code: 'SERV001',
          description: 'Servicio de consultoría',
          quantity: 2,
          price: 75000,
          warehouse: '',
          hasIVA: true
        }
      ],
      observations: 'Factura de prueba desde formulario web - Test API'
    };
    
    console.log('📋 Datos del formulario preparados:', JSON.stringify(datosFormulario, null, 2));
    
    // Prueba 2: Envío real a Siigo (comentado para evitar envíos accidentales)
    console.log('\n🚀 Prueba 2: Envío a Siigo API');
    console.log('⚠️  NOTA: Descomenta la línea siguiente para hacer el envío real');
    // const resultado = await enviarFacturaASiigo(datosFormulario);
    // console.log('📊 Resultado del envío:', resultado);
    
    // Prueba 3: Función de prueba predefinida
    console.log('\n🎯 Prueba 3: Función de prueba predefinida');
    console.log('⚠️  NOTA: Descomenta la línea siguiente para hacer el envío real');
    // const resultadoPrueba = await pruebaEnvioFactura();
    // console.log('📈 Resultado de prueba:', resultadoPrueba);
    
    console.log('\n✅ === PRUEBAS COMPLETADAS ===');
    
  } catch (error) {
    console.error('💥 Error en las pruebas:', error);
  }
}

// Exportar para uso en otros archivos
export { ejecutarPruebas };

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarPruebas();
}
