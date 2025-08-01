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
    
    try {
      // Validaciones básicas
      if (!state.provider) {
        throw new Error('Debe seleccionar un proveedor')
      }

      if (state.items.length === 0) {
        throw new Error('Debe agregar al menos un ítem')
      }

      // Construir payload para la API
      const payload = {
        provider: state.provider,
        items: state.items,
        invoiceDate: state.invoiceDate,
        providerInvoicePrefix: state.providerInvoicePrefix,
        providerInvoiceNumber: state.providerInvoiceNumber,
        observations: state.observations,
        ivaPercentage: state.ivaPercentage,
      }

      // Aquí iría la llamada a la API
      console.log('Enviando factura:', payload)
      
      // Simular envío
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setSubmitMessage('✅ Factura enviada correctamente')
    } catch (error) {
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setSubmitMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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

            <div className="space-y-2">
              <Label>
                Código Proveedor <span className="text-red-500">*</span>
              </Label>
              <Autocomplete
                label=""
                placeholder="Buscar proveedor..."
                apiEndpoint="/api/proveedores"
                value={state.providerCode}
                onSelect={handleProviderSelect}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Identificación</Label>
              <Input
                value={state.providerIdentification}
                readOnly
                className="bg-muted"
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
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Factura
              </>
            )}
          </Button>
        </div>

        {submitMessage && (
          <div className={`p-4 rounded-lg ${
            submitMessage.startsWith('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <p className="text-sm font-medium">{submitMessage}</p>
          </div>
        )}
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
