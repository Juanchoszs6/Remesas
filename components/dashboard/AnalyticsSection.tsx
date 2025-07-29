// components/dashboard/AnalyticsSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Types basados en la estructura de Siigo
interface SiigoInvoice {
  id: string;
  document: {
    id: number;
  };
  number: number;
  name: string;
  date: string;
  supplier: {
    id?: string;
    identification: string;
    branch_office: number;
  };
  cost_center?: number;
  provider_invoice?: {
    prefix: string;
    number: string;
  };
  discount_type: string;
  currency: {
    code: string;
    exchange_rate: number;
  };
  total: number;
  balance: number;
  observations?: string;
  items: Array<{
    type: string;
    id: string;
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount?: {
      percentage: number;
      value: number;
    };
    taxes: Array<{
      id: number;
      name: string;
      type: string;
      percentage: number;
      value: number;
    }>;
    total: number;
  }>;
  payments: Array<{
    id: number;
    name: string;
    value: number;
    due_date: string;
  }>;
  metadata: {
    created: string;
    last_updated: string | null;
  };
}

interface SupplierData {
  id: string;
  name: string;
  identification: string;
  totalAmount: number;
  invoiceCount: number;
  invoices: SiigoInvoice[];
  isUnknown?: boolean;
}

interface AnalyticsData {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  monthlyGrowth: number;
  suppliers: SupplierData[];
  monthlyData: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

// Helper functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Función para obtener el nombre del proveedor
const getSupplierName = async (identification: string): Promise<string> => {
  try {
    return `Proveedor ${identification}`;
  } catch (error) {
    console.warn('No se pudo obtener el nombre del proveedor:', error);
    return `Proveedor ${identification}`;
  }
};

// Función para transformar datos de facturas de Siigo
const transformSiigoInvoices = async (invoices: SiigoInvoice[]): Promise<AnalyticsData> => {
  if (!invoices || invoices.length === 0) {
    return {
      totalInvoices: 0,
      totalAmount: 0,
      averageAmount: 0,
      monthlyGrowth: 0,
      suppliers: [],
      monthlyData: [],
      categoryBreakdown: []
    };
  }
  
  const suppliers = new Map<string, SupplierData>();
  const monthlyStats = new Map<string, { amount: number; count: number }>();
  
  let totalAmount = 0;
  let totalInvoices = 0;
  
  const supplierNames = new Map<string, string>();
  
  for (const invoice of invoices) {
    try {
      const amount = parseFloat(invoice.total?.toString() || '0');
      const supplierIdentification = invoice.supplier?.identification || 'UNKNOWN';
      
      let supplierName = supplierNames.get(supplierIdentification);
      if (!supplierName) {
        if (supplierIdentification === 'UNKNOWN') {
          supplierName = 'Proveedor Desconocido';
        } else {
          supplierName = await getSupplierName(supplierIdentification);
        }
        supplierNames.set(supplierIdentification, supplierName);
      }
      
      const supplierId = supplierIdentification;
      
      const invoiceDate = new Date(invoice.date);
      const monthKey = invoiceDate.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'short' 
      });
      
      totalAmount += amount;
      totalInvoices++;
      
      if (!suppliers.has(supplierId)) {
        suppliers.set(supplierId, {
          id: supplierId,
          name: supplierName,
          identification: supplierIdentification,
          totalAmount: 0,
          invoiceCount: 0,
          invoices: [],
          isUnknown: supplierIdentification === 'UNKNOWN'
        });
      }
      
      const supplier = suppliers.get(supplierId)!;
      supplier.totalAmount += amount;
      supplier.invoiceCount++;
      supplier.invoices.push(invoice);
      
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, { amount: 0, count: 0 });
      }
      const monthData = monthlyStats.get(monthKey)!;
      monthData.amount += amount;
      monthData.count++;
      
    } catch (error) {
      console.error('Error procesando factura:', invoice.id, error);
    }
  }
  
  const monthlyData = Array.from(monthlyStats.entries())
    .map(([month, data]) => ({
      month,
      amount: data.amount,
      count: data.count
    }))
    .sort((a, b) => {
      const dateA = new Date(`01 ${a.month}`);
      const dateB = new Date(`01 ${b.month}`);
      return dateA.getTime() - dateB.getTime();
    });
  
  const suppliersArray = Array.from(suppliers.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 15);
  
  const monthlyGrowth = monthlyData.length >= 2 
    ? ((monthlyData[monthlyData.length - 1].amount - monthlyData[monthlyData.length - 2].amount) / monthlyData[monthlyData.length - 2].amount) * 100
    : 0;
  
  const knownSuppliersAmount = suppliersArray
    .filter(s => !s.isUnknown)
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const unknownSuppliersAmount = suppliersArray
    .filter(s => s.isUnknown)
    .reduce((sum, s) => sum + s.totalAmount, 0);
  
  const categoryBreakdown = [
    {
      category: 'Proveedores Identificados',
      amount: knownSuppliersAmount,
      percentage: totalAmount > 0 ? (knownSuppliersAmount / totalAmount) * 100 : 0
    },
    {
      category: 'Proveedores Desconocidos',
      amount: unknownSuppliersAmount,
      percentage: totalAmount > 0 ? (unknownSuppliersAmount / totalAmount) * 100 : 0
    }
  ];
  
  return {
    totalInvoices,
    totalAmount,
    averageAmount: totalInvoices > 0 ? totalAmount / totalInvoices : 0,
    monthlyGrowth,
    suppliers: suppliersArray,
    monthlyData,
    categoryBreakdown
  };
};

// Componente de Tarjetas de Estadísticas
const StatsCards = ({ analytics, period }: { analytics: AnalyticsData; period: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{analytics.totalInvoices.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {period === '1m' ? 'En el último mes' : `En los últimos ${period.replace('m', ' meses').replace('y', ' año')}`}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(analytics.totalAmount)}</div>
        <p className="text-xs text-muted-foreground">
          {period === '1m' ? 'En el último mes' : `En los últimos ${period.replace('m', ' meses').replace('y', ' año')}`}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Promedio por Factura</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(analytics.averageAmount)}</div>
        <p className="text-xs text-muted-foreground">
          {analytics.monthlyGrowth > 0 ? (
            <span className="text-green-500">
              {formatPercentage(analytics.monthlyGrowth)} vs período anterior
            </span>
          ) : analytics.monthlyGrowth < 0 ? (
            <span className="text-red-500">
              {formatPercentage(analytics.monthlyGrowth)} vs período anterior
            </span>
          ) : (
            <span className="text-gray-500">Sin cambios vs período anterior</span>
          )}
        </p>
      </CardContent>
    </Card>
  </div>
);

// Componente de Gráfico Mensual
const MonthlyChart = ({ data }: { data: AnalyticsData['monthlyData'] }) => (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle>Tendencia Mensual</CardTitle>
      <CardDescription>Evolución de facturación por mes</CardDescription>
    </CardHeader>
    <CardContent className="h-80">
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Monto']}
              labelFormatter={(label) => `Mes: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="amount" 
              name="Monto Total" 
              stroke="#0088FE" 
              strokeWidth={3}
              dot={{ fill: '#0088FE', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#0088FE', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No hay datos disponibles para el gráfico</p>
            <p className="text-xs mt-1">Verifica la conexión con Siigo</p>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

// Componente Principal
export default function AnalyticsSection() {
  const [period, setPeriod] = useState('6m');
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = (period: string) => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1m':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Iniciando solicitud de datos de compras...');

      // Obtener el rango de fechas
      const { start, end } = getDateRange(period);
      
      console.log('Solicitando datos a /api/siigo/get-purchases...');
      const response = await fetch(`/api/siigo/get-purchases?start_date=${start}&end_date=${end}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store' // Evitar caché
      });
      
      console.log('Respuesta del servidor:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error en la respuesta del servidor:', errorData);
        throw new Error(errorData.error || 'Error al obtener los datos de compras');
      }
      
      const responseData = await response.json();
      console.log('Datos de compras recibidos:', responseData);
      
      let invoices: SiigoInvoice[] = [];
      
      if (Array.isArray(responseData)) {
        // Si la respuesta es un array directo
        invoices = responseData;
      } else if (responseData && responseData.results && Array.isArray(responseData.results)) {
        // Si la respuesta tiene un campo 'results' que es un array
        invoices = responseData.results;
      } else if (responseData && responseData.data && Array.isArray(responseData.data)) {
        // Si la respuesta tiene un campo 'data' que es un array
        invoices = responseData.data;
      } else {
        console.warn('Formato de respuesta inesperado de la API de Siigo:', responseData);
        throw new Error('Formato de respuesta inesperado de la API de Siigo');
      }

      // Verificar que tenemos facturas
      if (!invoices.length) {
        console.warn('No se encontraron facturas en el rango de fechas seleccionado');
        setAnalytics({
          totalInvoices: 0,
          totalAmount: 0,
          averageAmount: 0,
          monthlyGrowth: 0,
          suppliers: [],
          monthlyData: [],
          categoryBreakdown: []
        });
        setError('No se encontraron facturas en el rango de fechas seleccionado');
        return;
      }

      console.log(`Procesando ${invoices.length} facturas...`);
      
      // Procesar las facturas para obtener las métricas necesarias
      const analyticsData = await transformSiigoInvoices(invoices);
      
      setAnalytics(analyticsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al conectar con Siigo: ${errorMessage}`);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  if (isLoading) {
    return (
      <div className="col-span-3 mt-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-64" />
          <div className="animate-spin">
            <RefreshCw className="h-4 w-4" />
          </div>
          <span className="text-sm text-muted-foreground">Conectando con Siigo...</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="col-span-3 mt-6">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Error de Conexión con Siigo</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {error || 'No se pudieron cargar los datos de facturas desde Siigo'}
            </p>
            <div className="text-xs text-gray-500 mb-4">
              Endpoint: <code>/api/siigo/auth</code> y <code>https://api.siigo.com/v1/purchases</code>
            </div>
            <div className="flex space-x-2">
              <Button onClick={fetchAnalytics} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar Conexión
              </Button>
              <Button onClick={() => window.location.reload()} variant="default">
                Recargar Página
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="col-span-3 mt-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Análisis de Facturación</h2>
          <p className="text-muted-foreground">
            Datos de facturas de compra desde Siigo API
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={fetchAnalytics}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {['1m', '3m', '6m', '1y'].map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === '1m' ? '1 mes' : p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : '1 año'}
            </Button>
          ))}
        </div>
      </div>

      <StatsCards analytics={analytics} period={period} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MonthlyChart data={analytics.monthlyData} />
        
        <Card>
          <CardHeader>
            <CardTitle>Proveedores Principales</CardTitle>
            <CardDescription>Por monto facturado en el período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.suppliers.length > 0 ? (
                analytics.suppliers.map((supplier, index) => {
                  const displayName = supplier.name || `Proveedor ${supplier.identification}`;
                  const shortId = supplier.identification 
                    ? supplier.identification.slice(0, 8) + (supplier.identification.length > 8 ? '...' : '')
                    : 'Sin ID';
                  
                  return (
                    <div key={`${supplier.id}-${index}`} className="flex items-center justify-between py-3 border-b last:border-b-0">
                      <div className="space-y-1 min-w-0 flex-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium leading-tight truncate" title={displayName}>
                            {displayName}
                          </p>
                          {supplier.isUnknown && (
                            <Badge variant="secondary" className="text-xs">
                              Desconocido
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">
                            {supplier.invoiceCount} factura{supplier.invoiceCount !== 1 ? 's' : ''}
                          </span>
                          {supplier.identification !== 'UNKNOWN' && (
                            <span className="text-gray-500">ID: {shortId}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right min-w-[120px]">
                        <p className="font-medium text-sm">{formatCurrency(supplier.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {((supplier.totalAmount / analytics.totalAmount) * 100).toFixed(1)}% del total
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay proveedores para mostrar</p>
                  <p className="text-xs">Verifica el período seleccionado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {analytics && (
        <Card className="border-dashed border-gray-300">
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Información de Debug
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
              {JSON.stringify({
                totalInvoices: analytics.totalInvoices,
                totalAmount: analytics.totalAmount,
                suppliersCount: analytics.suppliers.length,
                monthlyDataPoints: analytics.monthlyData.length,
                periodo: period,
                ultimaActualizacion: new Date().toLocaleString('es-CO')
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}