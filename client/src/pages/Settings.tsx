import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { AlertCircle, Key, Plus, Facebook } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FacebookSettings from "@/components/FacebookSettings";

const TZ_OPTIONS = [
  "America/Asuncion",
  "America/La_Paz",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Panama",
];

const LANG_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const CURRENCY_OPTIONS = [
  { value: "PYG", label: "Guaraní (PYG)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "ARS", label: "Peso (ARS)" },
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "BRL", label: "Real (BRL)" },
  { value: "MXN", label: "Peso (MXN)" },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "agent", label: "Agente" },
  { value: "viewer", label: "Solo lectura" },
] as const;

export default function Settings() {
  return (
    <DashboardLayout>
      <SettingsContent />
    </DashboardLayout>
  );
}

function SettingsContent() {
  const { role } = usePermissions();

  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateGeneral = trpc.settings.updateGeneral.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success("Configuración guardada");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePerms = trpc.settings.updatePermissionsMatrix.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success("Permisos actualizados");
    },
    onError: (e) => toast.error(e.message),
  });

  const teamQuery = trpc.team.listUsers.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateRole = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      teamQuery.refetch();
      toast.success("Rol actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const setActive = trpc.team.setActive.useMutation({
    onSuccess: () => {
      teamQuery.refetch();
      toast.success("Usuario actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
    timezone: "America/Asuncion",
    language: "es",
    currency: "PYG",
    slotMinutes: 15,
    maxPerSlot: 6,
    allowCustomTime: true,
  });

  const initialMatrix = useMemo(() => {
    return settingsQuery.data?.permissionsMatrix ?? {
      owner: ["*"],
      admin: ["settings.*"],
      supervisor: ["dashboard.view"],
      agent: ["dashboard.view"],
      viewer: ["dashboard.view"],
    };
  }, [settingsQuery.data]);

  const [matrixText, setMatrixText] = useState("{");

  useEffect(() => {
    if (!settingsQuery.data) return;

    setForm({
      companyName: settingsQuery.data.companyName ?? "",
      logoUrl: settingsQuery.data.logoUrl ?? "",
      timezone: settingsQuery.data.timezone ?? "America/Asuncion",
      language: settingsQuery.data.language ?? "es",
      currency: settingsQuery.data.currency ?? "PYG",
      slotMinutes: settingsQuery.data.scheduling?.slotMinutes ?? 15,
      maxPerSlot: settingsQuery.data.scheduling?.maxPerSlot ?? 6,
      allowCustomTime: settingsQuery.data.scheduling?.allowCustomTime ?? true,
    });

    setMatrixText(JSON.stringify(initialMatrix, null, 2));
  }, [settingsQuery.data, initialMatrix]);

  const saveGeneral = () => {
    updateGeneral.mutate({
      companyName: form.companyName,
      logoUrl: form.logoUrl ? form.logoUrl : null,
      timezone: form.timezone,
      language: form.language,
      currency: form.currency,
      scheduling: {
        slotMinutes: form.slotMinutes,
        maxPerSlot: form.maxPerSlot,
        allowCustomTime: form.allowCustomTime,
      },
    });
  };

  const saveMatrix = () => {
    try {
      const parsed = JSON.parse(matrixText);
      updatePerms.mutate({ permissionsMatrix: parsed });
    } catch {
      toast.error("JSON inválido en permisos");
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // If not allowed, show friendly message
  if (settingsQuery.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>
            No tenés permisos para acceder a esta sección
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Personalizá todo: branding, agenda, roles y permisos
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Usuarios</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="connections">Conexiones API</TabsTrigger>
          <TabsTrigger value="facebook">Facebook</TabsTrigger>
          <TabsTrigger value="perms" disabled={role !== "owner"}>Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Nombre, logo y preferencias globales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Nombre de la empresa</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="Mi Empresa"
                />
              </div>

              <div className="grid gap-2">
                <Label>Logo (URL)</Label>
                <Input
                  value={form.logoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Zona horaria</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {TZ_OPTIONS.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Idioma</Label>
                  <Select
                    value={form.language}
                    onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANG_OPTIONS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Moneda</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveGeneral} disabled={updateGeneral.isPending}>
                  {updateGeneral.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardConfigEditor />
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <ConnectionsSettings />
        </TabsContent>

        <TabsContent value="facebook" className="space-y-4">
          <FacebookSettings />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Usuarios y roles</CardTitle>
                <CardDescription>
                  Asigná Admin, Supervisor, Agente o Solo lectura
                </CardDescription>
              </div>
              <AddUserDialog onSuccess={() => teamQuery.refetch()} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(teamQuery.data ?? []).map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name ?? "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground truncate">{u.email ?? u.openId}</p>
                      <p className="text-xs text-muted-foreground">Último login: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "-"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Select
                        value={u.role}
                        onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as any })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={(v) => setActive.mutate({ userId: u.id, isActive: v })}
                        />
                        <span className="text-sm">Activo</span>
                      </div>
                    </div>
                  </div>
                ))}

                {teamQuery.isLoading && (
                  <div className="text-sm text-muted-foreground">Cargando usuarios...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permisos avanzados</CardTitle>
              <CardDescription>
                Define qué puede hacer cada rol en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionsMatrixEditor
                initialMatrix={initialMatrix}
                onSave={(m) => updatePerms.mutate({ permissionsMatrix: m })}
                isLoading={updatePerms.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardConfigEditor() {
  const query = trpc.settings.get.useQuery();
  const utils = trpc.useContext();
  const mutation = trpc.settings.updateDashboardConfig.useMutation({
    onSuccess: () => {
      toast.success("Dashboard actualizado");
      utils.settings.get.invalidate();
    }
  });

  const [config, setConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (query.data?.dashboardConfig) {
      setConfig(query.data.dashboardConfig as Record<string, boolean>);
    }
  }, [query.data]);

  // Default actions list (mirrored from Dashboard.tsx - ideally shared)
  const actions = [
    { key: "leads", label: "Gestionar Leads" },
    { key: "campaigns", label: "Crear Campaña" },
    { key: "conversations", label: "Conversaciones" },
    { key: "attendants", label: "Atendentes" },
    { key: "health", label: "Salud de Cuentas" },
    { key: "whatsapp", label: "Cuentas WhatsApp" },
    { key: "integrations", label: "Integraciones" },
    { key: "kanban", label: "Kanban Board" },
    { key: "commissions", label: "Comisiones" },
    { key: "goals", label: "Metas de Vendas" },
    { key: "achievements", label: "Logros" },
    { key: "warmup", label: "Warm-up" },
    { key: "analytics", label: "Analytics" },
    { key: "scheduling", label: "Agendamiento" },
    { key: "monitoring", label: "Monitoreo en Vivo" },
    { key: "reports", label: "Reportes" },
  ];

  const handleToggle = (key: string, val: boolean) => {
    const next = { ...config, [key]: val };
    setConfig(next);
    mutation.mutate(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalizar Dashboard</CardTitle>
        <CardDescription>Oculta o muestra las tarjetas de acceso rápido.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map(action => (
            <div key={action.key} className="flex items-center gap-2 border p-3 rounded-lg">
              <Switch
                checked={config[action.key] !== false} // Default true
                onCheckedChange={(c) => handleToggle(action.key, c)}
              />
              <span className="text-sm font-medium">{action.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionsSettings() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const numbersQuery = trpc.whatsappNumbers.list.useQuery();

  const updateCreds = trpc.whatsappNumbers.updateCredentials.useMutation({
    onSuccess: () => {
      toast.success("Credenciales actualizadas");
      setOpen(false);
      setEditingId(null);
      numbersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedNumber = numbersQuery.data?.find((n) => n.id === editingId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexiones WhatsApp</CardTitle>
        <CardDescription>
          Gestiona las credenciales de la API de WhatsApp Cloud para cada número.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {numbersQuery.isLoading && <div className="text-sm">Cargando números...</div>}

        <div className="grid gap-4">
          {numbersQuery.data?.map((num) => (
            <div
              key={num.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{num.phoneNumber}</span>
                  {num.displayName && <span className="text-muted-foreground">({num.displayName})</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${num.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">
                    {num.isConnected ? "Conectado" : "Desconectado"}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{num.country}</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(num.id);
                  setOpen(true);
                }}
              >
                <Key className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </div>
          ))}
        </div>

        {numbersQuery.data?.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sin números</AlertTitle>
            <AlertDescription>
              No hay números de WhatsApp registrados. Contacta a soporte para agregar uno.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configurar API WhatsApp</DialogTitle>
            <DialogDescription>
              Ingresa los datos del Meta for Developers dashboard.
            </DialogDescription>
          </DialogHeader>

          {selectedNumber && (
            <CredentialForm
              numberId={selectedNumber.id}
              onSubmit={(data) => updateCreds.mutate({ id: selectedNumber.id, ...data })}
              isLoading={updateCreds.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CredentialForm({ numberId, onSubmit, isLoading }: { numberId: number, onSubmit: (data: any) => void, isLoading: boolean }) {
  const detailsQuery = trpc.whatsappNumbers.getById.useQuery({ id: numberId }, {
    enabled: !!numberId,
    refetchOnWindowFocus: false
  });

  const [formData, setFormData] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
  });

  useEffect(() => {
    if (detailsQuery.data) {
      setFormData({
        phoneNumberId: detailsQuery.data.phoneNumberId || "",
        businessAccountId: detailsQuery.data.businessAccountId || "",
        accessToken: "",
      });
    }
  }, [detailsQuery.data]);

  return (
    <div className="space-y-4 py-4">
      {detailsQuery.isLoading ? (
        <div className="text-center py-4">Cargando datos...</div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>Phone Number ID</Label>
            <Input
              value={formData.phoneNumberId}
              onChange={(e) => setFormData(p => ({ ...p, phoneNumberId: e.target.value }))}
              placeholder="Ej: 1056..."
            />
          </div>

          <div className="grid gap-2">
            <Label>WhatsApp Business Account ID</Label>
            <Input
              value={formData.businessAccountId}
              onChange={(e) => setFormData(p => ({ ...p, businessAccountId: e.target.value }))}
              placeholder="Ej: 1023..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Access Token (Permanente)</Label>
            <Input
              type="password"
              value={formData.accessToken}
              onChange={(e) => setFormData(p => ({ ...p, accessToken: e.target.value }))}
              placeholder={detailsQuery.data?.hasAccessToken ? "•••••••• (Guardado)" : "EAAG..."}
            />
            <p className="text-[10px] text-muted-foreground">
              Dejalo vacío para mantener el token actual.
            </p>
          </div>

          <div className="pt-2">
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded border">
              <strong>Webhook Callback:</strong> <br />
              <span className="font-mono select-all">https://{window.location.host}/api/whatsapp/webhook</span>
              <br /><br />
              <strong>Verify Token:</strong> <br />
              <span className="font-mono select-all">happy-crm-token</span>
            </div>
          </div>
        </>
      )}

      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={isLoading || detailsQuery.isLoading}>
          {isLoading ? "Guardando..." : "Guardar Credenciales"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AddUserDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as "admin" | "supervisor" | "agent" | "viewer",
  });

  const createUser = trpc.team.create.useMutation({
    onSuccess: () => {
      toast.success("Usuario creado exitosamente");
      setOpen(false);
      setFormData({ name: "", email: "", password: "", role: "agent" });
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Complete todos los campos requeridos");
      return;
    }
    createUser.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Creá un nuevo acceso para tu equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="Juan Pérez"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="juan@empresa.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div className="grid gap-2">
            <Label>Rol</Label>
            <Select
              value={formData.role}
              onValueChange={(v) => setFormData(p => ({ ...p, role: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="viewer">Solo lectura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createUser.isPending}>
            {createUser.isPending ? "Creando..." : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsMatrixEditor({
  initialMatrix,
  onSave,
  isLoading
}: {
  initialMatrix: Record<string, string[]>,
  onSave: (m: Record<string, string[]>) => void,
  isLoading: boolean
}) {
  const [matrix, setMatrix] = useState(initialMatrix);

  // Sync state if initial changes (e.g. fetch finishes)
  useEffect(() => {
    setMatrix(initialMatrix);
  }, [initialMatrix]);

  const ROLES = ["admin", "supervisor", "agent", "viewer"] as const;
  const DOMAINS = [
    { key: "dashboard", label: "Dashboard" },
    { key: "leads", label: "Leads" },
    { key: "kanban", label: "Kanban" },
    { key: "chat", label: "Chat" },
    { key: "scheduling", label: "Agenda" },
    { key: "monitoring", label: "Monitoreo" },
    { key: "analytics", label: "Analíticas" },
    { key: "reports", label: "Reportes" },
    { key: "integrations", label: "Integraciones" },
    { key: "settings", label: "Configuración" },
    { key: "users", label: "Usuarios" },
  ];

  const togglePermission = (role: string, domainKey: string, checked: boolean) => {
    setMatrix(prev => {
      const current = new Set(prev[role] || []);
      const wildcard = `${domainKey}.*`;
      const view = `${domainKey}.view`;

      if (checked) {
        current.add(wildcard);
        current.delete(view);
      } else {
        current.delete(wildcard);
        current.delete(view);
      }

      return { ...prev, [role]: Array.from(current) };
    });
  };

  const hasPermission = (role: string, domainKey: string) => {
    const permissions = matrix[role] || [];
    return permissions.includes(`${domainKey}.*`) || permissions.includes("*");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Módulo</TableHead>
              {ROLES.map(role => (
                <TableHead key={role} className="text-center capitalize">
                  {role === 'agent' ? 'Agente' : role}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DOMAINS.map((domain) => (
              <TableRow key={domain.key}>
                <TableCell className="font-medium">{domain.label}</TableCell>
                {ROLES.map(role => (
                  <TableCell key={role} className="text-center flex align-center items-center justify-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={hasPermission(role, domain.key)}
                        onCheckedChange={(c) => togglePermission(role, domain.key, c as boolean)}
                      />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onSave(matrix)} disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}


