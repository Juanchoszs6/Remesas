'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Filter, X, FileText, Calendar, User, DollarSign, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Disable SSR for this component to avoid hydration issues
const NoSSRWrapper = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // or return a loading state
  }
  
  return <>{children}</>;
};

interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  tax: {
    id: number;
    name: string;
    percentage: number;
    amount: number;
  };
}

interface InvoiceData {
  id: string;
  number: string;
  prefix: string;
  date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  currency: {
    code: string;
    exchange_rate: number;
  };
  supplier: {
    identification: string;
    name: string;
    phone: string;
    address: string;
  };
  items: InvoiceItem[];
  observations?: string;
  created_at: string;
  updated_at: string;
  document_type?: string;
  document_number?: string;
}

// This is a client component that will only be rendered on the client side
function AdvancedInvoiceSearch() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceData[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Cargar todas las facturas al montar el componente
  useEffect(() => {
    if (!mounted) return;
    
    const fetchAllInvoices = async () => {
      setIsLoadingInitial(true);
      setError(null);
      
      try {
        // Obtener las facturas directamente del endpoint que ya maneja la autenticación
        const response = await fetch('/api/siigo/get-all-purchases');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al cargar las facturas');
        }
        
        const data = await response.json();
        setInvoices(data);
        setFilteredInvoices(data);
        
        // Store in localStorage for offline access
        if (typeof window !== 'undefined') {
          localStorage.setItem('cachedInvoices', JSON.stringify({
            data,
            timestamp: new Date().getTime()
          }));
        }
        
      } catch (err) {
        console.error('Error al cargar facturas:', err);
        
        // Try to load from cache if available
        if (typeof window !== 'undefined') {
          const cachedData = localStorage.getItem('cachedInvoices');
          if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            // If cache is less than 1 hour old, use it
            if (Date.now() - timestamp < 60 * 60 * 1000) {
              setInvoices(data);
              setFilteredInvoices(data);
              toast.info('Mostrando datos en caché', {
                description: 'No se pudo conectar al servidor. Se están mostrando datos almacenados localmente.'
              });
              return;
            }
          }
        }
        
        setError('No se pudieron cargar las facturas. Intente de nuevo más tarde.');
      } finally {
        setIsLoadingInitial(false);
      }
    };
    
    fetchAllInvoices();
  }, []);

  // Filter invoices based on search term and filters
  useEffect(() => {
    if (!searchTerm.trim() && Object.values(filters).every(val => !val)) {
      setFilteredInvoices(invoices);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    
    const filtered = invoices.filter(invoice => {
      // Search term matching
      const matchesSearch = 
        (invoice.number && invoice.number.toLowerCase().includes(searchLower)) ||
        (invoice.prefix && `${invoice.prefix}-${invoice.number}`.toLowerCase().includes(searchLower)) ||
        (invoice.supplier?.name && invoice.supplier.name.toLowerCase().includes(searchLower)) ||
        (invoice.document_number && invoice.document_number.includes(searchTerm)) ||
        invoice.total.toString().includes(searchTerm);
      
      // Date filter - Handle date comparisons with proper timezone handling
      const invoiceDate = invoice.date ? new Date(invoice.date) : null;
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;
      
      // Set time to start/end of day for accurate date comparison
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);
      if (invoiceDate) invoiceDate.setHours(12, 0, 0, 0);
      
      const matchesDate = 
        (!startDate || (invoiceDate && invoiceDate >= startDate)) && 
        (!endDate || (invoiceDate && invoiceDate <= endDate));
      
      // Amount filter
      const minAmount = parseFloat(filters.minAmount) || 0;
      const maxAmount = parseFloat(filters.maxAmount) || Number.MAX_SAFE_INTEGER;
      const matchesAmount = invoice.total >= minAmount && invoice.total <= maxAmount;
      
      // Status filter
      const matchesStatus = !filters.status || invoice.status === filters.status;
      
      return matchesSearch && matchesDate && matchesAmount && matchesStatus;
    });
    
    setFilteredInvoices(filtered);
  }, [searchTerm, filters, invoices]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The search is handled by the useEffect above
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilters({
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      status: '',
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPP', { locale: es });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: selectedInvoice?.currency?.code || 'COP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
      active: { label: 'Activa', variant: 'default' },
      draft: { label: 'Borrador', variant: 'outline' },
      voided: { label: 'Anulada', variant: 'destructive' },
      deleted: { label: 'Eliminada', variant: 'destructive' },
      paid: { label: 'Pagada', variant: 'default' },
      pending: { label: 'Pendiente', variant: 'outline' },
      all: { label: 'Todas', variant: 'secondary' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'default' as const };
    
    return (
      <Badge variant={statusInfo.variant} className="capitalize">
        {statusInfo.label}
      </Badge>
    );
  };

  // Show loading state when not mounted or loading
  if (!mounted || isLoadingInitial) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando facturas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
    active: { label: 'Activa', variant: 'default' },
    draft: { label: 'Borrador', variant: 'outline' },
    voided: { label: 'Anulada', variant: 'destructive' },
    deleted: { label: 'Eliminada', variant: 'destructive' },
    paid: { label: 'Pagada', variant: 'default' },
    pending: { label: 'Pendiente', variant: 'outline' },
    all: { label: 'Todas', variant: 'secondary' },
  };
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          {showFilters ? 'Ocultar filtros' : 'Filtros'}
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número de factura, proveedor, documento o monto..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-1 block">Fecha desde</label>
                  <Input 
                    type="date" 
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Fecha hasta</label>
                  <Input 
                    type="date" 
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Monto mínimo</label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Monto máximo</label>
                  <Input 
                    type="number" 
                    placeholder="Sin límite"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Estado</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                  >
                    <option value="">Todos los estados</option>
                    <option value="active">Activa</option>
                    <option value="paid">Pagada</option>
                    <option value="pending">Pendiente</option>
                    <option value="voided">Anulada</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleResetFilters}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-xs mb-4">
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedInvoice}>Detalles</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </div>
              ) : error ? (
                <Alert variant="destructive" className="m-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No se encontraron facturas que coincidan con los criterios de búsqueda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setSelectedInvoice(invoice);
                        setActiveTab('details');
                      }}>
                        <TableCell className="font-medium">
                          {invoice.prefix ? `${invoice.prefix}-${invoice.number}` : invoice.number}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {invoice.supplier?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {formatDate(invoice.date)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.total)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="details">
          {selectedInvoice ? (
            <div className="space-y-6">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab('list')}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la lista
              </Button>
              
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        {selectedInvoice.document_type || 'Factura'} #{selectedInvoice.prefix ? `${selectedInvoice.prefix}-${selectedInvoice.number}` : selectedInvoice.number}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        ID: {selectedInvoice.id}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(selectedInvoice.status)}
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(selectedInvoice.date)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">Proveedor</h3>
                      <div className="space-y-1">
                        <p className="font-medium">{selectedInvoice.supplier?.name || 'N/A'}</p>
                        {selectedInvoice.supplier?.identification && (
                          <p className="text-sm text-muted-foreground">
                            {selectedInvoice.supplier.identification}
                          </p>
                        )}
                        {selectedInvoice.supplier?.phone && (
                          <p className="text-sm text-muted-foreground">
                            {selectedInvoice.supplier.phone}
                          </p>
                        )}
                        {selectedInvoice.supplier?.address && (
                          <p className="text-sm text-muted-foreground">
                            {selectedInvoice.supplier.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Información de Pago</h3>
                      <div className="space-y-1">
                        <p className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span>Impuestos:</span>
                          <span>{formatCurrency(selectedInvoice.tax)}</span>
                        </p>
                        <p className="flex justify-between font-semibold text-lg mt-2">
                          <span>Total:</span>
                          <span>{formatCurrency(selectedInvoice.total)}</span>
                        </p>
                        <p className={`flex justify-between text-sm ${selectedInvoice.balance > 0 ? 'text-destructive' : 'text-green-600'} font-medium`}>
                          <span>Saldo pendiente:</span>
                          <span>{formatCurrency(selectedInvoice.balance)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ítems de la Factura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-12 bg-muted/50 p-2 font-medium text-sm">
                      <div className="col-span-5">Descripción</div>
                      <div className="col-span-2 text-right">Cantidad</div>
                      <div className="col-span-2 text-right">Precio Unit.</div>
                      <div className="col-span-3 text-right">Total</div>
                    </div>
                    {selectedInvoice.items?.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 p-2 border-t text-sm">
                        <div className="col-span-5">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-xs text-muted-foreground">{item.code}</div>
                        </div>
                        <div className="col-span-2 text-right">{item.quantity}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item.price)}</div>
                        <div className="col-span-3 text-right font-medium">
                          {formatCurrency(item.total)}
                        </div>
                        {item.discount > 0 && (
                          <div className="col-span-10 text-right text-xs text-muted-foreground">
                            Descuento: {formatCurrency(item.discount)}
                          </div>
                        )}
                        <div className="col-span-2 text-right text-xs text-muted-foreground">
                          {item.tax ? `IVA ${item.tax.percentage}%` : 'Sin IVA'}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedInvoice.observations && (
                <Card>
                  <CardHeader>
                    <CardTitle>Observaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line">{selectedInvoice.observations}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Seleccione una factura para ver los detalles.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </NoSSRWrapper>
  );
};

// Export with dynamic import and SSR disabled
export default dynamic(() => Promise.resolve(AdvancedInvoiceSearch), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando búsqueda de facturas...</p>
      </div>
    </div>
  ),
});
