'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, BarChart2 } from 'lucide-react';
import PurchaseAnalyticsChart from './PurchaseAnalyticsChart';
import PurchaseInvoicesDashboard from './PurchaseInvoicesDashboard';

type DashboardView = 'events' | 'purchases' | 'analytics';

export default function DashboardSelector() {
  const [activeView, setActiveView] = useState<DashboardView>('events');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button
          variant={activeView === 'events' ? 'default' : 'ghost'}
          onClick={() => setActiveView('events')}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          Registro de Eventos
        </Button>
        <Button
          variant={activeView === 'purchases' ? 'default' : 'ghost'}
          onClick={() => setActiveView('purchases')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Facturas de Compra
        </Button>
        <Button
          variant={activeView === 'analytics' ? 'default' : 'ghost'}
          onClick={() => setActiveView('analytics')}
          className="flex items-center gap-2"
        >
          <BarChart2 className="h-4 w-4" />
          Análisis Avanzado
        </Button>
      </div>

      <div className="min-h-[500px] rounded-lg border bg-white p-6 shadow-sm">
        {activeView === 'events' && <PurchaseAnalyticsChart />}
        {activeView === 'purchases' && <PurchaseInvoicesDashboard />}
        {activeView === 'analytics' && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">Panel de análisis en desarrollo</p>
          </div>
        )}
      </div>
    </div>
  );
}
