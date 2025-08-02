import { useReducer, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Plus, Send, Trash2 } from "lucide-react"
import { Autocomplete } from "@/components/autocomplete"
import { InvoiceItemForm } from "@/components/invoice/InvoiceItemForm"
import { InvoiceItem, Provider } from "@/types/siigo"
import { toast } from "sonner"

type InvoiceFormState = {
  items: InvoiceItem[]
  provider: Provider | null
  providerCode: string
  providerIdentification: string
  invoiceDate: string
  providerInvoicePrefix: string
  providerInvoiceNumber: string
  observations: string
  ivaPercentage: number
}

type InvoiceFormAction =
  | { type: 'ADD_ITEM' }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: { id: string; field: string; value: any } }
  | { type: 'UPDATE_FIELD'; payload: { field: string; value: any } }
  | { type: 'SET_PROVIDER'; payload: Provider }

const initialState: InvoiceFormState = {
  items: [{
    id: Date.now().toString(),
    type: 'product',
    code: '',
    description: '',
    quantity: 1,
    price: 0,
    warehouse: '1',
    hasIVA: true,
  }],
  provider: null,
  providerCode: '',
  providerIdentification: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  providerInvoicePrefix: 'FAC',
  providerInvoiceNumber: '',
  observations: '',
  ivaPercentage: 19,
}

function invoiceFormReducer(state: InvoiceFormState, action: InvoiceFormAction): InvoiceFormState {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [
          ...state.items,
          {
            id: Date.now().toString(),
            type: 'product',
            code: '',
            description: '',
            quantity: 1,
            price: 0,
            warehouse: '1',
            hasIVA: true,
          },
        ],
      }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      }

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, [action.payload.field]: action.payload.value }
            : item
        ),
      }

    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
      }

    case 'SET_PROVIDER':
      return {
        ...state,
        provider: action.payload,
        providerCode: action.payload.identification,
        providerIdentification: action.payload.name,
      }

    default:
      return state
  }
}

export function InvoiceForm() {
  const [state, dispatch] = useReducer(invoiceFormReducer, initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  const handleProviderSelect = useCallback((option: any) => {
    const provider: Provider = {
      ...option,
      identification: option.codigo,
      name: option.nombre,
    }
    dispatch({ type: 'SET_PROVIDER', payload: provider })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitMessage('')
    
    try {
      // Validaciones básicas
      if (!state.provider) {
        throw new Error('Debe seleccionar un proveedor')
      }

      if (state.items.length === 0) {
        throw new Error('Debe agregar al menos un ítem')
      }

      if (!state.providerInvoiceNumber) {
        throw new Error('El número de factura es requerido')
      }

      // Construir payload para la API de Siigo
      const payload = {
        document_id: 1, // ID del documento en Siigo (deberías obtenerlo de la configuración)
        fecha: state.invoiceDate,
        proveedor_nit: state.provider.identification,
        centro_costo_id: 1, // ID del centro de costos (deberías obtenerlo de la configuración)
        prefijo_factura_proveedor: state.providerInvoicePrefix,
        numero_factura_proveedor: state.providerInvoiceNumber,
        codigo_moneda: 'COP', // Moneda por defecto
        tasa_cambio: 1, // Tasa de cambio por defecto
        observaciones: state.observations,
        items: state.items.map(item => ({
          tipo: item.type,
          codigo: item.code || 'ITEM-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          descripcion: item.description || 'Producto sin descripción',
          cantidad: item.quantity,
          precio: item.price,
          impuestos_id: item.hasIVA ? [1] : [] // ID del impuesto IVA en Siigo (deberías obtenerlo de la configuración)
        })),
        pagos: [{
          id: 1, // ID del método de pago en Siigo (deberías obtenerlo de la configuración)
          valor: calculateTotal(state.items, state.ivaPercentage),
          fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 días a partir de hoy
        }]
      };

      console.log('Enviando factura a Siigo:', payload);
      
      // Llamada a la API
      const response = await fetch('/api/siigo/create-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error en la respuesta de la API:', data);
        throw new Error(data.error || 'Error al enviar la factura a Siigo');
      }
      
      // Mostrar mensaje de éxito
      toast.success('✅ Factura enviada correctamente a Siigo', {
        description: 'Puedes ver el resultado en tu panel de Siigo.',
        duration: 4000,
      });
      // Reiniciar el formulario después de un envío exitoso
      dispatch({
        type: 'UPDATE_FIELD',
        payload: { field: 'providerInvoiceNumber', value: '' }
      });
    } catch (error) {
      console.error('Error al enviar la factura:', error);
      let errorMessage = 'Error desconocido al enviar la factura';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      toast.error(`❌ Error al enviar la factura: ${errorMessage}`, {
        description: 'Revisa los datos y tu conexión con Siigo.',
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {submitMessage && (
        <div className={`p-4 rounded-md ${
          submitMessage.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {submitMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección de información general */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider-invoice-prefix">
                Prefijo Factura Proveedor <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="provider-invoice-prefix" 
                placeholder="Ej: FAC, FV, etc."
                value={state.providerInvoicePrefix}
                onChange={(e) => dispatch({
                  type: 'UPDATE_FIELD',
                  payload: { field: 'providerInvoicePrefix', value: e.target.value }
                })}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-invoice-number">
                Número Factura Proveedor <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="provider-invoice-number" 
                placeholder="Número de factura"
                value={state.providerInvoiceNumber}
                onChange={(e) => dispatch({
                  type: 'UPDATE_FIELD',
                  payload: { field: 'providerInvoiceNumber', value: e.target.value }
                })}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-date">
                Fecha de Factura <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="invoice-date" 
                type="date" 
                value={state.invoiceDate}
                onChange={(e) => dispatch({
                  type: 'UPDATE_FIELD',
                  payload: { field: 'invoiceDate', value: e.target.value }
                })}
                required 
              />
            </div>
          </CardContent>
        </Card>

        {/* Sección de ítems */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ítems de la Factura</CardTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => dispatch({ type: 'ADD_ITEM' })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ítem
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.items.map((item, index) => (
              <InvoiceItemForm
                key={item.id}
                item={item}
                index={index}
                isLastItem={index === state.items.length - 1}
                onUpdate={(id, field, value) => dispatch({
                  type: 'UPDATE_ITEM',
                  payload: { id, field, value }
                })}
                onRemove={(id) => dispatch({ type: 'REMOVE_ITEM', payload: id })}
                ivaPercentage={state.ivaPercentage}
              />
            ))}
          </CardContent>
        </Card>

        {/* Sección de totales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">
                  ${calculateSubtotal(state.items).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">
                  ${calculateTotal(state.items, state.ivaPercentage).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botón de envío */}
        <div className="flex justify-end">
          <Button 
            type="submit"
            size="lg"
            disabled={isSubmitting}
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Enviando a Siigo...' : 'Enviar Factura a Siigo'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// Funciones de utilidad
function calculateSubtotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
}

function calculateTotal(items: InvoiceItem[], ivaPercentage: number): number {
  const subtotal = calculateSubtotal(items)
  const iva = items.some(item => item.hasIVA) 
    ? subtotal * (ivaPercentage / 100)
    : 0
  return subtotal + iva
}
