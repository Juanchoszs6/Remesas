 import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput } from "@/components/ui/number-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Autocomplete } from "@/components/autocomplete"
import { InvoiceItem } from "@/types/siigo"
import { Trash2 } from "lucide-react"

type InvoiceItemFormProps = {
  item: InvoiceItem
  onUpdate: (id: string, field: keyof InvoiceItem, value: any) => void
  onRemove: (id: string) => void
  index: number
  isLastItem: boolean
  ivaPercentage: number
  disabled?: boolean
}

export function InvoiceItemForm({ 
  item, 
  onUpdate, 
  onRemove, 
  index, 
  isLastItem,
  ivaPercentage,
  disabled = false
}: InvoiceItemFormProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Item {index + 1}</Badge>
        {!isLastItem && (
          <button 
            type="button" 
            onClick={() => onRemove(item.id)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Item</Label>
          <Select 
            value={item.type} 
            onValueChange={(value: 'product' | 'activo' | 'contable') => onUpdate(item.id, 'type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">🛍️ Producto</SelectItem>
              <SelectItem value="activo">🏢 Activo Fijo</SelectItem>
              <SelectItem value="contable">🏦 Cuenta Contable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {item.type === "product" && (
            <Autocomplete
              label="Código Producto"
              placeholder="Buscar producto..."
              apiEndpoint="/api/productos-lista"
              value={item.code}
              onSelect={(option) => {
                onUpdate(item.id, 'code', option.codigo);
                onUpdate(item.id, 'description', option.nombre);
                if (option.precio_base !== undefined) {
                  onUpdate(item.id, 'price', option.precio_base);
                }
                if (option.tiene_iva !== undefined) {
                  onUpdate(item.id, 'hasIVA', option.tiene_iva === true);
                }
              }}
              required
            />
          )}
            {item.type === "activos_fijos" && (
            <Autocomplete
              label="Código Activo Fijo"
              placeholder="Buscar activo fijo..."
              apiEndpoint="/api/activos-fijos"
              value={item.code}
              onSelect={(option) => {
                onUpdate(item.id, 'code', option.codigo);
                onUpdate(item.id, 'description', option.nombre);
                if (option.precio_base) {
                  onUpdate(item.id, 'price', option.precio_base);
                }
                if (option.tiene_iva !== undefined) {
                  onUpdate(item.id, 'hasIVA', option.tiene_iva);
                }
              }}
              required
            />
          )}
          {item.type === "contable" && (
            <Autocomplete
              label="Código Cuenta Contable"
              placeholder="Buscar cuenta contable..."
              apiEndpoint="/api/cuentas-contables"
              value={item.code}
              onSelect={(option) => {
                onUpdate(item.id, 'code', option.codigo);
                onUpdate(item.id, 'description', option.nombre);
              }}
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input
            value={item.description}
            readOnly
            className="bg-muted"
            placeholder="Se llenará automáticamente"
          />
        </div>

        <div className="space-y-2">
          <Label>Cantidad</Label>
          <NumberInput
            value={item.quantity}
            onChange={(value) => onUpdate(item.id, 'quantity', value === '' ? 1 : Number(value))}
            min={1}
            step={1}
            allowEmpty={false}
            placeholder="1"
          />
        </div>

        <div className="space-y-2">
          <Label>Precio Unitario</Label>
          <NumberInput
            value={item.price}
            onChange={(value) => onUpdate(item.id, 'price', value === '' ? 0 : Number(value))}
            min={0}
            step={0.01}
            allowEmpty={true}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`iva-${item.id}`}
              checked={item.hasIVA}
              onCheckedChange={(checked) => onUpdate(item.id, 'hasIVA', checked)}
            />
            <Label htmlFor={`iva-${item.id}`} className="text-sm font-medium">
              Este item tiene IVA
            </Label>
          </div>
          {item.hasIVA && (
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
            {(item.quantity * item.price).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
          </div>
          {item.hasIVA && (
            <Badge variant="outline" className="text-xs">
              + IVA {ivaPercentage}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
