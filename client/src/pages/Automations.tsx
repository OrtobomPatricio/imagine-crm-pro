import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function Automations() {
    const { data: workflows, refetch } = trpc.automations.list.useQuery();
    const createMutation = trpc.automations.create.useMutation({
        onSuccess: () => {
            toast.success("Automatización creada");
            setOpen(false);
            refetch();
        }
    });
    const toggleMutation = trpc.automations.toggle.useMutation({
        onSuccess: () => refetch()
    });
    const deleteMutation = trpc.automations.delete.useMutation({
        onSuccess: () => {
            toast.success("Eliminado");
            refetch();
        }
    });

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState("lead_created");

    const handleCreate = () => {
        createMutation.mutate({
            name,
            triggerType: trigger as any,
            conditions: {}, // Placeholder for advanced condition builder
            actions: [],    // Placeholder for advanced action builder
        });
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Automatizaciones</h1>
                        <p className="text-muted-foreground">Motor de reglas "Si pulsa esto, haz aquello".</p>
                    </div>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Nueva Regla
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Automatización</DialogTitle>
                                <DialogDescription>
                                    Define qué evento disparará esta regla.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nombre de la Regla</Label>
                                    <Input placeholder="Ej: Bienvenida a Leads Nuevos" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Disparador (Trigger)</Label>
                                    <Select value={trigger} onValueChange={setTrigger}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lead_created">Nuevo Lead Creado</SelectItem>
                                            <SelectItem value="status_changed">Cambio de Estado</SelectItem>
                                            <SelectItem value="message_received">Mensaje Recibido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreate}>Crear</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workflows?.map((wf) => (
                        <Card key={wf.id} className="overflow-hidden">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-base font-semibold">
                                        <div className="flex items-center gap-2">
                                            <Zap className={`h-4 w-4 ${wf.isActive ? 'text-yellow-500' : 'text-gray-400'}`} />
                                            {wf.name}
                                        </div>
                                    </CardTitle>
                                </div>
                                <Switch
                                    checked={wf.isActive}
                                    onCheckedChange={(checked) => toggleMutation.mutate({ id: wf.id, isActive: checked })}
                                />
                            </CardHeader>
                            <CardContent>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    <p>Trigger: <span className="font-mono bg-muted px-1 rounded">{wf.triggerType}</span></p>
                                    <p className="mt-1">Acciones: {(wf.actions as any[])?.length || 0}</p>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: wf.id })}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
