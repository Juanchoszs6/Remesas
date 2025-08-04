// Tipos para el formulario de facturación
export interface InvoiceItem {
  id: string;
  type: "product" | "service" | "charge" | "discount" | "activos_fijos";
  code: string;
  description: string;
  quantity: number;
  price: number;
  warehouse: string;
  hasIVA: boolean;
  discount?: {
    value: number;
    percentage: number;
  };
}

// Tipo base para opciones de autocompletado
export interface AutocompleteOption {
  codigo: string;
  nombre: string;
  precio_base?: number;
  tiene_iva?: boolean;
}

export interface Provider extends AutocompleteOption {
  id?: string;
  identification: string;
  name: string;
  branch_office?: number;
  // Campos adicionales para compatibilidad con la API de Siigo
  codigo: string;
  nombre: string;
  tipo_documento: string;
  identificacion: string;
  nombre_comercial: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  correo_electronico: string;
}

export interface Product extends AutocompleteOption {
  // Hereda codigo, nombre, precio_base, tiene_iva de AutocompleteOption
}

export interface FormData {
  selectedProvider: Provider | null;
  items: InvoiceItem[];
  sedeEnvio: string;
  hasIVA: boolean;
  ivaPercentage: number;
  observations?: string;
  invoiceDate?: string;
  costCenter?: string;
  providerInvoicePrefix?: string;
  providerInvoiceNumber?: string;
}

// Tipos para la respuesta de la API de Siigo
export interface SiigoResponse {
  success: boolean;
  data?: SiigoInvoiceResponse;
  error?: string;
  message: string;
}

// Respuesta de la API de Siigo para facturas de compra
export interface SiigoPurchaseInvoiceResponse {
  id: string;
  document: {
    id: number;
  };
  number: number;
  name: string;
  date: string;
  supplier: {
    identification: string;
    branch_office: number;
  };
  cost_center?: number;
  provider_invoice?: {
    prefix?: string;
    number?: string;
  };
  discount_type?: "Value" | "Percentage";
  currency?: {
    code: string;
    exchange_rate: number;
  };
  total: number;
  balance: number;
  observations?: string;
  items: SiigoPurchaseItemResponse[];
  payments: SiigoPaymentResponse[];
  metadata: {
    created: string;
    last_updated?: string;
  };
}

// Respuesta de items para facturas de compra
export interface SiigoPurchaseItemResponse {
  type: "Product" | "FixedAsset" | "Account";
  id: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: {
    percentage?: number;
    value?: number;
  };
  taxes?: {
    id: number;
    name: string;
    type: string;
    percentage: number;
    value: number;
  }[];
  total: number;
}

// Respuesta de la API de Siigo para facturas de venta (mantener para compatibilidad)
export interface SiigoInvoiceResponse {
  id: string;
  document: {
    id: number;
  };
  prefix: string;
  number: number;
  name: string;
  date: string;
  customer: {
    id: string;
    identification: string;
    branch_office: number;
  };
  seller: number;
  total: number;
  balance: number;
  items: SiigoInvoiceItemResponse[];
  payments: SiigoPaymentResponse[];
  mail: {
    status: string;
    observations: string;
  };
  stamp: {
    status: string;
    cufe?: string;
  };
  metadata: {
    created: string;
  };
  public_url: string;
}

export interface SiigoInvoiceItemResponse {
  id: string;
  code: string;
  quantity: number;
  price: number;
  description: string;
  total: number;
}

export interface SiigoPaymentResponse {
  id: number;
  name: string;
  value: number;
  due_date?: string;
}

// Tipos para la petición a Siigo - Factura de Compra
export interface SiigoPurchaseInvoiceRequest {
  document: {
    id: number;
  };
  date: string;
  number?: number;
  supplier: {
    identification: string;
    branch_office: number;
  };
  cost_center?: number;
  provider_invoice?: {
    prefix?: string;
    number?: string;
  };
  currency?: {
    code: string;
    exchange_rate: number;
  };
  observations?: string;
  discount_type?: "Value" | "Percentage";
  supplier_by_item?: boolean;
  tax_included?: boolean;
  retentions?: number[];
  items: SiigoPurchaseItemRequest[];
  payments: SiigoPaymentRequest[];
}

// Tipos para la petición a Siigo - Factura de Venta (mantener para compatibilidad)
export interface SiigoInvoiceRequest {
  document: {
    id: number;
  };
  date: string;
  number?: number;
  customer: {
    identification: string;
    branch_office: number;
  };
  seller: number;
  stamp: {
    send: boolean;
  };
  mail: {
    send: boolean;
  };
  observations: string;
  items: SiigoInvoiceItemRequest[];
  payments: SiigoPaymentRequest[];
}

// Tipos para items de factura de compra
export interface SiigoPurchaseItemRequest {
  type: "Product" | "FixedAsset" | "Account";
  code: string;
  description?: string;
  quantity: number;
  price: number;
  discount?: number;
  supplier?: number;
  warehouse?: number;
  taxes?: {
    id: number;
  }[];
}

// Tipos para items de factura de venta (mantener para compatibilidad)
export interface SiigoInvoiceItemRequest {
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number;
  warehouse?: number;
  taxes?: {
    id: number;
    value?: number;
  }[];
}

export interface SiigoPaymentRequest {
  id: number;
  value: number;
  due_date?: string;
}

// Tipos para autenticación
export interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
}

export interface SiigoAuthRequest {
  username: string;
  access_key: string;
}

// Tipo simplificado para factura de compra
export interface SiigoPurchaseRequest {
  document: {
    id: number;
  };
  date: string;
  supplier: {
    identification: string;
    branch_office: number;
  };
  number?: number;
  cost_center?: number;
  observations?: string;
  items: SiigoInvoiceItemRequest[];
  payments: SiigoPaymentRequest[];
  additional_fields?: {
    warehouse?: string;
    prefix?: string;
  };
}

// Tipo para gastos/egresos
export interface SiigoExpenseRequest {
  document: {
    id: number;
  };
  date: string;
  supplier: {
    identification: string;
    branch_office: number;
  };
  category: string;
  description: string;
  amount: number;
  tax_included: boolean;
  cost_center?: number;
  observations?: string;
  payment: {
    id: number;
    value: number;
    due_date: string;
  };
}
