'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChartData {
  name: string;
  facturas: number;
  monto: number;
  month: number;
  year: number;
  fullDate: string;
}

interface LoadingProgress {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}

export default function PurchaseAnalyticsChart() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFacturas, setTotalFacturas] = useState(0);
  const [totalMonto, setTotalMonto] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ currentPage: 0, totalPages: 0, totalRecords: 0 });
  
  // Obtener años disponibles en los datos
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allInvoices.forEach(invoice => {
      const dateStr = invoice.date || invoice.created || invoice.creation_date || invoice.created_at;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });
    
    // Si no hay facturas, mostrar años del rango actual
    if (years.size === 0) {
      const currentYear = new Date().getFullYear();
      for (let i = currentYear - 2; i <= currentYear; i++) {
        years.add(i);
      }
    }
    
    return Array.from(years).sort((a, b) => b - a);
  }, [allInvoices]);

  // Función para cargar todas las páginas de datos
  const fetchAllPages = async (baseUrl: string, maxRetries: number = 3): Promise<any[]> => {
    let allData: any[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let hasNextPage = true;
    let retryCount = 0;
    
    while (hasNextPage && currentPage <= totalPages) {
      try {
        console.log(`Cargando página ${currentPage}...`);
        
        const url = baseUrl.includes('?') 
          ? `${baseUrl}&page=${currentPage}&per_page=100` 
          : `${baseUrl}?page=${currentPage}&per_page=100`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

        let response;
        try {
          response = await fetch(url, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error: unknown) {
          clearTimeout(timeoutId);
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              throw new Error('La solicitud excedió el tiempo de espera de 30 segundos');
            }
          }
          throw error;
        }
        
        const responseData = await response.json();
        
        // Extraer datos y metadatos de paginación
        let pageData = [];
        let paginationInfo = null;
        
        if (Array.isArray(responseData)) {
          pageData = responseData;
        } else if (responseData.results && Array.isArray(responseData.results)) {
          pageData = responseData.results;
          paginationInfo = responseData.pagination || responseData.meta || responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          pageData = responseData.data;
          paginationInfo = responseData.pagination || responseData.meta || responseData;
        } else if (typeof responseData === 'object' && responseData !== null) {
          const possibleArrayProps = ['invoices', 'items', 'purchases', 'documents'];
          for (const prop of possibleArrayProps) {
            if (Array.isArray(responseData[prop])) {
              pageData = responseData[prop];
              break;
            }
          }
          paginationInfo = responseData.pagination || responseData.meta || responseData;
        }
        
        // Actualizar información de paginación
        if (paginationInfo) {
          totalPages = paginationInfo.total_pages || paginationInfo.last_page || paginationInfo.totalPages || totalPages;
          hasNextPage = paginationInfo.has_next_page || paginationInfo.hasNextPage || currentPage < totalPages;
          
          setLoadingProgress({
            currentPage,
            totalPages,
            totalRecords: allData.length + pageData.length
          });
        }
        
        // Si no hay datos en esta página, probablemente hemos llegado al final
        if (pageData.length === 0) {
          hasNextPage = false;
        } else {
          allData = [...allData, ...pageData];
          console.log(`Página ${currentPage} cargada: ${pageData.length} registros. Total acumulado: ${allData.length}`);
        }
        
        currentPage++;
        retryCount = 0; // Reset retry count on success
        
        // Si no tenemos información de paginación y es la primera página, asumir que solo hay una página
        if (currentPage === 2 && !paginationInfo && pageData.length < 100) {
          hasNextPage = false;
        }
        
        // Pequeña pausa entre requests para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error cargando página ${currentPage}:`, error);
        
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`Reintentando página ${currentPage} (intento ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Backoff exponencial
        } else {
          console.error(`Error persistente en página ${currentPage}, continuando con siguiente página`);
          currentPage++;
          retryCount = 0;
        }
      }
    }
    
    console.log(`Carga completa: ${allData.length} registros totales en ${currentPage - 1} páginas`);
    return allData;
  };

  const fetchPurchaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadingProgress({ currentPage: 0, totalPages: 0, totalRecords: 0 });
      
      console.log(`Iniciando carga de datos para el año ${selectedYear}`);
      
      // Primero intentamos cargar todos los datos del año seleccionado
      let invoicesForYear: any[] = [];
      
      try {
        console.log(`Intentando cargar datos para el año ${selectedYear}...`);
        invoicesForYear = await fetchAllPages(`/api/siigo/get-purchases?get_all_pages=true&year=${selectedYear}`);
        console.log(`Datos cargados exitosamente: ${invoicesForYear.length} facturas para ${selectedYear}`);
      } catch (error) {
        console.warn(`Error cargando datos para ${selectedYear}:`, error);
        
        // Si falla, intentamos cargar mes por mes
        console.log(`Intentando cargar mes por mes para ${selectedYear}...`);
        const monthlyPromises = [];
        
        for (let month = 1; month <= 12; month++) {
          monthlyPromises.push(
            fetchAllPages(`/api/siigo/get-purchases?get_all_pages=true&year=${selectedYear}&month=${month}`)
              .then(monthData => {
                console.log(`Mes ${month}/${selectedYear}: ${monthData.length} facturas`);
                return monthData;
              })
              .catch(err => {
                console.warn(`Error cargando mes ${month}:`, err);
                return [];
              })
          );
          
          // Pequeña pausa entre solicitudes
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Esperar a que todas las solicitudes de mes finalicen
        const monthlyResults = await Promise.all(monthlyPromises);
        invoicesForYear = monthlyResults.flat();
      }
      
      // Si no hay datos, mostramos un mensaje pero continuamos
      if (invoicesForYear.length === 0) {
        console.warn(`No se encontraron facturas para el año ${selectedYear}`);
        setError(`No se encontraron facturas para el año ${selectedYear}`);
      }
      
      // Actualizar el estado con las facturas del año
      setAllInvoices(prevInvoices => {
        // Mantener solo las facturas de otros años para no perderlas
        const otherYearInvoices = prevInvoices.filter(inv => {
          const dateStr = inv.date || inv.created || inv.creation_date || inv.created_at;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return !isNaN(date.getTime()) && date.getFullYear() !== selectedYear;
        });
        return [...otherYearInvoices, ...invoicesForYear];
      });
      
      // Procesar los datos para el año seleccionado
      console.log(`Procesando ${invoicesForYear.length} facturas para ${selectedYear}...`);
      const monthlyData = processMonthlyData(invoicesForYear);
      
      // Asegurarnos de que siempre tengamos 12 meses
      const completeMonthlyData = generateEmptyYearData(selectedYear).map(monthData => {
        const existingMonth = monthlyData.find(m => m.month === monthData.month);
        return existingMonth || monthData;
      });
      
      // Ordenar por mes
      completeMonthlyData.sort((a, b) => a.month - b.month);
      
      // Actualizar el estado
      setChartData(completeMonthlyData);
      
      // Calcular totales
      const { totalInvoices, totalAmount } = calculateTotals(completeMonthlyData);
      setTotalFacturas(totalInvoices);
      setTotalMonto(totalAmount);
      
      console.log(`Procesamiento completado para ${selectedYear} - Facturas: ${totalInvoices}, Monto total: ${totalAmount}`);
      
    } catch (err) {
      console.error('Error en fetchPurchaseData:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar los datos';
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
      
      // Mostrar datos vacíos en caso de error
      const emptyData = generateEmptyYearData(selectedYear);
      setChartData(emptyData);
      setTotalFacturas(0);
      setTotalMonto(0);
    } finally {
      setIsLoading(false);
      setLoadingProgress({ currentPage: 0, totalPages: 0, totalRecords: 0 });
    }
  }, [selectedYear]);

  // Efecto para cargar datos cuando cambia el año seleccionado
  useEffect(() => {
    fetchPurchaseData();
  }, [selectedYear]);

  // Generar datos para los 12 meses de un año específico
  const generateEmptyYearData = (year: number): ChartData[] => {
    const shortMonthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    return shortMonthNames.map((name, index) => ({
      name,
      facturas: 0,
      monto: 0,
      month: index,
      year: year,
      fullDate: `${year}-${String(index + 1).padStart(2, '0')}`
    }));
  };

  // Procesar datos mensuales
  const processMonthlyData = (invoices: any[]): ChartData[] => {
    console.log(`Procesando ${invoices.length} facturas para el año ${selectedYear}`);
    
    if (!Array.isArray(invoices)) {
      console.error('Se esperaba un array de facturas');
      return generateEmptyYearData(selectedYear);
    }
    
    // Inicializar contadores por mes
    const monthlyStats = Array(12).fill(null).map((_, index) => ({
      month: index,
      facturas: 0,
      monto: 0,
      facturasDetalle: [] as any[]
    }));
    
    // Procesar cada factura
    let facturasValidas = 0;
    let facturasInvalidas = 0;
    
    invoices.forEach((invoice, index) => {
      try {
        if (!invoice) {
          facturasInvalidas++;
          return;
        }
        
        // Obtener la fecha de la factura con múltiples intentos
        const dateStr = invoice.date || invoice.created || invoice.creation_date || invoice.created_at || invoice.issue_date;
        if (!dateStr) {
          console.warn('Factura sin fecha válida:', { 
            id: invoice.id || invoice.number || index,
            campos_disponibles: Object.keys(invoice).filter(key => key.toLowerCase().includes('date') || key.toLowerCase().includes('created'))
          });
          facturasInvalidas++;
          return;
        }
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn('Fecha inválida:', { dateStr, id: invoice.id || invoice.number || index });
          facturasInvalidas++;
          return;
        }
        
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Verificar año
        if (year !== selectedYear) {
          return; // No contar como inválida, simplemente no es del año
        }
        
        // Obtener el monto con múltiples intentos
        let amount = 0;
        if (typeof invoice.total === 'number' && invoice.total > 0) {
          amount = invoice.total;
        } else if (typeof invoice.amount === 'number' && invoice.amount > 0) {
          amount = invoice.amount;
        } else if (typeof invoice.value === 'number' && invoice.value > 0) {
          amount = invoice.value;
        } else if (typeof invoice.total === 'string') {
          amount = parseFloat(invoice.total.replace(/[^\d.-]/g, '')) || 0;
        } else if (typeof invoice.amount === 'string') {
          amount = parseFloat(invoice.amount.replace(/[^\d.-]/g, '')) || 0;
        } else if (Array.isArray(invoice.payments) && invoice.payments.length > 0) {
          amount = invoice.payments.reduce((sum: number, payment: any) => {
            const paymentValue = parseFloat(payment.value) || parseFloat(payment.amount) || 0;
            return sum + paymentValue;
          }, 0);
        } else if (Array.isArray(invoice.items) && invoice.items.length > 0) {
          amount = invoice.items.reduce((sum: number, item: any) => {
            const itemTotal = parseFloat(item.total) || parseFloat(item.amount) || (parseFloat(item.quantity || 1) * parseFloat(item.price || 0));
            return sum + itemTotal;
          }, 0);
        }
        
        // Actualizar estadísticas del mes
        if (month >= 0 && month < 12) {
          monthlyStats[month].facturas += 1;
          monthlyStats[month].monto += Math.max(0, amount);
          monthlyStats[month].facturasDetalle.push({
            id: invoice.id || invoice.number,
            date: dateStr,
            amount: amount
          });
          facturasValidas++;
        }
        
      } catch (error) {
        console.error(`Error procesando factura ${index}:`, error);
        facturasInvalidas++;
      }
    });
    
    console.log(`Procesamiento completado: ${facturasValidas} válidas, ${facturasInvalidas} inválidas`);
    
    // Convertir a formato ChartData
    const shortMonthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const chartData = monthlyStats.map((monthData, index) => ({
      name: shortMonthNames[index],
      facturas: monthData.facturas,
      monto: monthData.monto,
      month: index,
      year: selectedYear,
      fullDate: `${selectedYear}-${String(index + 1).padStart(2, '0')}`
    }));
    
    // Log detallado por mes
    console.log('=== RESUMEN POR MES ===');
    chartData.forEach(month => {
      if (month.facturas > 0) {
        console.log(`${month.name} ${selectedYear}: ${month.facturas} facturas, ${formatCurrency(month.monto)}`);
      }
    });
    
    return chartData;
  };
  
  // Calcular totales
  const calculateTotals = (data: ChartData[]) => {
    return data.reduce(
      (totals, month) => ({
        totalInvoices: totals.totalInvoices + month.facturas,
        totalAmount: totals.totalAmount + month.monto
      }),
      { totalInvoices: 0, totalAmount: 0 }
    );
  };
  
  // Formatear moneda
  const formatCurrency = (value: number): string => {
    if (isNaN(value) || value === 0) return '$0';
    
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Render loading state con progreso
  if (isLoading) {
    return (
      <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-4" />
          
          {loadingProgress.totalPages > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Cargando página {loadingProgress.currentPage} de {loadingProgress.totalPages}</span>
                <span>{loadingProgress.totalRecords} registros cargados</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (loadingProgress.currentPage / loadingProgress.totalPages) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-red-800">Error al cargar datos</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex space-x-2">
          <button 
            onClick={fetchPurchaseData}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  // Colores personalizados
  const colors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    background: '#ffffff',
    text: '#1e293b',
    grid: '#e2e8f0',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    barGradientStart: '#3b82f6',
    barGradientEnd: '#1d4ed8',
    barHover: '#2563eb',
    axis: '#6b7280',
    tooltipBorder: '#e5e7eb'
  };
  
  // Manejar cambio de año
  const handleYearChange = (increment: number) => {
    const newYear = selectedYear + increment;
    if (newYear >= 2020 && newYear <= new Date().getFullYear() + 1) {
      setSelectedYear(newYear);
    }
  };

  // Componente personalizado para el tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-md bg-white p-4 shadow-lg ring-1 ring-gray-200">
          <p className="font-medium text-gray-900">
            {format(new Date(selectedYear, data.month, 1), 'MMMM yyyy', { locale: es })}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{data.facturas.toLocaleString('es-ES')}</span> facturas
          </p>
          <p className="text-lg font-semibold text-blue-600">
            {formatCurrency(data.monto)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Evolución Anual de Compras</h3>
          <p className="text-sm text-gray-500">Total facturado por mes - {selectedYear}</p>
          <p className="text-xs text-gray-400">
            {allInvoices.length} facturas totales cargadas
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleYearChange(-1)}
            disabled={selectedYear <= 2020}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="w-20 text-center font-medium">
            {selectedYear}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleYearChange(1)}
            disabled={selectedYear >= new Date().getFullYear()}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-4 pt-0">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-500">Total Anual</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalMonto)}
            </p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-500">Total Facturas</p>
            <p className="text-2xl font-bold text-gray-800">
              {totalFacturas.toLocaleString('es-ES')}
            </p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-500">Promedio Mensual</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalMonto / 12)}
            </p>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              barSize={24}
              barCategoryGap="6%"
              barGap={1}
            >
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.barGradientStart} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={colors.barGradientEnd} stopOpacity={0.8} />
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                vertical={false} 
                stroke={colors.grid}
                strokeDasharray="3 3"
              />
              
              <XAxis 
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.axis, fontSize: 11, fontWeight: 500 }}
                height={30}
                tickMargin={8}
              />
              
              <YAxis 
                domain={[0, 'dataMax']}
                tickFormatter={(value) => value > 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000).toFixed(0)}K`}
                tick={{ fill: colors.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={65}
                tickCount={5}
              />
              
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              
              <Bar 
                dataKey="monto"
                radius={[4, 4, 0, 0]}
                fill="url(#barGradient)"
              />
              
              <Legend 
                verticalAlign="top"
                height={36}
                formatter={() => (
                  <span className="text-sm font-medium text-gray-600">
                    Monto Facturado
                  </span>
                )}
              />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-2 flex justify-center text-xs text-gray-500">
            <p>Análisis completo de compras mensuales para {selectedYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}