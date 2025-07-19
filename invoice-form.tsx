"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Calculator, FileText, Building2, CreditCard, Database, Search, Zap } from "lucide-react"
import { Autocomplete } from "./components/autocomplete"

interface InvoiceItem {
  id: string
  type: "product" | "service" | "charge" | "discount"
  code: string
  description: string
  quantity: number
  price: number
  warehouse: string
  hasIVA: boolean
}

export default function SiigoInvoiceForm() {
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: "1",
      type: "product",
      code: "",
      description: "",
      quantity: 1,
      price: 0,
      warehouse: "",
      hasIVA: true,
    },
  ])

  const [hasIVA, setHasIVA] = useState(true)
  const [ivaPercentage, setIvaPercentage] = useState(19)
  const [sedeEnvio, setSedeEnvio] = useState("")
  const [selectedProvider, setSelectedProvider] = useState<any>(null)

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      type: "product",
      code: "",
      description: "",
      quantity: 1,
      price: 0,
      warehouse: sedeEnvio,
      hasIVA: true,
    }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const handleProviderSelect = (provider: any) => {
    setSelectedProvider(provider)
  }

  const handleProductSelect = (itemId: string, product: any) => {
    updateItem(itemId, "code", product.codigo)
    updateItem(itemId, "description", product.nombre)
    updateItem(itemId, "price", product.precio_base || 0)
    updateItem(itemId, "hasIVA", product.tiene_iva !== false)
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.price
      return item.type === "discount" ? sum - itemTotal : sum + itemTotal
    }, 0)
  }

  const calculateIVA = () => {
    if (!hasIVA) return 0
    return items.reduce((sum, item) => {
      if (item.hasIVA && item.type !== "discount") {
        const itemTotal = item.quantity * item.price
        return sum + (itemTotal * ivaPercentage) / 100
      }
      return sum
    }, 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateIVA()
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <FileText className="h-8 w-8 text-blue-600" />
          Facturación Electrónica Siigo
        </h1>

        {/* Instructivo Mejorado */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <FileText className="h-5 w-5" />📋 Manual de Uso - Sistema de Facturación Electrónica
            </CardTitle>
            <CardDescription className="text-blue-600">
              Guía completa para crear facturas electrónicas con Siigo API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Campos Obligatorios */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs">
                    !
                  </span>
                  Campos Obligatorios
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <strong>ID Documento:</strong> Identificador único del comprobante
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <strong>Fecha de Factura:</strong> Fecha de emisión obligatoria
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <strong>Código/Proveedor:</strong> Cliente o proveedor de la BD
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <strong>Mínimo 1 Item:</strong> Al menos un producto/servicio
                    </span>
                  </li>
                </ul>
              </div>

              {/* Autocompletado Inteligente */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Autocompletado Inteligente
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-1 text-yellow-500" />
                    <span>
                      <strong>Proveedores:</strong> Busca por código o nombre
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-1 text-yellow-500" />
                    <span>
                      <strong>Productos:</strong> Auto-llena precio y configuración IVA
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-1 text-yellow-500" />
                    <span>
                      <strong>Búsqueda en tiempo real:</strong> Mínimo 2 caracteres
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 mt-1 text-yellow-500" />
                    <span>
                      <strong>Conexión BD:</strong> Datos actualizados automáticamente
                    </span>
                  </li>
                </ul>
              </div>

              {/* Funciones Automáticas */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Funciones Automáticas
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>
                      <strong>Bodega:</strong> Se llena desde "Sede de Envío"
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>
                      <strong>Cálculos:</strong> Subtotales, IVA y total en tiempo real
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>
                      <strong>ID Pago:</strong> Generado automáticamente (8468)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>
                      <strong>Formato:</strong> Moneda colombiana (COP)
                    </span>
                  </li>
                </ul>
              </div>

              {/* Gestión de Items */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Gestión de Items
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>
                      <strong>Tipos:</strong> Producto, Servicio, Cargo, Descuento
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>
                      <strong>IVA Individual:</strong> Cada item puede tener IVA diferente
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>
                      <strong>Dinámico:</strong> Agregar/eliminar items ilimitados
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>
                      <strong>Validación:</strong> Campos requeridos por tipo
                    </span>
                  </li>
                </ul>
              </div>

              {/* IVA y Totales */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  IVA y Totales
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">%</span>
                    <span>
                      <strong>IVA General:</strong> 0%, 5%, 19% (default: 19%)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">%</span>
                    <span>
                      <strong>IVA por Item:</strong> Control individual por producto
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">%</span>
                    <span>
                      <strong>Cálculo Inteligente:</strong> Solo items con IVA activado
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">%</span>
                    <span>
                      <strong>Resumen:</strong> Desglose completo de totales
                    </span>
                  </li>
                </ul>
              </div>

              {/* Base de Datos */}
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Base de Datos
                </h4>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-1">◆</span>
                    <span>
                      <strong>Tabla Proveedores:</strong> Código + Nombre
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-1">◆</span>
                    <span>
                      <strong>Tabla Productos:</strong> Código + Nombre + Precio + IVA
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-1">◆</span>
                    <span>
                      <strong>API REST:</strong> Consultas optimizadas
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-1">◆</span>
                    <span>
                      <strong>Performance:</strong> Índices para búsquedas rápidas
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Nota importante */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-yellow-600 text-lg">💡</span>
                <div>
                  <h5 className="font-semibold text-yellow-800 mb-1">Tip Importante:</h5>
                  <p className="text-yellow-700 text-sm">
                    Para usar el autocompletado, escribe al menos 2 caracteres en los campos de Código/Proveedor o
                    Código Producto/Nombre. El sistema buscará automáticamente en la base de datos y mostrará
                    sugerencias relevantes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-muted-foreground">Sistema de facturación para Colombia con base de datos integrada</p>
      </div>

      <form className="space-y-6">
        {/* Información General del Documento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información General del Documento
            </CardTitle>
            <CardDescription>Datos básicos del comprobante de facturación</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-id">
                ID Documento <span className="text-red-500">*</span>
              </Label>
              <Input id="document-id" placeholder="Identificador del comprobante" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-date">
                Fecha de Factura <span className="text-red-500">*</span>
              </Label>
              <Input id="invoice-date" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voucher-number">Número de Comprobante</Label>
              <Input id="voucher-number" placeholder="Número del comprobante" />
            </div>

            <div className="space-y-2">
              <Autocomplete
                label="Código/Proveedor"
                placeholder="Buscar por código o nombre del proveedor..."
                apiEndpoint="/api/proveedores"
                value={selectedProvider ? `${selectedProvider.codigo} - ${selectedProvider.nombre}` : ""}
                onSelect={handleProviderSelect}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch-number">Sede de Envío</Label>
              <Input
                id="branch-number"
                placeholder="Sede que realiza el envío"
                value={sedeEnvio}
                onChange={(e) => {
                  setSedeEnvio(e.target.value)
                  setItems(items.map((item) => ({ ...item, warehouse: e.target.value })))
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select defaultValue="COP">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">🇨🇴 Peso Colombiano (COP)</SelectItem>
                  <SelectItem value="USD">🇺🇸 Dólar Americano (USD)</SelectItem>
                  <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="observations">Observaciones de Factura</Label>
              <Textarea
                id="observations"
                placeholder="Observaciones adicionales sobre la factura"
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Items de la Factura */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Items de la Factura
              </span>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Item
              </Button>
            </CardTitle>
            <CardDescription>Productos, servicios, cargos y descuentos con autocompletado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Item {index + 1}</Badge>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Item</Label>
                    <Select value={item.type} onValueChange={(value: any) => updateItem(item.id, "type", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">🛍️ Producto</SelectItem>
                        <SelectItem value="service">🔧 Servicio</SelectItem>
                        <SelectItem value="charge">💰 Cargo</SelectItem>
                        <SelectItem value="discount">🏷️ Descuento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Autocomplete
                      label="Código Producto/Nombre"
                      placeholder="Buscar producto por código o nombre..."
                      apiEndpoint="/api/productos"
                      value={item.code ? `${item.code} - ${item.description}` : ""}
                      onSelect={(product) => handleProductSelect(item.id, product)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Descripción del item"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", Number.parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", Number.parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bodega/Ubicación</Label>
                    <Input
                      value={item.warehouse}
                      onChange={(e) => updateItem(item.id, "warehouse", e.target.value)}
                      placeholder="Se llena automáticamente"
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Se llena automáticamente desde "Sede de Envío"</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`iva-${item.id}`}
                        checked={item.hasIVA}
                        onCheckedChange={(checked) => updateItem(item.id, "hasIVA", checked as boolean)}
                      />
                      <Label htmlFor={`iva-${item.id}`} className="text-sm font-medium">
                        Este item tiene IVA
                      </Label>
                    </div>
                    {item.hasIVA && hasIVA && (
                      <Badge variant="secondary" className="text-xs">
                        IVA aplicado: {ivaPercentage}%
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">
                      Subtotal Item: $
                      {(item.quantity * item.price || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                    </div>
                    {item.hasIVA && hasIVA && (
                      <Badge variant="outline" className="text-xs">
                        + IVA {ivaPercentage}%
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuración de IVA */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de IVA</CardTitle>
            <CardDescription>Configuración del impuesto al valor agregado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="has-iva" checked={hasIVA} onCheckedChange={(checked) => setHasIVA(checked as boolean)} />
              <Label htmlFor="has-iva">Aplicar IVA a la factura</Label>
            </div>

            {hasIVA && (
              <div className="space-y-2">
                <Label htmlFor="iva-percentage">Porcentaje de IVA (%)</Label>
                <Select
                  value={ivaPercentage.toString()}
                  onValueChange={(value) => setIvaPercentage(Number.parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="19">19%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información de Pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Información de Pago
            </CardTitle>
            <CardDescription>Método y valor del pago</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-id">ID Método de Pago</Label>
              <Input id="payment-id" value="8468" readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">Generado automáticamente para tu sucursal</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-value">Valor Total del Pago</Label>
              <Input
                id="payment-value"
                value={`$${calculateTotal().toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP`}
                readOnly
                className="bg-muted font-medium"
              />
            </div>
          </CardContent>
        </Card>

        {/* Resumen de Totales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">
                  ${calculateSubtotal().toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>

              {hasIVA && (
                <div className="flex justify-between">
                  <span>IVA ({ivaPercentage}%):</span>
                  <span className="font-medium">
                    ${calculateIVA().toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">
                  ${calculateTotal().toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button type="button" variant="outline" size="lg">
            Guardar Borrador
          </Button>
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700">
            Enviar Factura a Siigo
          </Button>
        </div>
      </form>
    </div>
  )
}
