'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, User as UserIcon, Mail, Calendar, Shield, FileText, BarChart2 } from 'lucide-react';
import AnalyticsSection from './AnalyticsSection';
import { toast } from 'sonner';

interface User {
  email: string;
  created_at: string;
  role?: string;
  // Add other user properties as needed
}

interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({ user }: DashboardContentProps) {
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

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'U';
  const joinDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Fecha no disponible';
  
  // Add error boundary for rendering
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error de autenticación</h2>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del usuario.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recargar página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Panel de Administración
              </h1>
              <Badge variant="secondary" className="flex items-center space-x-1">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="h-5 w-5" />
                <span>Perfil de Usuario</span>
              </CardTitle>
              <CardDescription>
                Información de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  <p className="text-sm text-gray-500">Usuario Administrador</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Miembro desde:</span>
                  <span className="font-medium">{joinDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Acciones Rápidas</span>
              </CardTitle>
              <CardDescription>
                Accede a las funciones principales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="default"
                onClick={() => router.push('/invoice')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Formulario SIIGO
              </Button>

            </CardContent>
          </Card>

          {/* System Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Estado del Sistema</CardTitle>
              <CardDescription>
                Información del sistema de autenticación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Estado de Sesión:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Activa
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tipo de Usuario:</span>
                <Badge variant="secondary">
                  Administrador
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Autenticación:</span>
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  Verificada
                </Badge>
              </div>
              <Separator />
              <p className="text-xs text-gray-500">
                Tu sesión está protegida y todas las rutas administrativas 
                requieren autenticación válida.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <AnalyticsSection />

        {/* Welcome Message */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ¡Bienvenido al Sistema de Facturación SIIGO!
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Has iniciado sesión exitosamente en el sistema protegido. 
                Todas las rutas administrativas están ahora disponibles para ti. 
                El middleware de autenticación protege automáticamente las páginas 
                sensibles como /admin, /facturacion, y /dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
