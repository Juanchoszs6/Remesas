// Tipos para el formulario de facturación
export interface InvoiceItem {
  id: string;
  type: "product" | "service" | "charge" | "discount";
  code: string;
  description: string;
  quantity: number;
  price: number;
  warehouse: string;
  hasIVA: boolean;
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
}

// Tipos para la respuesta de la API de Siigo
export interface SiigoResponse {
  success: boolean;
  data?: SiigoInvoiceResponse;
  error?: string;
  message: string;
}

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

// Tipos para la petición a Siigo
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

export interface SiigoInvoiceItemRequest {
  code: string;
  description: string;
  quantity: number;
  price: number;
  warehouse?: number;
  taxes: {
    id: number;
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
