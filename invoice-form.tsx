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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Trash2, Calculator, FileText, Building2, CreditCard, Database, Search, Zap, HelpCircle, Info, Send } from "lucide-react"
import { Autocomplete } from "./components/autocomplete"
import { enviarFacturaASiigo } from "./app/api/siigo/enviarFactura"
import type { InvoiceItem, Provider, Product, FormData, SiigoResponse, AutocompleteOption } from "./types/siigo"



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
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string>('')

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

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number | boolean) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const handleProviderSelect = (option: AutocompleteOption) => {
    // Convertir AutocompleteOption a Provider
    const provider: Provider = {
      ...option,
      identification: option.codigo, // Mapear codigo a identification
      name: option.nombre // Mapear nombre a name
    }
    setSelectedProvider(provider)
  }

  const handleProductSelect = (itemId: string, option: AutocompleteOption) => {
    // Usar directamente las propiedades de AutocompleteOption
    updateItem(itemId, "code", option.codigo)
    updateItem(itemId, "description", option.nombre)
    updateItem(itemId, "price", option.precio_base || 0)
    updateItem(itemId, "hasIVA", option.tiene_iva !== false)
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

  const handleSubmitToSiigo = async (): Promise<void> => {
    setIsSubmitting(true)
    setSubmitMessage('')
    
    try {
      // Preparar datos del formulario
      const datosFormulario: FormData = {
        selectedProvider,
        items,
        sedeEnvio,
        hasIVA,
        ivaPercentage,
        observations: 'Factura generada desde formulario web'
      }
      
      console.log('🚀 Enviando factura a Siigo...', datosFormulario)
      
      const resultado: SiigoResponse = await enviarFacturaASiigo(datosFormulario)
      
      if (resultado.success) {
        setSubmitMessage('✅ Factura enviada exitosamente a Siigo!')
        console.log('✅ Factura enviada:', resultado.data)
      } else {
        setSubmitMessage(`❌ Error: ${resultado.message}`)
        console.error('❌ Error al enviar:', resultado.error)
      }
    } catch (error) {
      setSubmitMessage('💥 Error inesperado al enviar la factura')
      console.error('💥 Error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2 relative">
        <div className="absolute top-0 right-0">
          <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Manual de Uso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-700">
                  <FileText className="h-5 w-5" />
                  📋 Manual de Uso - Sistema de Facturación Electrónica
                </DialogTitle>
                <DialogDescription className="text-blue-600">
                  Guía completa para crear facturas electrónicas con Siigo API
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Campos Obligatorios */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600 font-medium">
                      <Building2 className="h-4 w-4" />
                      Campos Obligatorios
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">•</span>
                        <span><strong>Proveedor/Cliente:</strong> Selecciona de la lista o busca por NIT/Cédula</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">•</span>
                        <span><strong>Productos/Servicios:</strong> Al menos un item con código, cantidad y precio</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold">•</span>
                        <span><strong>Sede de Envío:</strong> Bodega desde donde se envían los productos</span>
                      </li>
                    </ul>
                  </div>

                  {/* Configuración de Productos */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                      <Database className="h-4 w-4" />
                      Productos y Servicios
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span><strong>Código:</strong> Identificador único del producto en Siigo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span><strong>Descripción:</strong> Nombre detallado del producto o servicio</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span><strong>Cantidad:</strong> Número de unidades (acepta decimales)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span><strong>Precio:</strong> Valor unitario sin IVA</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span><strong>IVA:</strong> Marcar si el producto tiene impuesto</span>
                      </li>
                    </ul>
                  </div>

                  {/* Configuración de IVA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <Calculator className="h-4 w-4" />
                      Configuración de IVA
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">•</span>
                        <span><strong>Aplicar IVA:</strong> Activa/desactiva el impuesto para toda la factura</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">•</span>
                        <span><strong>Porcentaje:</strong> 0%, 5% o 19% según el producto</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">•</span>
                        <span><strong>Cálculo:</strong> Se aplica automáticamente a productos marcados</span>
                      </li>
                    </ul>
                  </div>

                  {/* Información de Pago */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-purple-600 font-medium">
                      <CreditCard className="h-4 w-4" />
                      Métodos de Pago
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">•</span>
                        <span><strong>ID 8468:</strong> Método de pago configurado para tu sucursal</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">•</span>
                        <span><strong>Valor Total:</strong> Se calcula automáticamente (Subtotal + IVA)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">•</span>
                        <span><strong>Moneda:</strong> Pesos colombianos (COP)</span>
                      </li>
                    </ul>
                  </div>

                  {/* Proceso de Envío */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                      <Zap className="h-4 w-4" />
                      Proceso de Envío
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">•</span>
                        <span><strong>Validación:</strong> Se verifican todos los campos obligatorios</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">•</span>
                        <span><strong>Autenticación:</strong> Se obtiene token automáticamente</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">•</span>
                        <span><strong>Envío DIAN:</strong> Se envía directamente a facturación electrónica</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">•</span>
                        <span><strong>Confirmación:</strong> Recibes el CUFE si es exitoso</span>
                      </li>
                    </ul>
                  </div>

                  {/* Códigos y Referencias */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-600 font-medium">
                      <Search className="h-4 w-4" />
                      Códigos de Referencia
                    </div>
                    <ul className="space-y-2 text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span><strong>Documento:</strong> ID 138531 (Factura Electrónica)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span><strong>Vendedor:</strong> ID 35260 (Usuario del sistema)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span><strong>IVA:</strong> ID 13156 (Impuesto 19%)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span><strong>Pago:</strong> ID 8468 (Método configurado)</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-2">💡 Consejos Importantes</h4>
                      <ul className="space-y-1 text-xs text-blue-800">
                        <li>• Verifica que el proveedor/cliente exista en Siigo antes de facturar</li>
                        <li>• Los códigos de productos deben estar registrados y activos en Siigo</li>
                        <li>• Las facturas electrónicas no pueden tener fecha anterior al día actual</li>
                        <li>• El sistema calcula automáticamente subtotales, IVA y totales</li>
                        <li>• Guarda borradores para completar facturas más tarde</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <FileText className="h-8 w-8 text-blue-600" />
          Facturación Electrónica Siigo
        </h1>
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

        {/* Mensaje de estado */}
        {submitMessage && (
          <div className={`p-4 rounded-lg border ${
            submitMessage.includes('✅') 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="text-sm font-medium">{submitMessage}</p>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button type="button" variant="outline" size="lg">
            Guardar Borrador
          </Button>
          <Button 
            type="button" 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            onClick={handleSubmitToSiigo}
            disabled={isSubmitting || !selectedProvider || items.length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Factura a Siigo
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
