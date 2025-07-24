"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, Loader2, Zap, Database, CreditCard, FileText, AlertCircle } from "lucide-react"

interface TestResult {
  success: boolean;
  message: string;
  timestamp: string;
  results?: {
    authentication: {
      success: boolean;
      token?: string;
      error?: string;
    };
    endpoints: {
      success: boolean;
      tests: Array<{
        endpoint: string;
        status: number;
        success: boolean;
        data?: unknown;
        error?: string;
      }>;
    };
  };
  summary?: {
    authenticationSuccess: boolean;
    endpointsSuccess: boolean;
    totalEndpointsTested: number;
    successfulEndpoints: number;
  };
  error?: string;
}

export default function TestSiigoPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [envInfo, setEnvInfo] = useState<any>(null)

  // Cargar información de variables de entorno al montar el componente
  useEffect(() => {
    const loadEnvInfo = async () => {
      try {
        const response = await fetch('/api/env-info')
        if (response.ok) {
          const data = await response.json()
          setEnvInfo(data)
        }
      } catch (error) {
        console.error('Error cargando variables de entorno:', error)
      }
    }
    loadEnvInfo()
  }, [])

  const runSiigoTest = async (): Promise<void> => {
    console.log('[TEST-SIIGO-PAGE] Iniciando pruebas de conexión con Siigo');
    setIsLoading(true)
    setTestResult(null)

    try {
      console.log('[TEST-SIIGO-PAGE] Enviando petición a /api/siigo/test');
      const response = await fetch('/api/siigo/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`[TEST-SIIGO-PAGE] Respuesta recibida: Status ${response.status}`);
      const data: TestResult = await response.json();
      console.log('[TEST-SIIGO-PAGE] Datos de respuesta:', data);

      setTestResult(data);

    } catch (error) {
      console.error('[TEST-SIIGO-PAGE] Error en las pruebas:', error);
      setTestResult({
        success: false,
        message: 'Error al ejecutar las pruebas',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      setIsLoading(false)
      console.log('[TEST-SIIGO-PAGE] Pruebas finalizadas');
    }
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
        ✅ Exitoso
      </Badge>
    ) : (
      <Badge variant="destructive">
        ❌ Error
      </Badge>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-blue-600" />
          Pruebas de Conexión con Siigo
        </h1>
        <p className="text-muted-foreground">
          Verifica la conectividad y autenticación con la API de Siigo
        </p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Control de Pruebas
          </CardTitle>
          <CardDescription>
            Ejecuta pruebas de conexión con los servicios de Siigo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runSiigoTest} 
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ejecutando Pruebas...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Ejecutar Pruebas de Siigo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resumen de Pruebas
                </span>
                {getStatusBadge(testResult.success)}
              </CardTitle>
              <CardDescription>
                Ejecutado el {new Date(testResult.timestamp).toLocaleString('es-CO')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Estado General:</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResult.success)}
                    <span className={testResult.success ? "text-green-600" : "text-red-600"}>
                      {testResult.success ? "Exitoso" : "Con Errores"}
                    </span>
                  </div>
                </div>
                
                {testResult.summary && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span>Autenticación:</span>
                        {getStatusIcon(testResult.summary.authenticationSuccess)}
                      </div>
                      <div className="flex justify-between">
                        <span>Endpoints:</span>
                        {getStatusIcon(testResult.summary.endpointsSuccess)}
                      </div>
                      <div className="flex justify-between">
                        <span>Endpoints Probados:</span>
                        <span>{testResult.summary.totalEndpointsTested}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Endpoints Exitosos:</span>
                        <span className="text-green-600">
                          {testResult.summary.successfulEndpoints}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Authentication Results */}
          {testResult.results?.authentication && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Autenticación
                  </span>
                  {getStatusBadge(testResult.results.authentication.success)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {testResult.results.authentication.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Token obtenido exitosamente</span>
                    </div>
                    {testResult.results.authentication.token && (
                      <div className="text-sm text-muted-foreground">
                        Token: {testResult.results.authentication.token}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>Error en autenticación</span>
                    </div>
                    {testResult.results.authentication.error && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {testResult.results.authentication.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Endpoints Results */}
          {testResult.results?.endpoints && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Pruebas de Endpoints
                </CardTitle>
                <CardDescription>
                  Resultados de las pruebas de conectividad con los endpoints de Siigo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResult.results.endpoints.tests.map((test, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.success)}
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {test.endpoint}
                          </code>
                        </div>
                        <Badge variant={test.success ? "default" : "destructive"}>
                          {test.status}
                        </Badge>
                      </div>
                      
                      {test.error && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Error: {test.error}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Details */}
          {testResult.error && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Detalles del Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                  {testResult.error}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Instrucciones
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>¿Qué hace esta prueba?</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Verifica la autenticación con Siigo usando tu función <code>obtenerTokenSiigo()</code></li>
            <li>Prueba la conectividad con endpoints básicos de Siigo</li>
            <li>Consulta tipos de documento, métodos de pago e impuestos</li>
            <li>Muestra información detallada para debugging</li>
          </ul>
          
          <p className="mt-4">
            <strong>Variables de entorno configuradas:</strong>
          </p>
          {envInfo ? (
            <div className="space-y-2 text-xs">
              <div className="bg-gray-100 p-2 rounded">
                <strong>SIIGO_AUTH_URL:</strong> <code>{envInfo.SIIGO_AUTH_URL}</code>
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <strong>SIIGO_USERNAME:</strong> <code>{envInfo.SIIGO_USERNAME}</code>
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <strong>SIIGO_ACCESS_KEY:</strong> <code>{envInfo.SIIGO_ACCESS_KEY_CONFIGURED}</code>
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <strong>SIIGO_PARTNER_ID:</strong> <code>{envInfo.SIIGO_PARTNER_ID}</code>
              </div>
              <div className="bg-blue-50 p-2 rounded border border-blue-200">
                <strong>DATABASE:</strong> <code className="text-blue-600">{envInfo.DATABASE_CONFIGURED}</code>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Cargando información de variables de entorno...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}