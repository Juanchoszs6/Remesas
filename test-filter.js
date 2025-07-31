// Script para probar el filtrado por fecha en el endpoint de get-purchases

async function testDateFiltering() {
  console.log('Iniciando prueba de filtrado por fecha...');
  
  // Probar diferentes rangos de fechas
  const testCases = [
    {
      name: 'Julio 2025 (específico)',
      params: {
        created_start: '2025-07-01',
        created_end: '2025-07-31',
        get_all_pages: 'true'
      }
    },
    {
      name: 'Junio 2025 (específico)',
      params: {
        created_start: '2025-06-01',
        created_end: '2025-06-30',
        get_all_pages: 'true'
      }
    },
    {
      name: 'Año 2024 completo',
      params: {
        created_start: '2024-01-01',
        created_end: '2024-12-31',
        get_all_pages: 'true'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nProbando caso: ${testCase.name}`);
    
    try {
      // Construir la URL con los parámetros
      const queryParams = new URLSearchParams(testCase.params);
      const url = `http://localhost:3000/api/siigo/get-purchases?${queryParams.toString()}`;
      
      console.log(`URL: ${url}`);
      
      // Realizar la solicitud
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Error en la respuesta: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      // Mostrar información sobre los resultados
      console.log(`Resultados obtenidos: ${data.results?.length || 0}`);
      
      if (data.pagination) {
        console.log('Información de paginación:');
        console.log(`- Total de elementos: ${data.pagination.total_items || 0}`);
        console.log(`- Elementos originales: ${data.pagination.original_total_items || 'N/A'}`);
        console.log(`- Filtrado en servidor: ${data.pagination.filtered_by_server ? 'Sí' : 'No'}`);
      }
      
      // Mostrar una muestra de las fechas de las facturas
      if (data.results && data.results.length > 0) {
        console.log('Muestra de fechas de facturas:');
        const sampleInvoices = data.results.slice(0, 5);
        
        sampleInvoices.forEach((invoice, index) => {
          console.log(`${index + 1}. ID: ${invoice.id}, Fecha: ${invoice.date}, Creado: ${invoice.created || 'N/A'}`);
        });
      } else {
        console.log('No se encontraron facturas para este rango de fechas.');
      }
    } catch (error) {
      console.error(`Error al probar caso ${testCase.name}:`, error);
    }
  }
}

// Ejecutar la prueba
testDateFiltering();