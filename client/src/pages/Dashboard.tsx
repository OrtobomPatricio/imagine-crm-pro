import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Users,
  MessageCircle,
  Phone,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Send,
  MessageSquare,
  UserCheck,
  Shield,
  LayoutGrid,
  DollarSign,
  Target,
  Trophy,
  Flame,
  BarChart3,
  Calendar,
  Activity,
  FileText,
  ArrowUpRight
} from "lucide-react";

interface WarmupNumber {
  id: number;
  phoneNumber: string;
  warmupDay: number;
  dailyMessageLimit: number;
  messagesSentToday: number;
}

interface CountryDistribution {
  country: string;
  count: number;
}

interface RecentLead {
  id: number;
  name: string;
  phone: string;
  status: string;
  country: string;
}

// Quick Actions configuration - hoverColor matches icon color
const quickActions = [
  {
    key: "leads",
    icon: Users,
    label: "Gestionar Leads",
    description: "Importa, organiza y segmenta tus prospectos",
    path: "/leads",
    iconColor: "icon-container-blue",
    hoverColor: "hover-blue"
  },
  {
    key: "campaigns",
    icon: Send,
    label: "Crear Campaña",
    description: "Diseña y lanza campañas de mensajes masivos",
    path: "/campaigns",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
  {
    key: "conversations",
    icon: MessageSquare,
    label: "Conversaciones",
    description: "Chat completo estilo WhatsApp",
    path: "/chat",
    iconColor: "icon-container-purple",
    hoverColor: "hover-purple"
  },
  {
    key: "attendants",
    icon: UserCheck,
    label: "Atendentes",
    description: "Administra tu equipo de atención",
    path: "/settings?tab=team",
    iconColor: "icon-container-red",
    hoverColor: "hover-red"
  },
  {
    key: "health",
    icon: Shield,
    label: "Salud de Cuentas",
    description: "Monitor de detección de bloqueos",
    path: "/monitoring",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "whatsapp",
    icon: Phone,
    label: "Cuentas WhatsApp",
    description: "Monitorea tus 42 números conectados",
    path: "/monitoring",
    iconColor: "icon-container-green",
    hoverColor: "hover-green"
  },
  {
    key: "integrations",
    icon: LayoutGrid,
    label: "Integraciones",
    description: "Configura Chatwoot, n8n y más",
    path: "/integrations",
    iconColor: "icon-container-purple",
    hoverColor: "hover-purple"
  },
  {
    key: "kanban",
    icon: LayoutGrid,
    label: "Kanban Board",
    description: "Gestiona leads con arrastrar y soltar",
    path: "/kanban",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
  {
    key: "commissions",
    icon: DollarSign,
    label: "Comisiones",
    description: "Acompaña tus ganancias por país",
    path: "/analytics?tab=commissions",
    iconColor: "icon-container-yellow",
    hoverColor: "hover-yellow"
  },
  {
    key: "goals",
    icon: Target,
    label: "Metas de Vendas",
    description: "Progreso y ranking del equipo",
    path: "/analytics?tab=goals",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "achievements",
    icon: Trophy,
    label: "Logros",
    description: "Badges y conquistas desbloqueadas",
    path: "/analytics?tab=achievements",
    iconColor: "icon-container-red",
    hoverColor: "hover-red"
  },
  {
    key: "warmup",
    icon: Flame,
    label: "Warm-up",
    description: "Calendario de 28 días hasta 1000 msgs",
    path: "/monitoring",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "analytics",
    icon: BarChart3,
    label: "Analytics",
    description: "Tasas de apertura y heatmap de horarios",
    path: "/analytics",
    iconColor: "icon-container-blue",
    hoverColor: "hover-blue"
  },
  {
    key: "scheduling",
    icon: Calendar,
    label: "Agendamiento",
    description: "Gestiona citas y reuniones en calendario",
    path: "/scheduling",
    iconColor: "icon-container-green",
    hoverColor: "hover-green"
  },
  {
    key: "monitoring",
    icon: Activity,
    label: "Monitoreo en Vivo",
    description: "Dashboard en tiempo real con alertas",
    path: "/monitoring",
    iconColor: "icon-container-cyan",
    hoverColor: "hover-cyan"
  },
  {
    key: "reports",
    icon: FileText,
    label: "Reportes",
    description: "Analiza el desempeño de tus campañas",
    path: "/reports",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();
  const [, setLocation] = useLocation();

  // Filter quick actions based on dashboard config
  const dashboardConfig = (settings?.dashboardConfig as Record<string, boolean>) ?? {};
  const visibleActions = quickActions.filter(action => dashboardConfig[action.key] !== false);

  const statCards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads ?? 0,
      description: "Leads en el sistema",
      icon: Users,
      iconColor: "icon-container-blue",
    },
    {
      title: "Números WhatsApp",
      value: stats?.totalNumbers ?? 0,
      description: `${stats?.activeNumbers ?? 0} activos`,
      icon: Phone,
      iconColor: "icon-container-green",
    },
    {
      title: "Mensajes Hoy",
      value: stats?.messagesToday ?? 0,
      description: "Mensajes enviados",
      icon: MessageCircle,
      iconColor: "icon-container-purple",
    },
    {
      title: "Tasa de Conversión",
      value: `${stats?.conversionRate ?? 0}%`,
      description: "Leads ganados",
      icon: TrendingUp,
      iconColor: "icon-container-orange",
    },
  ];

  const warmupNumbers = (stats?.warmupNumbers ?? []) as WarmupNumber[];
  const countriesDistribution = (stats?.countriesDistribution ?? []) as CountryDistribution[];
  const recentLeads = (stats?.recentLeads ?? []) as RecentLead[];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido, {user?.name?.split(' ')[0] ?? 'Usuario'}
          </h1>
          <p className="text-muted-foreground">
            Aquí tienes un resumen de tu actividad
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="action-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`icon-container ${stat.iconColor}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warm-up and Status Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Warm-up Progress */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="icon-container icon-container-yellow">
                <Zap className="h-5 w-5" />
              </div>
              <span>Sistema de Warm-up</span>
            </CardTitle>
            <CardDescription>
              Progreso de calentamiento de números
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {warmupNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay números en proceso de warm-up
              </p>
            ) : (
              warmupNumbers.slice(0, 5).map((number: WarmupNumber) => (
                <div key={number.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{number.phoneNumber}</span>
                    <span className="text-muted-foreground">
                      Día {number.warmupDay}/28
                    </span>
                  </div>
                  <Progress
                    value={(number.warmupDay / 28) * 100}
                    className="h-2"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Límite: {number.dailyMessageLimit} msg/día</span>
                    <span>{number.messagesSentToday} enviados hoy</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Number Status Overview */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="icon-container icon-container-green">
                <Phone className="h-5 w-5" />
              </div>
              <span>Estado de Números</span>
            </CardTitle>
            <CardDescription>
              Distribución por estado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Activos</span>
                </div>
                <span className="font-semibold">{stats?.activeNumbers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">En Warm-up</span>
                </div>
                <span className="font-semibold">{stats?.warmingUpNumbers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Bloqueados</span>
                </div>
                <span className="font-semibold">{stats?.blockedNumbers ?? 0}</span>
              </div>
            </div>

            {/* Countries Distribution */}
            <div className="mt-6 pt-4 border-t border-border/50">
              <h4 className="text-sm font-medium mb-3">Distribución por País</h4>
              <div className="grid grid-cols-2 gap-2">
                {countriesDistribution.map((country: CountryDistribution) => (
                  <div
                    key={country.country}
                    className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm">{country.country}</span>
                    <span className="text-sm font-semibold">{country.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleActions.map((action) => (
            <div
              key={action.key}
              onClick={() => setLocation(action.path)}
              className={`action-card group ${action.hoverColor}`}
            >
              <div className="flex items-start justify-between">
                <div className={`icon-container ${action.iconColor}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold">
                  {action.label}
                </h3>
                <p className="text-sm mt-1 text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Leads Recientes</CardTitle>
          <CardDescription>
            Últimos leads agregados al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay leads recientes
              </p>
            ) : (
              recentLeads.map((lead: RecentLead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setLocation('/leads')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {lead.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`status-badge status-${lead.status}`}>
                      {lead.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {lead.country}
                    </p>
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
