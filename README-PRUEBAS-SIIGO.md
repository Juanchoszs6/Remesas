# 🧪 Guía Completa de Pruebas - Sistema de Facturas Siigo

## 📋 Índice
1. [Configuración Inicial](#configuración-inicial)
2. [Variables de Entorno](#variables-de-entorno)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Pruebas de Conectividad](#pruebas-de-conectividad)
5. [Subir Facturas de Compra/Gasto](#subir-facturas-de-compragasto)
6. [Solución de Problemas](#solución-de-problemas)
7. [API Endpoints](#api-endpoints)

---

## 🚀 Configuración Inicial

### Prerrequisitos
- Node.js 18+ instalado
- Cuenta activa en Siigo
- Credenciales de API de Siigo
- Next.js 13+ con App Router

### Instalación
```bash
# Clonar el repositorio
git clone [tu-repositorio]
cd siigo-invoice-form

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

---

## 🔐 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# === CREDENCIALES SIIGO ===
SIIGO_USERNAME=tu_usuario_siigo
SIIGO_ACCESS_KEY=tu_access_key_siigo
SIIGO_PARTNER_ID=tu_partner_id_opcional

# === CONFIGURACIÓN API ===
SIIGO_BASE_URL=https://api.siigo.com
SIIGO_API_VERSION=v1

# === CONFIGURACIÓN NEXT.JS ===
NEXTAUTH_SECRET=tu_secret_key_aqui
NEXTAUTH_URL=http://localhost:3000
```

### 📝 Cómo Obtener las Credenciales de Siigo

1. **Inicia sesión** en tu cuenta de Siigo
2. Ve a **Configuración** → **Integraciones** → **API**
3. **Genera** o copia tu `ACCESS_KEY`
4. Tu `USERNAME` es tu email de Siigo
5. El `PARTNER_ID` es opcional (para aplicaciones registradas)

---

## 📁 Estructura del Proyecto

```
siigo-invoice-form/
├── app/
│   ├── api/siigo/
│   │   ├── siigoAuth.ts          # Autenticación con Siigo
│   │   ├── test/route.ts         # Endpoint de pruebas
│   │   └── pruebas/
│   │       ├── testSiigoAuth.ts  # Pruebas de autenticación
│   │       └── testEnviarFactura.ts # Pruebas de envío
│   ├── test-siigo/
│   │   └── page.tsx              # Página de pruebas UI
│   └── invoice-form.tsx          # Formulario principal
├── components/ui/                # Componentes UI
└── README-PRUEBAS-SIIGO.md      # Esta guía
```

---

## 🔍 Pruebas de Conectividad

### Página de Pruebas
Navega a: `http://localhost:3000/test-siigo`

### ¿Qué Prueba Esta Página?

1. **✅ Autenticación**
   - Verifica credenciales de Siigo
   - Obtiene token de acceso
   - Valida permisos

2. **🌐 Conectividad de Endpoints**
   - `/document-types` - Tipos de documento
   - `/payment-types` - Métodos de pago
   - `/taxes` - Configuración de impuestos
   - `/users` - Información del usuario

3. **📊 Resumen de Resultados**
   - Estado general de la conexión
   - Detalles de cada endpoint
   - Mensajes de error específicos

### Interpretación de Resultados

| Estado | Significado | Acción |
|--------|-------------|---------|
| ✅ **Exitoso** | Todo funciona correctamente | Continúa con las pruebas |
| ❌ **Error de Auth** | Credenciales incorrectas | Revisa `.env.local` |
| ❌ **Error de Red** | Problemas de conectividad | Verifica internet/firewall |
| ❌ **Error 403** | Sin permisos | Contacta soporte Siigo |

---

## 💰 Subir Facturas de Compra/Gasto

### Tipos de Facturas Soportadas

#### 1. **Factura de Compra** (Purchase Invoice)
```json
{
  "type": "purchase",
  "document_type": "FV", // Factura de Venta del Proveedor
  "supplier": {
    "identification": "900123456",
    "name": "Proveedor Ejemplo S.A.S"
  },
  "items": [
    {
      "description": "Producto/Servicio",
      "quantity": 1,
      "unit_price": 100000,
      "tax_rate": 19
    }
  ]
}
```

#### 2. **Gasto** (Expense)
```json
{
  "type": "expense",
  "document_type": "GS", // Gasto
  "category": "office_supplies",
  "description": "Materiales de oficina",
  "amount": 50000,
  "tax_included": true
}
```

### Formulario de Prueba

1. **Accede al formulario**: `http://localhost:3000`
2. **Completa los campos obligatorios**:
   - Tipo de documento
   - Información del proveedor
   - Detalles de productos/servicios
   - Impuestos aplicables

3. **Envía la factura**
4. **Revisa el resultado** en la consola y UI

### Campos Obligatorios por Tipo

#### Para Facturas de Compra:
- ✅ Número de documento
- ✅ Fecha de emisión
- ✅ Proveedor (NIT/CC y nombre)
- ✅ Al menos un item con:
  - Descripción
  - Cantidad
  - Valor unitario
  - Impuestos

#### Para Gastos:
- ✅ Categoría del gasto
- ✅ Descripción
- ✅ Monto total
- ✅ Fecha del gasto

---

## 🛠️ Solución de Problemas

### Errores Comunes

#### 1. **Error 401 - No Autorizado**
```
Causa: Credenciales incorrectas
Solución: 
- Verifica SIIGO_USERNAME y SIIGO_ACCESS_KEY
- Regenera el ACCESS_KEY en Siigo
- Confirma que la cuenta esté activa
```

#### 2. **Error 403 - Sin Permisos**
```
Causa: Usuario sin permisos de API
Solución:
- Contacta al administrador de tu cuenta Siigo
- Solicita permisos de API para tu usuario
- Verifica el plan de Siigo (algunos requieren plan Pro)
```

#### 3. **Error 422 - Datos Inválidos**
```
Causa: Formato de datos incorrecto
Solución:
- Revisa los campos obligatorios
- Verifica formato de fechas (YYYY-MM-DD)
- Confirma que los códigos de impuestos sean válidos
```

#### 4. **Error de Red/Timeout**
```
Causa: Problemas de conectividad
Solución:
- Verifica conexión a internet
- Revisa configuración de firewall/proxy
- Intenta más tarde (puede ser mantenimiento de Siigo)
```

### Logs de Debug

Para activar logs detallados, agrega a `.env.local`:
```env
DEBUG_SIIGO=true
NODE_ENV=development
```

Los logs aparecerán en:
- **Consola del navegador** (F12)
- **Terminal del servidor** (donde ejecutas `npm run dev`)

---

## 🔌 API Endpoints

### Endpoints Internos (Tu App)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/siigo/test` | GET | Pruebas de conectividad |
| `/api/siigo/auth` | POST | Obtener token |
| `/api/siigo/invoice` | POST | Enviar factura |
| `/api/siigo/suppliers` | GET | Listar proveedores |

### Endpoints de Siigo (Externos)

| Endpoint | Descripción | Documentación |
|----------|-------------|---------------|
| `/auth` | Autenticación | [Docs Auth](https://siigoapi.docs.apiary.io/#reference/authentication) |
| `/document-types` | Tipos de documento | [Docs Types](https://siigoapi.docs.apiary.io/#reference/document-types) |
| `/vouchers` | Crear facturas | [Docs Vouchers](https://siigoapi.docs.apiary.io/#reference/vouchers) |
| `/taxes` | Configuración impuestos | [Docs Taxes](https://siigoapi.docs.apiary.io/#reference/taxes) |

---

## 📅 Plan de Pruebas para Mañana

### ✅ Checklist Pre-Pruebas

- [ ] Variables de entorno configuradas
- [ ] Página de pruebas funcionando
- [ ] Autenticación exitosa
- [ ] Endpoints respondiendo correctamente
- [ ] Formulario de facturas cargando

### 🧪 Secuencia de Pruebas Recomendada

1. **Pruebas de Conectividad** (5 min)
   - Ejecutar `/test-siigo`
   - Verificar todos los endpoints ✅

2. **Prueba de Factura Simple** (10 min)
   - Crear factura con 1 item
   - Sin impuestos complejos
   - Verificar respuesta de Siigo

3. **Prueba de Factura Completa** (15 min)
   - Múltiples items
   - Diferentes tipos de impuestos
   - Descuentos aplicados

4. **Prueba de Gasto** (10 min)
   - Gasto simple de oficina
   - Verificar categorización

5. **Pruebas de Error** (10 min)
   - Datos inválidos intencionalmente
   - Verificar manejo de errores

### 📊 Métricas a Monitorear

- ⏱️ **Tiempo de respuesta** de cada endpoint
- ✅ **Tasa de éxito** de las transacciones
- 🐛 **Errores específicos** y sus causas
- 💾 **Logs de debug** para análisis

---

## 📞 Contacto y Soporte

### Recursos Oficiales
- **Documentación Siigo API**: https://siigoapi.docs.apiary.io/
- **Soporte Siigo**: soporte@siigo.com
- **Portal Desarrolladores**: https://developers.siigo.com

### Información del Proyecto
- **Desarrollador**: [Tu nombre]
- **Fecha**: Enero 2025
- **Versión**: 1.0.0

---

## 🎯 Notas Importantes

> ⚠️ **IMPORTANTE**: Este es un entorno de pruebas. Las facturas creadas pueden afectar tu contabilidad real en Siigo.

> 💡 **TIP**: Usa el ambiente de pruebas de Siigo si está disponible para tu cuenta.

> 🔒 **SEGURIDAD**: Nunca subas el archivo `.env.local` al repositorio. Está incluido en `.gitignore`.

---

¡Listo para las pruebas de mañana! 🚀
