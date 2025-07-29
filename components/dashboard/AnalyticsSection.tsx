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
  
  // Ordenar facturas por fecha (más antigua a más reciente)
  const sortedInvoices = [...invoices].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const suppliers = new Map<string, SupplierData>();
  const monthlyStats = new Map<string, { amount: number; count: number; date: Date }>();
  const now = new Date();
  
  // Obtener el rango de los últimos 6 meses
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  
  // Inicializar los últimos 6 meses con valores en 0
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthKey = date.toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'short'
    });
    
    // Inicializar con valores en 0, manteniendo la fecha para ordenamiento
    monthlyStats.set(monthKey, { 
      amount: 0, 
      count: 0,
      date: new Date(date.getFullYear(), date.getMonth(), 1) // Primer día del mes para ordenamiento
    });
  }
  
  let totalAmount = 0;
  let totalInvoices = 0;
  const supplierNames = new Map<string, string>();
  
  // Procesar todas las facturas
  for (const invoice of sortedInvoices) {
    try {
      const amount = parseFloat(invoice.total?.toString() || '0');
      const supplierIdentification = invoice.supplier?.identification || 'UNKNOWN';
      const invoiceDate = new Date(invoice.date);
      
      // Obtener o crear el nombre del proveedor
      let supplierName = supplierNames.get(supplierIdentification);
      if (!supplierName) {
        supplierName = supplierIdentification === 'UNKNOWN' 
          ? 'Proveedor Desconocido' 
          : await getSupplierName(supplierIdentification);
        supplierNames.set(supplierIdentification, supplierName);
      }
      
      // Actualizar estadísticas generales
      totalAmount += amount;
      totalInvoices++;
      
      // Actualizar estadísticas de proveedores
      if (!suppliers.has(supplierIdentification)) {
        suppliers.set(supplierIdentification, {
          id: supplierIdentification,
          name: supplierName,
          identification: supplierIdentification,
          totalAmount: 0,
          invoiceCount: 0,
          invoices: [],
          isUnknown: supplierIdentification === 'UNKNOWN'
        });
      }
      
      const currentSupplier = suppliers.get(supplierIdentification)!;
      currentSupplier.totalAmount += amount;
      currentSupplier.invoiceCount++;
      currentSupplier.invoices.push(invoice);
      
      // Formatear la clave del mes para coincidir con las claves ya inicializadas
      const monthKey = invoiceDate.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'short'
      });
      
      // Procesar facturas de los últimos 6 meses para el gráfico
      const invoiceMonthStart = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1);
      if (invoiceMonthStart >= new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1)) {
        // Buscar la entrada correspondiente en monthlyStats
        for (const [key, data] of monthlyStats.entries()) {
          const statsDate = data.date;
          if (statsDate.getFullYear() === invoiceDate.getFullYear() && 
              statsDate.getMonth() === invoiceDate.getMonth()) {
            // Actualizar los datos del mes correspondiente
            data.amount += amount;
            data.count++;
            break;
          }
        }
      }
      
    } catch (error) {
      console.error('Error procesando factura:', invoice.id, error);
    }
  }
  
  // Convertir el mapa a array, mapear al formato esperado y ordenar por fecha
  const monthlyData = Array.from(monthlyStats.entries())
    .map(([month, data]) => ({
      month,
      amount: data.amount,
      count: data.count,
      date: data.date // Mantener la fecha para ordenamiento consistente
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, ...rest }) => rest); // Eliminar la fecha del objeto final
  
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

// Componente de Gráfico Mensual Mejorado
const MonthlyChart = ({ data }: { data: AnalyticsData['monthlyData'] }) => {
  // Obtener los últimos 6 meses con formato corto
  const now = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      full: date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short' }),
      short: date.toLocaleDateString('es-CO', { month: 'short' }).slice(0, 3)
    };
  });
  
  // Mapear los datos existentes para búsqueda rápida
  const dataMap = new Map(data.map(item => [item.month, item]));
  
  // Asegurar que tengamos los 6 meses, incluso sin datos
  const chartData = last6Months.map(({ full, short }) => ({
    month: full,
    shortMonth: short,
    amount: dataMap.get(full)?.amount || 0,
    count: dataMap.get(full)?.count || 0
  }));

  // Calcular el máximo para el eje Y (redondeado al millón más cercano)
  const maxAmount = Math.max(...chartData.map(item => item.amount), 0);
  const yMax = Math.ceil(maxAmount / 1000000) * 1000000;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Tendencia Mensual</CardTitle>
        <CardDescription className="text-sm">Evolución de facturación</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid vertical={false} stroke="#f5f5f5" />
              <XAxis 
                dataKey="shortMonth" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                padding={{ left: 15, right: 15 }}
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                domain={[0, yMax]}
                width={50}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(Number(value)), 
                  name === 'amount' ? 'Monto Total' : 'Facturas'
                ]}
                labelFormatter={(label) => `Mes: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  padding: '8px 12px',
                  fontSize: '13px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                labelStyle={{ fontWeight: 500, marginBottom: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                name="Monto Total"
                stroke="#3b82f6" 
                strokeWidth={2.5}
                dot={{
                  fill: '#3b82f6',
                  stroke: '#fff',
                  strokeWidth: 2,
                  r: 4,
                  strokeOpacity: 0.9
                }}
                activeDot={{ 
                  r: 6, 
                  stroke: '#fff', 
                  strokeWidth: 2,
                  fill: '#2563eb'
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

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
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            className="px-4"
            disabled
          >
            6 meses
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full">
        <div className="lg:col-span-2">
          <MonthlyChart data={analytics.monthlyData} />
        </div>
        
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Proveedores Principales</CardTitle>
            <CardDescription className="text-sm">Por monto facturado</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 pt-0 overflow-y-auto max-h-[360px]">
            {analytics.suppliers.length > 0 ? (
              <div className="space-y-3">
                {analytics.suppliers.map((supplier, index) => {
                  const displayName = supplier.name || `Proveedor ${supplier.identification}`;
                  const shortId = supplier.identification 
                    ? supplier.identification.slice(0, 8) + (supplier.identification.length > 8 ? '...' : '')
                    : 'Sin ID';
                  
                  const percentage = (supplier.totalAmount / analytics.totalAmount) * 100;
                  
                  return (
                    <div 
                      key={`${supplier.id}-${index}`} 
                      className="group p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      data-supplier-id={supplier.id}
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center mt-0.5">
                          <span className="text-blue-600 font-medium text-xs">{index + 1}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 
                              className="text-sm font-medium text-gray-900 truncate pr-2" 
                              title={displayName}
                            >
                              {displayName}
                            </h4>
                            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {formatCurrency(supplier.totalAmount)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {supplier.invoiceCount} factura{supplier.invoiceCount !== 1 ? 's' : ''}
                              </span>
                              {supplier.identification !== 'UNKNOWN' && supplier.identification && (
                                <span className="text-xs text-gray-500 hidden sm:inline-block">
                                  ID: {shortId}
                                </span>
                              )}
                              {supplier.isUnknown && (
                                <Badge 
                                  variant="outline" 
                                  className="text-2xs text-amber-600 border-amber-200 bg-amber-50 h-4 px-1.5"
                                >
                                  Sin identificar
                                </Badge>
                              )}
                            </div>
                            
                            <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <FileText className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No hay proveedores</p>
                <p className="text-xs text-gray-400 mt-1">Intenta con otro período</p>
              </div>
            )}
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