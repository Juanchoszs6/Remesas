# Integración con Siigo Analytics

Este documento describe la integración con la API de Siigo para obtener y visualizar datos analíticos de facturas y gastos.

## Descripción General

La integración con Siigo permite obtener datos de facturas de compra y gastos para generar análisis y visualizaciones en el panel de facturación. Los datos incluyen:

- Total de facturas y montos
- Tendencias mensuales
- Distribución por categorías
- Proveedores principales
- Facturas recientes

## Estructura de la Integración

### Archivos Principales

1. **`app/api/siigo/siigoAuth.ts`**
   - Contiene la función `obtenerTokenSiigo` para autenticación con la API de Siigo

2. **`app/api/siigo/invoices/analytics.ts`**
   - Implementa la lógica para obtener y procesar datos de facturas desde Siigo
   - Define interfaces para los datos analíticos
   - Incluye funciones para procesar los datos y calcular métricas

3. **`app/api/siigo/invoices/analytics/route.ts`**
   - Define el endpoint API para obtener los datos analíticos
   - Soporta filtrado por periodo (1m, 3m, 6m, 1y)

4. **`components/billing/BillingContent.tsx`**
   - Componente principal para visualizar los datos analíticos
   - Muestra gráficos, tablas y métricas basadas en los datos de Siigo

5. **`app/test-analytics/page.tsx`**
   - Página de prueba para verificar la integración con Siigo
   - Muestra los datos analíticos en un formato similar al panel de facturación

## Configuración

Para utilizar la integración con Siigo, se requieren las siguientes variables de entorno:

```env
SIIGO_USERNAME=tu_usuario_siigo
SIIGO_ACCESS_KEY=tu_clave_de_acceso
SIIGO_PARTNER_ID=tu_partner_id  # Opcional, por defecto es 'RemesasYMensajes'
```

## Uso

### Obtener Datos Analíticos

Para obtener datos analíticos de facturas, realiza una petición GET al endpoint:

```
GET /api/siigo/invoices/analytics?periodo=6m
```

Parámetros de consulta:
- `periodo`: Periodo de tiempo para los datos (valores permitidos: 1m, 3m, 6m, 1y)

Respuesta:

```json
{
  "totalInvoices": 156,
  "totalAmount": 45678900,
  "averageAmount": 292814,
  "monthlyGrowth": 12.5,
  "topSuppliers": [...],
  "monthlyData": [...],
  "categoryBreakdown": [...],
  "recentInvoices": [...]
}
```

### Probar la Integración

Para probar la integración, visita la página de prueba en:

```
/test-analytics
```

Esta página muestra los datos analíticos obtenidos de Siigo y permite cambiar el periodo de tiempo.

## Flujo de Datos

1. El usuario selecciona un periodo en el panel de facturación
2. El componente `BillingContent` realiza una petición al endpoint `/api/siigo/invoices/analytics`
3. El endpoint obtiene un token de autenticación de Siigo
4. Se realizan peticiones a los endpoints de Siigo para obtener facturas y gastos
5. Los datos se procesan y se calculan métricas
6. Los datos procesados se devuelven al componente para su visualización

## Limitaciones y Consideraciones

- La API de Siigo tiene límites de peticiones por minuto y por día
- Los datos de categorías son simulados, ya que Siigo no proporciona categorización directa
- Para grandes volúmenes de facturas, se recomienda implementar paginación y caché

## Solución de Problemas

Si encuentras problemas con la integración, puedes:

1. Verificar la conexión con Siigo usando el endpoint de prueba: `/api/siigo/test`
2. Revisar los logs del servidor para ver errores detallados
3. Comprobar que las credenciales de Siigo estén correctamente configuradas

## Desarrollo Futuro

Mejoras planificadas para la integración:

1. Implementar caché para reducir llamadas a la API
2. Añadir más visualizaciones y métricas
3. Permitir exportación de datos en formato CSV/Excel
4. Implementar alertas para facturas con errores o pendientes