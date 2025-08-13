'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import CufeInfoCard from "@/components/invoice/CufeInfoCard";
import { useRouter } from 'next/navigation';

export default function CufePage() 
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cufe, setCufe] = useState<string>(searchParams.get('cufe') || '');
  const [searchCufe, setSearchCufe] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<any>(null);

  // Buscar CUFE automáticamente si viene en la URL
  useEffect(() => {
    if (searchParams.get('cufe')) {
      setCufe(searchParams.get('cufe') || '');
      setSearchCufe(searchParams.get('cufe') || '');
      handleSearchByCufe(searchParams.get('cufe') || '');
    }
  }, [searchParams]);

  const handleSearchByCufe = async (cufeToSearch: string = cufe) => {
    if (!cufeToSearch) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/siigo/search-invoice?cufe=${encodeURIComponent(cufeToSearch)}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.data) {
        setInvoice(data.data);
        toast.success('Factura encontrada exitosamente');
      } else {
        setInvoice(null);
        toast.error('No se encontró una factura con el CUFE proporcionado');
      }
    } catch (error) {
      console.error('Error al buscar factura por CUFE:', error);
      toast.error('Error al buscar la factura. Por favor, intente nuevamente.');
      setInvoice(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Consulta de Factura por CUFE</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Buscar Factura por CUFE</CardTitle>
          <CardDescription>
            Ingrese el CUFE para buscar y visualizar los datos de la factura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Ingrese el CUFE de la factura a buscar"
              value={searchCufe}
              onChange={(e) => setSearchCufe(e.target.value)}
              className="flex-1"
            />
            <Button 
              type="button"
              onClick={() => handleSearchByCufe(searchCufe)}
              disabled={!searchCufe || isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Buscar por CUFE'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSearching ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Buscando información de la factura...</span>
        </div>
      ) : invoice ? (
        <CufeInfoCard invoice={invoice} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {cufe ? 'No se encontró información para el CUFE proporcionado.' : 'Ingrese un CUFE para ver la información de la factura.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Button variant="outline" onClick={() => router.push('/invoice')}>
          Volver al formulario de facturas
        </Button>
      </div>
    </div>
  );
}