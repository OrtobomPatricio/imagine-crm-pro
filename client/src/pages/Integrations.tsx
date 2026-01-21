import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MessageCircle,
  Mail,
  Database,
  Bot,
  MapPin,
  Key,
  Workflow,
  AlertCircle
} from "lucide-react";
import FacebookSettings from "@/components/FacebookSettings";

export default function Integrations() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
          <p className="text-muted-foreground">
            Conectá tus herramientas favoritas y configurá los servicios externos.
          </p>
        </div>

        <Tabs defaultValue="messaging" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="messaging">Mensajería</TabsTrigger>
            <TabsTrigger value="automation">Automatización</TabsTrigger>
            <TabsTrigger value="system">Sistema & IA</TabsTrigger>
          </TabsList>

          {/* MESSAGING TAB */}
          <TabsContent value="messaging" className="space-y-4 mt-4">
            <WhatsAppList />
            <FacebookSettings />
            <SmtpSettings />
          </TabsContent>

          {/* AUTOMATION TAB */}
          <TabsContent value="automation" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="w-5 h-5" />
                  n8n & Webhooks
                </CardTitle>
                <CardDescription>
                  Dispará automatizaciones cuando ocurran eventos en el CRM.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg bg-muted/20 text-center text-muted-foreground text-sm">
                  Próximamente: Integración nativa con n8n y Zapier.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SYSTEM TAB */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AiSettings />
              <StorageSettings />
              <MapsSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS ---

function WhatsAppList() {
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
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          WhatsApp Cloud API
        </CardTitle>
        <CardDescription>
          Gestiona los números conectados y sus credenciales de Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {numbersQuery.isLoading && <div className="text-sm">Cargando...</div>}
        <div className="grid gap-4">
          {numbersQuery.data?.map((num) => (
            <div key={num.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{num.phoneNumber}</span>
                  {num.displayName && <span className="text-muted-foreground">({num.displayName})</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${num.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">{num.isConnected ? "Conectado" : "Desconectado"}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setEditingId(num.id); setOpen(true); }}>
                <Key className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </div>
          ))}

          {numbersQuery.data?.length === 0 && (
            <div className="flex items-center gap-2 p-4 text-sm text-yellow-600 bg-yellow-50 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              No hay números registrados. Contacta a soporte para agregar uno.
            </div>
          )}
        </div>

        {/* Dialog for editing credentials */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar API WhatsApp</DialogTitle>
              <DialogDescription>Credenciales del portal de desarrolladores de Meta.</DialogDescription>
            </DialogHeader>
            {selectedNumber && (
              <WhatsAppCredentialForm
                numberId={selectedNumber.id}
                onSubmit={(data) => updateCreds.mutate({ id: selectedNumber.id, ...data })}
                isLoading={updateCreds.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function WhatsAppCredentialForm({ numberId, onSubmit, isLoading }: { numberId: number, onSubmit: (data: any) => void, isLoading: boolean }) {
  const detailsQuery = trpc.whatsappNumbers.getById.useQuery({ id: numberId }, { enabled: !!numberId });
  const [formData, setFormData] = useState({ phoneNumberId: "", businessAccountId: "", accessToken: "" });

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
    <div className="space-y-4 py-2">
      <div className="grid gap-2">
        <Label>Phone Number ID</Label>
        <Input value={formData.phoneNumberId} onChange={(e) => setFormData(p => ({ ...p, phoneNumberId: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label>Business Account ID</Label>
        <Input value={formData.businessAccountId} onChange={(e) => setFormData(p => ({ ...p, businessAccountId: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label>Access Token (Permanente)</Label>
        <Input type="password" value={formData.accessToken} onChange={(e) => setFormData(p => ({ ...p, accessToken: e.target.value }))} placeholder={detailsQuery.data?.hasAccessToken ? "Guardado" : "EAAG..."} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function SmtpSettings() {
  const query = trpc.settings.get.useQuery();
  const utils = trpc.useContext();
  const updateSmtp = trpc.settings.updateSmtpConfig.useMutation({
    onSuccess: () => { toast.success("SMTP guardado"); utils.settings.get.invalidate(); }
  });
  const testSmtp = trpc.settings.verifySmtpTest.useMutation({
    onSuccess: () => toast.success("Email enviado"),
    onError: (e) => toast.error(e.message)
  });

  const [form, setForm] = useState({ host: "", port: 587, secure: false, user: "", pass: "", from: "" });

  useEffect(() => {
    if (query.data?.smtpConfig) setForm(query.data.smtpConfig as any);
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> SMTP (Correo)</CardTitle>
        <CardDescription>Para enviar invitaciones y alertas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Host</Label>
            <Input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" />
          </div>
          <div className="grid gap-2">
            <Label>Puerto</Label>
            <Input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: Number(e.target.value) }))} />
          </div>
          <div className="grid gap-2">
            <Label>Usuario</Label>
            <Input value={form.user} onChange={e => setForm(p => ({ ...p, user: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input type="password" value={form.pass} onChange={e => setForm(p => ({ ...p, pass: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>From</Label>
            <Input value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Switch checked={form.secure} onCheckedChange={c => setForm(p => ({ ...p, secure: c }))} />
            <Label>SSL/TLS</Label>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => {
            const email = prompt("Email de prueba:");
            if (email) testSmtp.mutate({ email });
          }}>Probar</Button>
          <Button onClick={() => updateSmtp.mutate(form)} disabled={updateSmtp.isPending}>Guardar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageSettings() {
  const updateStorage = trpc.settings.updateStorageConfig.useMutation({
    onSuccess: () => toast.success("Storage config guardado")
  });
  const [form, setForm] = useState({
    provider: "s3" as "s3" | "forge", bucket: "", region: "", accessKey: "", secretKey: "", endpoint: "", publicUrl: ""
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Almacenamiento (S3)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Provider</Label>
          <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="s3">AWS S3 / Compatible</SelectItem>
              <SelectItem value="forge">Forge (Built-in)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.provider === 's3' && (
          <>
            <div className="grid gap-2"><Label>Bucket</Label><Input value={form.bucket} onChange={e => setForm(p => ({ ...p, bucket: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Region</Label><Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Endpoint</Label><Input value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Access Key</Label><Input value={form.accessKey} onChange={e => setForm(p => ({ ...p, accessKey: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Secret Key</Label><Input type="password" value={form.secretKey} onChange={e => setForm(p => ({ ...p, secretKey: e.target.value }))} /></div>
          </>
        )}
        <Button onClick={() => updateStorage.mutate(form)} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}

function AiSettings() {
  const updateAi = trpc.settings.updateAiConfig.useMutation({ onSuccess: () => toast.success("AI config guardado") });
  const [form, setForm] = useState({ provider: "openai" as "openai" | "anthropic", apiKey: "", model: "gpt-4-turbo" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5" /> Inteligencia Artificial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Proveedor</Label>
          <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Modelo (Default)</Label><Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
        <Button onClick={() => updateAi.mutate(form)} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}

function MapsSettings() {
  const updateMaps = trpc.settings.updateMapsConfig.useMutation({ onSuccess: () => toast.success("Maps config guardado") });
  const [apiKey, setApiKey] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Google Maps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>API Key</Label>
          <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..." />
        </div>
        <Button onClick={() => updateMaps.mutate({ apiKey })} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}
