# Tareas Pendientes - Integración SIIGO

## Prioridad Alta

### 1. Configuración de Variables de Entorno
- [ ] Crear archivo `.env.local` con las siguientes variables:
  ```
  SIIGO_AUTH_URL=
  SIIGO_USERNAME=
  SIIGO_ACCESS_KEY=
  SIIGO_PARTNER_ID=RemesasYMensajes
  SIIGO_API_URL=https://api.siigo.com/v1
  ```

### 2. Pruebas de Integración
- [ ] Probar autenticación con SIIGO
- [ ] Probar creación de facturas de compra
- [ ] Validar respuesta de errores de la API

### 3. Documentación
- [ ] Documentar los endpoints disponibles
- [ ] Crear ejemplos de solicitud/respuesta
- [ ] Documentar códigos de error comunes

## Prioridad Media

### 4. Mejoras en el Frontend
- [ ] Agregar manejo de estados de carga
- [ ] Mejorar mensajes de error para el usuario
- [ ] Validación de formulario en tiempo real

### 5. Logging y Monitoreo
- [ ] Configurar logging estructurado
- [ ] Agregar métricas de rendimiento
- [ ] Configurar alertas para errores críticos

## Prioridad Baja

### 6. Optimizaciones
- [ ] Implementar caché para tokens
- [ ] Optimizar peticiones a la API
- [ ] Revisar y optimizar el bundle size

### 7. Seguridad
- [ ] Revisar manejo de tokens
- [ ] Validar entradas del usuario
- [ ] Implementar rate limiting

## Notas Adicionales
- El ID de documento por defecto es `27524`
- La moneda por defecto es COP
- El ID de impuesto por defecto es `13156`

## Pasos para Probar
1. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
2. Probar el endpoint POST a `/api/siigo/get-purchases`
3. Verificar logs para depuración

## Contacto
- Para soporte técnico, contactar al equipo de desarrollo
- Documentación de la API SIIGO: [https://siigoapi.azure-api.net/](https://siigoapi.azure-api.net/)
