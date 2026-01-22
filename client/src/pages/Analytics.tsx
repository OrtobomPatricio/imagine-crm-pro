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
  PieChart,
  Clock,
  Trophy,
  Medal,
  Award
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function Analytics() {
  const { data: dashboardStats } = trpc.dashboard.getStats.useQuery();
  const { data: numberStats } = trpc.whatsappNumbers.getStats.useQuery();
  const { data: analyticsOverview } = trpc.analytics.getOverview.useQuery();

  const totalCommission = analyticsOverview?.totalCommission ?? 0;

  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("tab") || "overview";

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

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="overview">General</TabsTrigger>
            <TabsTrigger value="commissions">Comisiones</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
            <TabsTrigger value="achievements">Logros</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
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
            <ReportsView />
          </TabsContent>

          <TabsContent value="commissions" className="pt-4">
            <CommissionsView />
          </TabsContent>

          <TabsContent value="goals" className="pt-4">
            <GoalsView />
          </TabsContent>

          <TabsContent value="achievements" className="pt-4">
            <AchievementsView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function ReportsView() {
  const { data: analyticsOverview } = trpc.analytics.getOverview.useQuery();
  const { data: numberStats } = trpc.whatsappNumbers.getStats.useQuery();
  const { data: performanceData } = trpc.analytics.getPerformance.useQuery();

  return (
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
              { key: 'new', label: 'Nuevos', color: 'bg-blue-500' },
              { key: 'contacted', label: 'Contactados', color: 'bg-yellow-500' },
              { key: 'qualified', label: 'Calificados', color: 'bg-purple-500' },
              { key: 'negotiation', label: 'Negociación', color: 'bg-orange-500' },
              { key: 'won', label: 'Ganados', color: 'bg-green-500' },
              { key: 'lost', label: 'Perdidos', color: 'bg-red-500' },
            ].map((item) => {
              const countValue = analyticsOverview?.leadStatusDistribution?.find(
                (row: { status: string; count: number }) => row.status === item.key
              )?.count ?? 0;
              return (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-semibold">{countValue}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leads Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolución de Leads
          </CardTitle>
          <CardDescription>
            Últimos 30 días
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-end justify-between gap-1 pt-4">
            {(performanceData ?? []).length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No hay datos recientes</div>
            ) : (
              performanceData?.slice(-14).map((day: any) => {
                const max = Math.max(...(performanceData?.map((p: any) => p.count) ?? [1]));
                const height = Math.max(4, (day.count / max) * 100);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full bg-primary/20 rounded-t-sm relative transition-all hover:bg-primary/40" style={{ height: `${height}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-md">
                        {day.count} leads
                        <div className="text-[10px] opacity-70">{day.date}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Hace 14 días</span>
            <span>Hoy</span>
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
            {(numberStats?.countriesDistribution ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay datos disponibles
              </p>
            ) : (
              (numberStats?.countriesDistribution ?? []).map((country: { country: string; count: number }) => {
                const total = numberStats?.totalNumbers ?? 1;
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
                {numberStats?.activeNumbers ?? 0}
              </div>
              <p className="text-sm text-green-700">Activos</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {numberStats?.warmingUpNumbers ?? 0}
              </div>
              <p className="text-sm text-yellow-700">Warm-up</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {numberStats?.blockedNumbers ?? 0}
              </div>
              <p className="text-sm text-red-700">Bloqueados</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {(numberStats?.totalNumbers ?? 0) -
                  (numberStats?.activeNumbers ?? 0) -
                  (numberStats?.warmingUpNumbers ?? 0) -
                  (numberStats?.blockedNumbers ?? 0)}
              </div>
              <p className="text-sm text-gray-700">Desconectados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionsView() {
  const { data: commissionsByCountry = [] } = trpc.analytics.getCommissionsByCountry.useQuery();
  const total = commissionsByCountry.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  const topCountry = commissionsByCountry[0]?.country ?? "-";
  const topShare = total > 0 ? Math.round(((commissionsByCountry[0]?.amount ?? 0) / total) * 100) : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Comisiones por País</CardTitle>
          <CardDescription>Desglose de ganancias generadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commissionsByCountry.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-6">
                No hay datos de comisiones todavía.
              </div>
            ) : (
              commissionsByCountry.map((item) => (
                <div key={item.country} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                      {item.country.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{item.country}</div>
                      <div className="text-xs text-muted-foreground">{item.leads} leads cerrados</div>
                    </div>
                  </div>
                  <div className="font-bold text-green-600">
                    {Math.round(item.amount ?? 0).toLocaleString()} G$
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proyección Mensual</CardTitle>
          <CardDescription>Basado en el rendimiento actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-4xl font-bold text-primary mb-2">
              {Math.round(total).toLocaleString()} G$
            </div>
            <p className="text-muted-foreground mb-6">
              Principal país: {topCountry} ({topShare}%)
            </p>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Meta sobre comisión total</span>
                <span>{Math.min(100, topShare)}%</span>
              </div>
              <Progress value={Math.min(100, topShare)} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalsView() {
  const { data: goals } = trpc.goals.list.useQuery();
  const { data: teamRanking = [] } = trpc.analytics.getTeamRanking.useQuery();

  // Mock data for display until DB is populated
  const displayGoals = goals && goals.length > 0 ? goals : [
    { id: 1, type: "sales_amount", targetAmount: 50000000, currentAmount: 35000000, period: "monthly" },
    { id: 2, type: "deals_closed", targetAmount: 50, currentAmount: 42, period: "monthly" },
    { id: 3, type: "leads_created", targetAmount: 500, currentAmount: 320, period: "monthly" },
  ];

  const getLabel = (type: string) => {
    switch (type) {
      case "sales_amount": return "Ventas Totales";
      case "deals_closed": return "Cierres";
      case "leads_created": return "Nuevos Leads";
      default: return type;
    }
  };

  const getFormat = (type: string, val: number) => {
    if (type === "sales_amount") return val.toLocaleString() + " G$";
    return val.toString();
  };

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayGoals.map((goal) => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {getLabel(goal.type)} ({goal.period === 'monthly' ? 'Mensual' : 'Semanal'})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end mb-2">
                  <div className="text-2xl font-bold">
                    {getFormat(goal.type, goal.currentAmount)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {getFormat(goal.type, goal.targetAmount)}
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 text-right">{progress}% completado</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking del Equipo</CardTitle>
          <CardDescription>Top performers este mes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamRanking.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Sin cierres registrados en el período.
              </div>
            ) : (
              teamRanking.map((agent, index) => (
                <div key={agent.userId ?? index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold text-primary">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{agent.name ?? "Sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">{agent.deals} cierres</div>
                    </div>
                  </div>
                  <div className="font-bold">
                    {Math.round(agent.sales ?? 0).toLocaleString()} G$
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementsView() {
  const { data: achievements } = trpc.achievements.list.useQuery();

  const BADGES = [
    { id: "first_sale", name: "Primera Venta", icon: Trophy, desc: "Cerraste tu primera venta", color: "text-yellow-500 bg-yellow-500/10" },
    { id: "shark", name: "Tiburón", icon: Medal, desc: "Más de 50M G$ en un mes", color: "text-blue-500 bg-blue-500/10" },
    { id: "speed", name: "Rayo Veloz", icon: Clock, desc: "Respuesta promedio < 5min", color: "text-purple-500 bg-purple-500/10" },
    { id: "closer", name: "Closer", icon: Award, desc: "10 Cierres en una semana", color: "text-green-500 bg-green-500/10" },
    { id: "social", name: "Sociable", icon: MessageCircle, desc: "1000 Mensajes enviados", color: "text-pink-500 bg-pink-500/10" },
  ];

  // Mock unlocked badges
  const unlockedIds = achievements?.map(a => a.type) || ["first_sale", "social"];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {BADGES.map((badge) => {
        const isUnlocked = unlockedIds.includes(badge.id);
        const Icon = badge.icon;

        return (
          <Card key={badge.id} className={`text-center ${isUnlocked ? 'border-primary/50' : 'opacity-50 grayscale'}`}>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isUnlocked ? badge.color : 'bg-muted'}`}>
                <Icon className="w-8 h-8" />
              </div>
              <h3 className="font-bold mb-1">{badge.name}</h3>
              <p className="text-xs text-muted-foreground">{badge.desc}</p>
              {isUnlocked && (
                <div className="mt-3 px-2 py-1 bg-primary/10 rounded-full text-[10px] font-medium text-primary">
                  Desbloqueado
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
