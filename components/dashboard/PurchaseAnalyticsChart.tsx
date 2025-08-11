'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LabelList
} from 'recharts';

// Tipos de datos para el gráfico
interface MonthlyData {
  month: string;
  amount: number;
  count: number;
  shortMonth: string;
  formattedAmount: string;
  formattedCount: string;
}

interface AnalyticsData {
  monthlyData: MonthlyData[];
  totalInvoices: number;
  totalAmount: number;
}

export default function PurchaseAnalyticsChart() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Obtener datos de la API
        const response = await fetch('/api/siigo/get-purchases?get_all_pages=true');
        
        if (!response.ok) {
          throw new Error('Error al cargar los datos de compras');
        }
        
        const responseData = await response.json();
        
        // Procesar los datos para el gráfico
        const analyticsData = await processInvoices(responseData);
        setData(analyticsData);
        setError(null);
      } catch (err) {
        console.error('Error:', err);
        setError('No se pudieron cargar los datos. Intente de nuevo más tarde.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Función para procesar las facturas y generar datos para el gráfico
  const processInvoices = async (invoices: any[]): Promise<AnalyticsData> => {
    // Agrupar facturas por mes
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    let totalAmount = 0;
    
    // Inicializar los últimos 12 meses con valores en 0
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(now.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      
      const monthKey = date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short',
        timeZone: 'UTC' // Usar UTC para consistencia
      });
      
      monthlyMap.set(monthKey, { amount: 0, count: 0 });
    }
    
    // Procesar cada factura
    for (const invoice of invoices) {
      try {
        if (!invoice || !invoice.date) continue;
        
        // Crear fecha de manera segura
        let date: Date;
        if (typeof invoice.date === 'string') {
          // Asegurarse de que la fecha tenga el formato correcto
          const dateStr = invoice.date.split('T')[0]; // Tomar solo la parte de la fecha
          date = new Date(dateStr + 'T00:00:00.000Z');
        } else {
          date = new Date(invoice.date);
        }
        
        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
          console.warn('Fecha inválida en factura:', invoice.id, invoice.date);
          continue;
        }
        
        const monthKey = date.toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'short',
          timeZone: 'UTC'
        });
        
        const amount = parseFloat(invoice.total) || 0;
        const monthData = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
        
        monthData.amount += amount;
        monthData.count += 1;
        totalAmount += amount;
        
        monthlyMap.set(monthKey, monthData);
      } catch (err) {
        console.warn('Error procesando factura:', invoice?.id, err);
      }
    }
    
    // Convertir a array, ordenar y formatear para el gráfico
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => {
        // Crear fecha de manera segura
        const [monthName, year] = month.split(' ');
        const monthIndex = new Date(Date.parse(monthName + ' 1, ' + year)).getMonth();
        const date = new Date(parseInt(year), monthIndex, 1);
        
        // Formato corto para el eje X
        const shortMonth = date.toLocaleDateString('es-ES', { 
          month: 'short',
          timeZone: 'UTC'
        }) + "'" + date.toLocaleDateString('es-ES', { 
          year: '2-digit',
          timeZone: 'UTC'
        });
      
      return {
        month,
        amount: data.amount,
        count: data.count,
        shortMonth,
        formattedAmount: new Intl.NumberFormat('es-CO', { 
          style: 'currency', 
          currency: 'COP',
          maximumFractionDigits: 0
        }).format(data.amount),
        formattedCount: data.count.toString()
      };
    }).sort((a, b) => new Date('1 ' + a.month).getTime() - new Date('1 ' + b.month).getTime());
    
    // Ordenar los datos por fecha
    const sortedMonthlyData = monthlyData.sort((a, b) => {
      const dateA = new Date(a.month + ' 1');
      const dateB = new Date(b.month + ' 1');
      return dateA.getTime() - dateB.getTime();
    });
    
    return {
      monthlyData: sortedMonthlyData,
      totalInvoices: invoices.length,
      totalAmount
    };
  };

  if (isLoading) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-500">{error}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.monthlyData.length === 0) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center">
        <div className="text-center p-6">
          <p>No hay datos disponibles para mostrar</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Análisis Mensual de Compras</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.monthlyData}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              barGap={4}
              barCategoryGap="10%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              
              {/* Eje X */}
              <XAxis 
                dataKey="shortMonth"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                height={24}
              />
              
              {/* Eje Y Izquierdo (Monto) */}
              <YAxis 
                yAxisId="left"
                orientation="left"
                tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`}
                tick={{ fill: '#3b82f6', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              
              {/* Eje Y Derecho (Cantidad) */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#10b981', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              
              {/* Tooltip personalizado */}
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const amountData = payload.find(p => p.dataKey === 'amount');
                    const countData = payload.find(p => p.dataKey === 'count');
                    
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-800">{label}</p>
                        <div className="mt-1">
                          <p className="text-sm text-blue-600">
                            <span className="font-medium">Total: </span>
                            {amountData?.payload.formattedAmount}
                          </p>
                          <p className="text-sm text-green-600">
                            <span className="font-medium">Facturas: </span>
                            {countData?.payload.formattedCount}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* Leyenda personalizada */}
              <Legend 
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-xs font-medium text-gray-600">
                    {value === 'amount' ? 'Monto Total' : 'Cantidad de Facturas'}
                  </span>
                )}
              />
              
              {/* Gráfico de barras para la cantidad de facturas */}
              <Bar
                yAxisId="right"
                dataKey="count"
                name="Cantidad de Facturas"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                barSize={24}
              >
                <LabelList 
                  dataKey="count" 
                  position="top" 
                  fill="#065f46"
                  fontSize={11}
                  fontWeight={500}
                  formatter={(value: number) => value > 0 ? value : ''}
                />
              </Bar>
              
              {/* Línea para el monto total */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="amount"
                name="Monto Total"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{
                  fill: '#3b82f6',
                  stroke: '#fff',
                  strokeWidth: 2,
                  r: 5,
                  strokeOpacity: 0.9
                }}
                activeDot={{
                  r: 7,
                  stroke: '#fff',
                  strokeWidth: 2,
                  fill: '#2563eb'
                }}
              >
                <LabelList 
                  dataKey="amount" 
                  position="top" 
                  fill="#1e40af"
                  fontSize={11}
                  fontWeight={500}
                  offset={10}
                  formatter={(value: number) => 
                    value > 0 ? `$${(value / 1000000).toFixed(1)}M` : ''
                  }
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
