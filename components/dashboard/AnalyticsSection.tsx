'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import DashboardSelector from './DashboardSelector';

// Componente Principal
export default function AnalyticsSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Función para manejar la recarga de datos
  const handleRefresh = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);
      setRefreshKey(prevKey => prevKey + 1);
      toast.success('Datos actualizados');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar los datos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mostrar estado de carga
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Panel de Análisis</h2>
            <p className="text-sm text-muted-foreground">
              Visualización de datos y métricas
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto gap-1"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  // Mostrar mensaje de error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Análisis de Compras</h2>
            <p className="text-sm text-muted-foreground">
              Visualización de datos y métricas de compras
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-64 rounded-lg border border-dashed">
          <div className="text-center">
            <h3 className="text-lg font-medium">Error al cargar los datos</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Análisis de Compras</h2>
          <p className="text-sm text-muted-foreground">
            Visualización de datos y métricas de compras
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto gap-1"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
      
      <DashboardSelector key={refreshKey} />
    </div>
  );
}