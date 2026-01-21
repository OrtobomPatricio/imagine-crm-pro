import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Phone,
  Target,
  DollarSign,
  BarChart3,
  PieChart
} from "lucide-react";

export default function Analytics() {
  const { data: dashboardStats } = trpc.dashboard.getStats.useQuery();
  const { data: numberStats } = trpc.whatsappNumbers.getStats.useQuery();

  const totalCommission = (dashboardStats?.recentLeads ?? []).reduce((acc, lead: { commission?: string | null }) => {
    return acc + parseFloat(lead.commission ?? '0');
  }, 0);

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Métricas y estadísticas de rendimiento
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.totalLeads ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Leads en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasa de Conversión
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.conversionRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Leads ganados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mensajes Hoy
            </CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.messagesToday ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Enviados hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Números Activos
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats?.activeNumbers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              De {dashboardStats?.totalNumbers ?? 0} totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lead Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución de Leads
            </CardTitle>
            <CardDescription>
              Por estado actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { status: 'Nuevos', count: 0, color: 'bg-blue-500' },
                { status: 'Contactados', count: 0, color: 'bg-yellow-500' },
                { status: 'Calificados', count: 0, color: 'bg-purple-500' },
                { status: 'Negociación', count: 0, color: 'bg-orange-500' },
                { status: 'Ganados', count: 0, color: 'bg-green-500' },
                { status: 'Perdidos', count: 0, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm">{item.status}</span>
                  </div>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Numbers by Country */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Números por País
            </CardTitle>
            <CardDescription>
              Distribución geográfica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(numberStats?.byCountry ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay datos disponibles
                </p>
              ) : (
                (numberStats?.byCountry ?? []).map((country: { country: string; count: number }) => {
                  const total = numberStats?.total ?? 1;
                  const percentage = Math.round((country.count / total) * 100);
                  return (
                    <div key={country.country} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{country.country}</span>
                        <span className="font-semibold">{country.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Number Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Estado de Números
            </CardTitle>
            <CardDescription>
              Distribución por estado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardStats?.activeNumbers ?? 0}
                </div>
                <p className="text-sm text-green-700">Activos</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {dashboardStats?.warmingUpNumbers ?? 0}
                </div>
                <p className="text-sm text-yellow-700">Warm-up</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {dashboardStats?.blockedNumbers ?? 0}
                </div>
                <p className="text-sm text-red-700">Bloqueados</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {(dashboardStats?.totalNumbers ?? 0) - 
                   (dashboardStats?.activeNumbers ?? 0) - 
                   (dashboardStats?.warmingUpNumbers ?? 0) - 
                   (dashboardStats?.blockedNumbers ?? 0)}
                </div>
                <p className="text-sm text-gray-700">Desconectados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumen de Rendimiento
            </CardTitle>
            <CardDescription>
              Métricas clave del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Comisión Potencial Total</span>
                </div>
                <span className="font-semibold text-green-600">
                  {totalCommission.toLocaleString()} G$
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Leads por Número</span>
                </div>
                <span className="font-semibold">
                  {dashboardStats?.totalNumbers 
                    ? Math.round((dashboardStats?.totalLeads ?? 0) / dashboardStats.totalNumbers)
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Capacidad de Mensajes/Día</span>
                </div>
                <span className="font-semibold">
                  {((dashboardStats?.activeNumbers ?? 0) * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
