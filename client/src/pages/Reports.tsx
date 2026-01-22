import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, BarChart3, Clock } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
} from "recharts";

type LeadEvolutionPoint = { date: string; leads: number };
type CampaignPerformancePoint = { country: string; sent: number; delivered: number; read: number };
type MessagesByHourPoint = { hour: string; messages: number };

export default function Reports() {
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: reportData } = trpc.reports.getOverview.useQuery();

  const leadsEvolutionData = (reportData?.leadsEvolution ?? []) as LeadEvolutionPoint[];
  const campaignPerformanceData = (reportData?.campaignPerformance ?? []) as CampaignPerformancePoint[];
  const messagesByHourData = (reportData?.messagesByHour ?? []) as MessagesByHourPoint[];

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="icon-container icon-container-pink">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supervisión</h1>
          <p className="text-muted-foreground">
            Vista completa del equipo
          </p>
        </div>
      </div>
      
      <p className="text-muted-foreground">
        Rankings, alertas y métricas de desempeño
      </p>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads Evolution Chart */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-lg">Evolución de Leads</CardTitle>
            </div>
            <CardDescription>
              Crecimiento en los últimos 30 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={leadsEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Performance Chart */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-lg">Desempeño de Campañas</CardTitle>
            </div>
            <CardDescription>
              Por país - últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="country" 
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" name="Enviados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Entregados" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="read" name="Leídos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages by Hour Chart - Full Width */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-lg">Mensajes por Hora</CardTitle>
          </div>
          <CardDescription>
            Distribución en las últimas 24 horas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messagesByHourData}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="hour" 
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorMessages)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="action-card">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-400">
                {stats?.totalLeads ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="action-card">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">
                {stats?.conversionRate ?? 0}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Tasa de Conversión</p>
            </div>
          </CardContent>
        </Card>
        <Card className="action-card">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-400">
                {stats?.totalNumbers ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Números Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="action-card">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">
                {stats?.messagesToday ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Mensajes Hoy</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
