import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Workflow, 
  MessageSquare, 
  Webhook, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Plus,
  ExternalLink,
  Copy,
  Phone,
  Zap,
  RefreshCw
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  connected: boolean;
  webhookUrl?: string;
  selectedChannel?: string;
}

const availableIntegrations: Omit<Integration, 'connected' | 'webhookUrl' | 'selectedChannel'>[] = [
  {
    id: "n8n",
    name: "n8n",
    description: "Automatiza flujos de trabajo con n8n. Conecta webhooks para disparar acciones automáticas.",
    icon: Workflow,
    color: "bg-orange-600",
  },
  {
    id: "chatwoot",
    name: "Chatwoot",
    description: "Integra tu bandeja de entrada de Chatwoot para gestionar conversaciones.",
    icon: MessageSquare,
    color: "bg-blue-600",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Conecta con miles de aplicaciones usando Zapier.",
    icon: Zap,
    color: "bg-orange-500",
  },
  {
    id: "webhook",
    name: "Webhook Personalizado",
    description: "Configura webhooks personalizados para integraciones custom.",
    icon: Webhook,
    color: "bg-purple-600",
  },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(
    availableIntegrations.map(int => ({ ...int, connected: false }))
  );
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Get WhatsApp numbers for channel selection
  const { data: numbersData } = trpc.whatsappNumbers.list.useQuery();
  const whatsappNumbers = numbersData ?? [];

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setWebhookUrl(integration.webhookUrl || "");
    setSelectedChannel(integration.selectedChannel || "");
    setIsConfiguring(true);
  };

  const handleSaveIntegration = () => {
    if (!selectedIntegration) return;

    if (!webhookUrl.trim()) {
      toast.error("Por favor ingresa la URL del webhook");
      return;
    }

    if (!selectedChannel) {
      toast.error("Por favor selecciona un canal de WhatsApp");
      return;
    }

    setIntegrations(prev => 
      prev.map(int => 
        int.id === selectedIntegration.id 
          ? { ...int, connected: true, webhookUrl, selectedChannel }
          : int
      )
    );

    toast.success(`${selectedIntegration.name} conectado exitosamente`);
    setIsConfiguring(false);
    setSelectedIntegration(null);
    setWebhookUrl("");
    setSelectedChannel("");
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrations(prev =>
      prev.map(int =>
        int.id === integrationId
          ? { ...int, connected: false, webhookUrl: undefined, selectedChannel: undefined }
          : int
      )
    );
    toast.success("Integración desconectada");
  };

  const handleToggle = (integrationId: string, enabled: boolean) => {
    if (!enabled) {
      handleDisconnect(integrationId);
    } else {
      const integration = integrations.find(int => int.id === integrationId);
      if (integration) {
        handleConnect(integration);
      }
    }
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada al portapapeles");
  };

  const getChannelName = (channelId: string) => {
    const number = whatsappNumbers.find(n => n.id.toString() === channelId);
    return number ? number.phoneNumber : channelId;
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
          <p className="text-muted-foreground">
            Conecta servicios externos para automatizar tu flujo de trabajo
          </p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id} className="glass-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`icon-container ${integration.color} text-white`}>
                    <integration.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {integration.name}
                      {integration.connected ? (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </div>
                <Switch
                  checked={integration.connected}
                  onCheckedChange={(checked) => handleToggle(integration.id, checked)}
                />
              </div>
              <CardDescription className="mt-2">
                {integration.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integration.connected ? (
                <div className="space-y-4">
                  {/* Webhook URL */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={integration.webhookUrl}
                        readOnly
                        className="text-xs font-mono bg-muted/50"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyWebhookUrl(integration.webhookUrl || "")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Selected Channel */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Canal Asignado</Label>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Phone className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">
                        {getChannelName(integration.selectedChannel || "")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(integration)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Probando conexión...")}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Probar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleConnect(integration)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Conectar {integration.name}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegration && (
                <>
                  <div className={`icon-container ${selectedIntegration.color} text-white`}>
                    <selectedIntegration.icon className="h-5 w-5" />
                  </div>
                  Configurar {selectedIntegration.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Configura la integración para automatizar tu flujo de trabajo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL del Webhook</Label>
              <Input
                id="webhook-url"
                placeholder="https://tu-servidor-n8n.com/webhook/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ingresa la URL del webhook de {selectedIntegration?.name} donde se enviarán los eventos
              </p>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label htmlFor="channel">Canal de WhatsApp</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un canal" />
                </SelectTrigger>
                <SelectContent>
                  {whatsappNumbers.length === 0 ? (
                    <SelectItem value="no-channels" disabled>
                      No hay canales disponibles
                    </SelectItem>
                  ) : (
                    whatsappNumbers.map((number) => (
                      <SelectItem key={number.id} value={number.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-green-500" />
                          <span>{number.phoneNumber}</span>
                          <Badge variant="outline" className="text-xs">
                            {number.country}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los eventos de este canal serán enviados al webhook configurado
              </p>
            </div>

            {/* Events to send */}
            <div className="space-y-2">
              <Label>Eventos a enviar</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Mensaje recibido",
                  "Lead creado",
                  "Lead actualizado",
                  "Campaña enviada",
                ].map((event) => (
                  <div
                    key={event}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Help Link */}
            {selectedIntegration?.id === "n8n" && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-start gap-2">
                  <Workflow className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-500">
                      ¿Necesitas ayuda con n8n?
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consulta nuestra guía de integración para configurar workflows automáticos.
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-orange-500 mt-1"
                      onClick={() => window.open("https://docs.n8n.io/", "_blank")}
                    >
                      Ver documentación
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveIntegration}>
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-purple-500" />
            ¿Cómo funcionan las integraciones?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                  1
                </div>
                <h4 className="font-medium">Configura el Webhook</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Ingresa la URL del webhook de tu servicio de automatización (n8n, Zapier, etc.)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">
                  2
                </div>
                <h4 className="font-medium">Selecciona el Canal</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Elige qué número de WhatsApp enviará eventos al webhook configurado
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold">
                  3
                </div>
                <h4 className="font-medium">Automatiza</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Los eventos del canal seleccionado se enviarán automáticamente a tu workflow
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
