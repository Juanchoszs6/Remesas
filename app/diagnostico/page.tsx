"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  Server, 
  Activity,
  RefreshCw,
  Globe,
  Zap,
  AlertTriangle,
  TrendingUp,
  Eye
} from 'lucide-react'

interface EndpointResult {
  name: string
  url: string
  status: 'OK' | 'ERROR' | 'TESTING'
  message: string
  responseTime?: number
  data?: string
}

interface DiagnosticData {
  timestamp: string
  environment: {
    databaseUrl: string
    SIIGO_USERNAME: string
    SIIGO_PARTNER_ID: string
    SIIGO_AUTH_URL: string
    SIIGO_ACCESS_KEY_CONFIGURED: string
  }
  apiStatus: {
    summary: {
      total: number
      working: number
      failing: number
      healthPercentage: number
      averageResponseTime: number
    }
    endpoints: EndpointResult[]
  }
}

export default function DiagnosticoPage() {
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const fetchDiagnostic = async () => {
    setLoading(true)
    setProgress(0)
    
    try {
      // Simular progreso de carga
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/env-info')
      const result = await response.json()
      
      clearInterval(progressInterval)
      setProgress(100)
      
      setTimeout(() => {
        setData(result)
        setLoading(false)
      }, 500)
      
    } catch (error) {
      console.error('Error fetching diagnostic:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostic()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'TESTING':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-green-500'
      case 'ERROR':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getHealthColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <Activity className="h-8 w-8 text-blue-600 animate-pulse" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Diagnóstico del Sistema
              </h1>
            </div>
            <p className="text-gray-600">Analizando el estado de todas las APIs...</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Ejecutando Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-600 text-center">
                  {progress < 30 && "Conectando con el servidor..."}
                  {progress >= 30 && progress < 60 && "Probando endpoints..."}
                  {progress >= 60 && progress < 90 && "Analizando respuestas..."}
                  {progress >= 90 && "Finalizando diagnóstico..."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error en el Diagnóstico</h1>
          <p className="text-gray-600 mb-4">No se pudo obtener información del sistema</p>
          <Button onClick={fetchDiagnostic} className="bg-red-600 hover:bg-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Diagnóstico del Sistema
            </h1>
          </div>
          <p className="text-gray-600">Estado completo de APIs y configuración del backend</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Última actualización: {new Date(data.timestamp).toLocaleString('es-CO')}
          </div>
        </div>

        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">APIs Funcionando</p>
                  <p className="text-2xl font-bold text-green-700">{data.apiStatus.summary.working}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">APIs con Error</p>
                  <p className="text-2xl font-bold text-red-700">{data.apiStatus.summary.failing}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Salud del Sistema</p>
                  <p className={`text-2xl font-bold ${getHealthColor(data.apiStatus.summary.healthPercentage)}`}>
                    {data.apiStatus.summary.healthPercentage}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Tiempo Promedio</p>
                  <p className="text-2xl font-bold text-purple-700">{data.apiStatus.summary.averageResponseTime}ms</p>
                </div>
                <Zap className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Estado de APIs */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-500" />
                Estado de APIs
              </CardTitle>
              <CardDescription>
                Monitoreo en tiempo real de todos los endpoints del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.apiStatus.endpoints.map((endpoint, index) => (
                  <div 
                    key={endpoint.url}
                    className="flex items-center justify-between p-4 rounded-lg border bg-white shadow-sm hover:shadow-md transition-all duration-200"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(endpoint.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">{endpoint.name}</h4>
                        <p className="text-sm text-gray-500 font-mono">{endpoint.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {endpoint.data && (
                        <Badge variant="outline" className="text-xs">
                          {endpoint.data}
                        </Badge>
                      )}
                      {endpoint.responseTime && (
                        <Badge variant="secondary" className="text-xs">
                          {endpoint.responseTime}ms
                        </Badge>
                      )}
                      <Badge 
                        className={`text-xs text-white ${getStatusColor(endpoint.status)}`}
                      >
                        {endpoint.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configuración del Entorno */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-500" />
                Configuración del Entorno
              </CardTitle>
              <CardDescription>
                Variables de entorno y configuración del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.environment).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <span className="font-medium text-gray-700">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <Badge 
                      variant={value.includes('✅') ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {value}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botón de Actualizar */}
        <div className="text-center mt-8">
          <Button 
            onClick={fetchDiagnostic} 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Diagnóstico
          </Button>
        </div>
      </div>
    </div>
  )
}
