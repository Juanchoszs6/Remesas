import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

interface InvoiceAnalytics {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  monthlyGrowth: number;
  topSuppliers: Array<{
    name: string;
    identification: string;
    totalAmount: number;
    invoiceCount: number;
  }>;
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
  recentInvoices: Array<{
    id: string;
    date: string;
    supplier: string;
    amount: number;
    status: 'success' | 'pending' | 'error';
    type: 'purchase' | 'expense';
  }>;
}

type PeriodType = '1m' | '3m' | '6m' | '1y';

const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: '1m', label: 'Último mes' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Último año' }
];

const STATUS_COLORS = {
  success: 'bg-green-500',
  pending: 'bg-yellow-500',
  error: 'bg-red-500'
} as const;

export default function TestAnalyticsPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('6m');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const validatePeriod = (period: string): period is PeriodType => {
    return (['1m', '3m', '6m', '1y'] as const).includes(period as PeriodType);
  };

  const validateAnalyticsData = (data: any): data is InvoiceAnalytics => {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.totalInvoices === 'number' &&
      typeof data.totalAmount === 'number' &&
      typeof data.averageAmount === 'number' &&
      typeof data.monthlyGrowth === 'number' &&
      Array.isArray(data.topSuppliers) &&
      Array.isArray(data.monthlyData) &&
      Array.isArray(data.categoryBreakdown) &&
      Array.isArray(data.recentInvoices)
    );
  };

  const loadAnalytics = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Cargando analytics para periodo: ${selectedPeriod}`);
      
      // Validar que el periodo sea válido
      if (!validatePeriod(selectedPeriod)) {
        throw new Error('Periodo no válido');
      }
      
      const response = await fetch(`/api/siigo/invoices/analytics?periodo=${selectedPeriod}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error al cargar datos: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage} - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validar que la respuesta tenga la estructura esperada
      if (!validateAnalyticsData(data)) {
        throw new Error('Formato de respuesta inválido');
      }
      
      setAnalytics(data);
      toast.success('Datos cargados exitosamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar datos';
      console.error('Error al cargar analytics:', error);
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const newPeriod = event.target.value;
    if (validatePeriod(newPeriod)) {
      setSelectedPeriod(newPeriod);
    }
  };

  const handleBackToDashboard = (): void => {
    router.push('/dashboard');
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-CO');
  };

  const getMaxMonthlyAmount = (monthlyData: InvoiceAnalytics['monthlyData']): number => {
    return Math.max(...monthlyData.map(m => m.amount));
  };

  const calculateProgressValue = (amount: number, maxAmount: number): number => {
    return maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cargando Analytics</h3>
              <p className="text-gray-600">Obteniendo datos desde SIIGO...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No hay datos disponibles</p>
            <Button onClick={loadAnalytics} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Cargar datos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const maxMonthlyAmount = getMaxMonthlyAmount(analytics.monthlyData);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Dashboard</span>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-2xl font-bold">Test de Analytics SIIGO</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              className="border rounded px-3 py-1 text-sm bg-white"
              disabled={isLoading}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalytics}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Cargando...' : 'Actualizar'}</span>
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Resumen de datos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Facturado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${formatCurrency(analytics.totalAmount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Facturas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalInvoices}</div>
                <p className="text-xs text-muted-foreground">Facturas procesadas</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Promedio por Factura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${formatCurrency(analytics.averageAmount)}
                </div>
                <p className="text-xs text-muted-foreground">Valor promedio</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Proveedores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.topSuppliers.length}</div>
                <p className="text-xs text-muted-foreground">Proveedores activos</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Datos detallados */}
          <Tabs defaultValue="monthly" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="monthly">Tendencia Mensual</TabsTrigger>
              <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
              <TabsTrigger value="recent">Facturas Recientes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia Mensual</CardTitle>
                  <CardDescription>Evolución de facturas por mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.monthlyData.map((month, index) => (
                      <div key={`month-${index}-${month.month}`} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 text-sm font-medium">{month.month}</div>
                          <div className="flex-1">
                            <Progress 
                              value={calculateProgressValue(month.amount, maxMonthlyAmount)} 
                              className="h-2"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            ${formatCurrency(month.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {month.count} facturas
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="suppliers">
              <Card>
                <CardHeader>
                  <CardTitle>Top Proveedores</CardTitle>
                  <CardDescription>Proveedores con mayor volumen de facturación</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.topSuppliers.map((supplier, index) => (
                      <div key={`supplier-${index}-${supplier.identification}`} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-sm text-gray-500">{supplier.identification}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${formatCurrency(supplier.totalAmount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {supplier.invoiceCount} facturas
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="categories">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis por Categorías</CardTitle>
                  <CardDescription>Distribución de gastos por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.categoryBreakdown.map((category, index) => (
                      <div key={`category-${index}-${category.category}`} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{category.category}</span>
                          <span className="text-sm text-gray-500">{category.percentage}%</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Progress value={category.percentage} className="flex-1" />
                          <span className="text-sm font-medium min-w-[100px] text-right">
                            ${formatCurrency(category.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="recent">
              <Card>
                <CardHeader>
                  <CardTitle>Facturas Recientes</CardTitle>
                  <CardDescription>Últimas facturas procesadas en SIIGO</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.recentInvoices.map((invoice, index) => (
                      <div key={`invoice-${index}-${invoice.id}`} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[invoice.status]}`}></div>
                          <div>
                            <div className="font-medium">{invoice.id}</div>
                            <div className="text-sm text-gray-500">{invoice.supplier}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${formatCurrency(invoice.amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {invoice.date} • {invoice.type === 'purchase' ? 'Compra' : 'Gasto'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Datos JSON */}
          <Card>
            <CardHeader>
              <CardTitle>Datos JSON</CardTitle>
              <CardDescription>Respuesta completa de la API</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(analytics, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}