'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, FileText, DollarSign, Users, BarChart3, Settings, ArrowLeft, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface BillingContentProps {
  user: User;
}

export default function BillingContent({ user }: BillingContentProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Sesión cerrada exitosamente');
        router.push('/login');
        router.refresh();
      } else {
        throw new Error('Error al cerrar sesión');
      }
    } catch (error) {
      toast.error('Error al cerrar sesión');
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userInitials = user.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver al Dashboard</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="text-2xl font-bold text-gray-900">
                Sistema de Facturación SIIGO
              </h1>
              <Badge variant="destructive" className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>Área Protegida</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar>
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700">
                  {user.email}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Security Notice */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Área Protegida por Autenticación</h3>
                <p className="text-green-700 text-sm">
                  Esta página está protegida por el middleware de autenticación. 
                  Solo usuarios autenticados pueden acceder a esta sección de facturación.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Revenue Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ingresos Totales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,231.89</div>
              <p className="text-xs text-muted-foreground">
                +20.1% desde el mes pasado
              </p>
            </CardContent>
          </Card>

          {/* Invoices Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Facturas Emitidas
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+2350</div>
              <p className="text-xs text-muted-foreground">
                +180.1% desde el mes pasado
              </p>
            </CardContent>
          </Card>

          {/* Clients Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Clientes Activos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12,234</div>
              <p className="text-xs text-muted-foreground">
                +19% desde el mes pasado
              </p>
            </CardContent>
          </Card>

          {/* Growth Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Crecimiento
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+573</div>
              <p className="text-xs text-muted-foreground">
                +201 desde la semana pasada
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Billing Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Acciones de Facturación</span>
              </CardTitle>
              <CardDescription>
                Gestiona tus facturas y procesos de facturación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" size="lg">
                <FileText className="h-4 w-4 mr-2" />
                Crear Nueva Factura
              </Button>
              <Button className="w-full justify-start" variant="outline" size="lg">
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Reportes de Facturación
              </Button>
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Users className="h-4 w-4 mr-2" />
                Gestionar Clientes
              </Button>
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Settings className="h-4 w-4 mr-2" />
                Configuración de Facturación
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>
                Últimas transacciones y actividades del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Factura #INV-001 creada</p>
                    <p className="text-xs text-gray-500">Hace 2 minutos</p>
                  </div>
                  <Badge variant="secondary">$1,234.56</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pago recibido de Cliente ABC</p>
                    <p className="text-xs text-gray-500">Hace 15 minutos</p>
                  </div>
                  <Badge variant="secondary">$2,500.00</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Factura #INV-002 pendiente</p>
                    <p className="text-xs text-gray-500">Hace 1 hora</p>
                  </div>
                  <Badge variant="outline">$890.00</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nuevo cliente registrado</p>
                    <p className="text-xs text-gray-500">Hace 2 horas</p>
                  </div>
                  <Badge variant="secondary">Cliente XYZ</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Authentication Info */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                🔒 Sistema de Facturación Protegido
              </h2>
              <p className="text-gray-600 max-w-3xl mx-auto">
                Esta página está completamente protegida por el sistema de autenticación implementado. 
                El middleware verifica automáticamente que el usuario esté autenticado antes de permitir 
                el acceso a esta sección crítica de facturación. Todas las rutas /facturacion, /admin, 
                /dashboard y /billing están protegidas y requieren login válido.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
