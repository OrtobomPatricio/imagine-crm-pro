import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { 
  Plus, 
  MoreHorizontal,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Calendar,
  MessageCircle,
  Users
} from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

interface Campaign {
  id: number;
  name: string;
  message: string;
  status: CampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalRecipients: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  createdAt: Date;
}

const statusConfig: Record<CampaignStatus, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-800', icon: Clock },
  scheduled: { label: 'Programada', className: 'bg-blue-100 text-blue-800', icon: Calendar },
  running: { label: 'En Curso', className: 'bg-green-100 text-green-800', icon: Play },
  paused: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800', icon: Pause },
  completed: { label: 'Completada', className: 'bg-purple-100 text-purple-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function Campaigns() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message: '',
  });

  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      setIsAddDialogOpen(false);
      setNewCampaign({ name: '', message: '' });
      toast.success('Campaña creada exitosamente');
    },
    onError: (error) => {
      toast.error('Error al crear la campaña: ' + error.message);
    },
  });

  const updateStatus = trpc.campaigns.updateStatus.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success('Estado actualizado');
    },
  });

  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success('Campaña eliminada');
    },
  });

  const handleCreateCampaign = () => {
    if (!newCampaign.name || !newCampaign.message) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }
    createCampaign.mutate({
      name: newCampaign.name,
      message: newCampaign.message,
    });
  };

  const typedCampaigns = (campaigns ?? []) as Campaign[];

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeliveryRate = (campaign: Campaign) => {
    if (campaign.messagesSent === 0) return 0;
    return Math.round((campaign.messagesDelivered / campaign.messagesSent) * 100);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campañas</h1>
          <p className="text-muted-foreground">
            Gestiona tus campañas de mensajería masiva
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Campaña
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Campaña</DialogTitle>
              <DialogDescription>
                Configura tu campaña de mensajería masiva.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre de la Campaña *</Label>
                <Input
                  id="name"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Promoción de Enero"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Mensaje *</Label>
                <Textarea
                  id="message"
                  value={newCampaign.message}
                  onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                  placeholder="Escribe el mensaje que se enviará a los destinatarios..."
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  {newCampaign.message.length} caracteres
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCampaign} disabled={createCampaign.isPending}>
                {createCampaign.isPending ? 'Creando...' : 'Crear Campaña'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campañas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedCampaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Curso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {typedCampaigns.filter(c => c.status === 'running').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Programadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {typedCampaigns.filter(c => c.status === 'scheduled').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {typedCampaigns.filter(c => c.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Campañas</CardTitle>
          <CardDescription>
            {typedCampaigns.length} campañas en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typedCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No hay campañas</h3>
              <p className="text-muted-foreground mt-2">
                Crea tu primera campaña para comenzar
              </p>
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Campaña
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Destinatarios</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Tasa de Entrega</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedCampaigns.map((campaign) => {
                    const config = statusConfig[campaign.status];
                    const StatusIcon = config.icon;
                    const progress = campaign.totalRecipients > 0 
                      ? Math.round((campaign.messagesSent / campaign.totalRecipients) * 100)
                      : 0;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {campaign.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={config.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {campaign.totalRecipients}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            getDeliveryRate(campaign) >= 90 ? 'text-green-600' :
                            getDeliveryRate(campaign) >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {getDeliveryRate(campaign)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(campaign.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {campaign.status === 'draft' && (
                                <DropdownMenuItem
                                  onClick={() => updateStatus.mutate({ 
                                    id: campaign.id, 
                                    status: 'running' 
                                  })}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Iniciar
                                </DropdownMenuItem>
                              )}
                              {campaign.status === 'running' && (
                                <DropdownMenuItem
                                  onClick={() => updateStatus.mutate({ 
                                    id: campaign.id, 
                                    status: 'paused' 
                                  })}
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar
                                </DropdownMenuItem>
                              )}
                              {campaign.status === 'paused' && (
                                <DropdownMenuItem
                                  onClick={() => updateStatus.mutate({ 
                                    id: campaign.id, 
                                    status: 'running' 
                                  })}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Reanudar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteCampaign.mutate({ id: campaign.id })}
                              >
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
