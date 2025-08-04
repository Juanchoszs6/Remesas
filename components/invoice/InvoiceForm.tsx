import { useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { InvoiceItemForm } from "@/components/invoice/InvoiceItemForm";
import { InvoiceItem } from "@/types/siigo";
import { Plus, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Autocomplete } from '@/components/autocomplete';
import { useRouter } from 'next/navigation';

interface Provider {
  identificacion: string;
  nombre: string;
  tipo_documento: string;
  nombre_comercial: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  correo_electronico: string;
  codigo?: string;
  // For backward compatibility
  identification?: string;
  name?: string;
}

interface InvoiceState {
  provider: Provider | null;
  items: InvoiceItem[];
  invoiceDate: string;
  documentId: string;
  providerInvoiceNumber: string;
  observations: string;
  ivaPercentage: number;
  providerCode: string;
  providerIdentification: string;
  providerInvoicePrefix: string;
}
type InvoiceFormAction =
  | { type: 'ADD_ITEM'; payload: InvoiceItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: { id: string; field: string; value: any } }
  | { type: 'UPDATE_FIELD'; payload: { field: string; value: any } }
  | { type: 'SET_PROVIDER'; payload: Provider | null }
  | { type: 'SET_DOCUMENT_ID'; payload: string }
  | { type: 'SET_PROVIDER_INVOICE_NUMBER'; payload: string }

const initialState: InvoiceState = {
  items: [],
  provider: null,
  providerCode: "",
  providerIdentification: "",
  invoiceDate: new Date().toISOString().split('T')[0],
  documentId: "",
  providerInvoiceNumber: "",
  providerInvoicePrefix: "",
  observations: "",
  ivaPercentage: 19,
};

function invoiceFormReducer(state: InvoiceState, action: InvoiceFormAction): InvoiceState {
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
      if (!action.payload) {
        return {
          ...state,
          provider: null,
          providerCode: "",
          providerIdentification: ""
        };
      }
      return {
        ...state,
        provider: action.payload,
        providerCode: action.payload.identificacion,
        providerIdentification: action.payload.nombre,
      }

    case 'SET_DOCUMENT_ID':
      return {
        ...state,
        documentId: action.payload,
      }

    case 'SET_PROVIDER_INVOICE_NUMBER':
      return {
        ...state,
        providerInvoiceNumber: action.payload,
      }

    default:
      return state
  }
}

export function InvoiceForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(invoiceFormReducer, initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      type: 'product',
      code: '',
      description: '',
      quantity: 1,
      price: 0,
      warehouse: '1',
      hasIVA: true,
    };
    dispatch({ type: 'ADD_ITEM', payload: newItem });
  };

  const handleProviderSelect = (option: any) => {
    if (!option) {
      dispatch({ type: 'SET_PROVIDER', payload: null });
      return;
    }
    
    // Create a complete provider object with all required fields for Siigo
    const provider: Provider = {
      identificacion: option.identification || option.identificacion || '',
      nombre: option.nombre || option.name || '',
      tipo_documento: '31', // Default to NIT for Colombia
      nombre_comercial: option.nombre || option.name || '',
      ciudad: option.ciudad || 'Bogotá', // Default city
      direccion: option.direccion || 'No especificada',
      telefono: option.telefono || '0000000',
      correo_electronico: option.correo_electronico || 'no@especificado.com',
      // Additional fields for internal use
      codigo: option.codigo || '',
      identification: option.identification || option.identificacion || ''
    };
    
    // Update the provider in the form state
    dispatch({ type: 'SET_PROVIDER', payload: provider });
    
    // Update related fields in the form state
    if (option.identificacion || option.identification) {
      dispatch({ 
        type: 'UPDATE_FIELD', 
        payload: { 
          field: 'providerIdentification', 
          value: option.identificacion || option.identification 
        } 
      });
    }
    
    if (option.codigo) {
      dispatch({ 
        type: 'UPDATE_FIELD', 
        payload: { 
          field: 'providerCode', 
          value: option.codigo 
        } 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!state.provider) {
        throw new Error('Debe seleccionar un proveedor');
      }

      if (!state.providerInvoiceNumber) {
        throw new Error('El número de factura es requerido');
      }

      if (state.items.length === 0) {
        throw new Error('Debe agregar al menos un ítem');
      }

      // Build the payload for the Siigo API
      const payload = {
        provider: {
          // Required fields from the selected provider
          identificacion: state.provider.identificacion || state.provider.identification || '',
          nombre: state.provider.nombre || state.provider.name || '',
          tipo_documento: state.provider.tipo_documento || '31', // 31 = NIT for Colombia
          nombre_comercial: state.provider.nombre_comercial || state.provider.nombre || state.provider.name || '',
          ciudad: state.provider.ciudad || 'Bogotá',
          direccion: state.provider.direccion || 'No especificada',
          telefono: state.provider.telefono || '0000000',
          correo_electronico: state.provider.correo_electronico || 'no@especificado.com',
          // Include any additional fields that might be needed
          ...(state.provider.codigo && { codigo: state.provider.codigo })
        },
        items: state.items.map(item => ({
          id: item.id,
          type: item.type,
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          price: Number(item.price),
          hasIVA: item.hasIVA,
          discount: item.discount
        })),
        documentId: state.documentId,
        providerInvoiceNumber: state.providerInvoiceNumber,
        providerInvoicePrefix: state.providerInvoicePrefix || 'FV1',
        invoiceDate: state.invoiceDate || new Date().toISOString().split('T')[0],
        observations: state.observations,
        ivaPercentage: state.ivaPercentage || 19
      };

      console.log('Enviando factura a Siigo:', payload);
      
      // Llamada a la API
      const response = await fetch('/api/siigo/purchases', {
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
      
      // Limpiar el formulario después de un envío exitoso
      dispatch({ type: 'SET_PROVIDER', payload: null });
      dispatch({ type: 'SET_DOCUMENT_ID', payload: '' });
      dispatch({ type: 'SET_PROVIDER_INVOICE_NUMBER', payload: '' });
      dispatch({ type: 'UPDATE_FIELD', payload: { field: 'items', value: [] } });
      dispatch({ type: 'UPDATE_FIELD', payload: { field: 'observations', value: '' } });
      
      // Recargar la página para limpiar el estado
      router.refresh();
      
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
  };

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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-id">Número de Factura</Label>
              <Input
                id="document-id"
                placeholder="Número de identificación del documento"
                value={state.documentId}
                onChange={(e) =>
                  dispatch({ type: 'SET_DOCUMENT_ID', payload: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Identificador numérico del documento en Siigo
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Proveedor</Label>
                <Autocomplete
                  label="Proveedor"
                  placeholder="Buscar proveedor..."
                  apiEndpoint="/api/proveedores"
                  value={state.provider?.name || ''}
                  onSelect={handleProviderSelect}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-invoice-number">Código Único de Factura - CUFE</Label>
                <Input
                  id="provider-invoice-number"
                  placeholder="Ingrese el CUFE de la factura"
                  value={state.providerInvoiceNumber}
                  onChange={(e) =>
                    dispatch({ type: 'SET_PROVIDER_INVOICE_NUMBER', payload: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Código Único de Factura Electrónica
                </p>
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
                onClick={handleAddItem}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ítem
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay ítems en la factura</p>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-2"
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar primer ítem
                </Button>
              </div>
            ) : (
              state.items.map((item, index) => (
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
                  disabled={isSubmitting}
                />
              ))
            )}
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
        <div className="flex justify-end gap-4">
          <Button 
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            size="lg"
            disabled={isSubmitting || state.items.length === 0}
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
