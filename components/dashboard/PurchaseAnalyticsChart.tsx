'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChartData {
  name: string;
  facturas: number;
  monto: number;
  month: number;
  year: number;
}

export default function PurchaseAnalyticsChart() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFacturas, setTotalFacturas] = useState(0);
  const [totalMonto, setTotalMonto] = useState(0);

  const fetchPurchaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/siigo/get-purchases?get_all_pages=true', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      // Verificar la estructura de la respuesta
      if (!responseData) {
        throw new Error('La respuesta de la API está vacía');
      }
      
      // Extraer los resultados de la respuesta
      let invoices = [];
      if (Array.isArray(responseData)) {
        invoices = responseData;
      } else if (responseData.results && Array.isArray(responseData.results)) {
        invoices = responseData.results;
      } else if (responseData.data && Array.isArray(responseData.data)) {
        invoices = responseData.data;
      } else if (typeof responseData === 'object' && responseData !== null) {
        // Si es un objeto con datos, intentar extraer las facturas
        const possibleArrayProps = ['invoices', 'items', 'purchases'];
        for (const prop of possibleArrayProps) {
          if (Array.isArray(responseData[prop])) {
            invoices = responseData[prop];
            break;
          }
        }
      }
      
      if (!invoices.length) {
        console.warn('No se encontraron facturas en la respuesta:', responseData);
        setError('No se encontraron datos de facturas');
        return;
      }
      
      const monthlyData = processMonthlyData(invoices);
      setChartData(monthlyData);
      
      // Calcular totales
      const { totalInvoices, totalAmount } = calculateTotals(monthlyData);
      setTotalFacturas(totalInvoices);
      setTotalMonto(totalAmount);
      
    } catch (err) {
      console.error('Error fetching purchase data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar los datos';
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efecto para cargar datos
  useEffect(() => {
    fetchPurchaseData();
  }, [fetchPurchaseData]);

  // Generar datos para los 12 meses del año actual
  const generateEmptyYearData = (): ChartData[] => {
    if (typeof window === 'undefined') return [];
    const currentYear = new Date().getFullYear();
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(currentYear, 0, 1)),
      end: endOfYear(new Date(currentYear, 11, 31))
    });
    
    return months.map(month => ({
      name: format(month, 'MMM yyyy', { locale: es }),
      facturas: 0,
      monto: 0,
      month: month.getMonth(),
      year: month.getFullYear()
    }));
  };

  // Procesar datos mensuales
  const processMonthlyData = (invoices: any[]): ChartData[] => {
    if (!Array.isArray(invoices)) {
      console.error('Se esperaba un array de facturas');
      return generateEmptyYearData();
    }
    
    const yearData = generateEmptyYearData();
    
    // Procesar facturas
    invoices.forEach(invoice => {
      try {
        if (!invoice) return;
        
        // Obtener la fecha de la factura (usar created si date no está disponible)
        const dateStr = invoice.date || invoice.created || invoice.creation_date;
        if (!dateStr) {
          console.warn('Factura sin fecha válida:', invoice.id);
          return;
        }
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn('Fecha de factura inválida:', dateStr, 'en factura:', invoice.id);
          return;
        }
        
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Obtener el monto total (usar total, amount o calcularlo)
        let amount = 0;
        if (typeof invoice.total === 'number') {
          amount = invoice.total;
        } else if (typeof invoice.amount === 'number') {
          amount = invoice.amount;
        } else if (Array.isArray(invoice.payments) && invoice.payments.length > 0) {
          // Sumar los pagos si no hay un total directo
          amount = invoice.payments.reduce((sum: number, payment: any) => {
            return sum + (parseFloat(payment.value) || 0);
          }, 0);
        }
        
        // Encontrar el mes correspondiente en los datos anuales
        const monthData = yearData.find(m => m.month === month && m.year === year);
        if (monthData) {
          monthData.facturas += 1;
          monthData.monto += Math.max(0, amount); // Asegurar que no sea negativo
        }
      } catch (error) {
        console.error('Error procesando factura:', invoice.id, error);
      }
    });
    
    // Formatear montos y asegurar que estén redondeados
    return yearData.map(month => ({
      ...month,
      monto: parseFloat(month.monto.toFixed(2)),
      name: format(new Date(month.year, month.month, 1), 'MMM yyyy', { locale: es })
    }));
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
    if (isNaN(value)) return '$0';
    
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-red-800">Error</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Reintentar
        </button>
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
    tooltipBg: 'rgba(255, 255, 255, 0.98)'
  };



  return (
    <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Evolución de Compras</h3>
        <p className="text-sm text-gray-500">Total facturado por mes</p>
      </div>
      <div className="p-4 pt-0">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total General</p>
            <p className="text-2xl font-bold text-blue-600">
              {typeof totalMonto === 'number' ? formatCurrency(totalMonto) : '$0'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500">Facturas</p>
            <p className="text-lg font-semibold text-gray-700">
              {typeof totalFacturas === 'number' ? totalFacturas.toLocaleString('es-ES') : '0'}
            </p>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={colors.secondary} stopOpacity={0.8} />
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
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 400 }}
                height={20}
                tickMargin={8}
                interval={0}
              />
              
              <YAxis 
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickCount={6}
              />
              
              <Tooltip 
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.grid}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                labelStyle={{
                  color: colors.text,
                  fontWeight: 500,
                  fontSize: '12px',
                  marginBottom: '4px'
                }}
                itemStyle={{
                  color: colors.text,
                  fontSize: '12px',
                  padding: '2px 0'
                }}
                formatter={(value: number) => [
                  formatCurrency(Number(value)),
                  'Total facturado'
                ]}
                labelFormatter={(label) => `Mes: ${label}`}
              />
              
              <ReferenceLine y={0} stroke={colors.grid} />
              
              <Line
                type="monotone"
                dataKey="monto"
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                dot={{
                  fill: '#ffffff',
                  stroke: 'currentColor',
                  strokeWidth: 2,
                  r: 4,
                  strokeOpacity: 0.9,
                  style: {
                    filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))'
                  }
                }}
                activeDot={{
                  r: 6,
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  fill: colors.primary,
                  style: {
                    filter: 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.15))'
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
