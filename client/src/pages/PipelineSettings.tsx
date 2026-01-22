import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Settings2, GripVertical, ArrowUp, ArrowDown, Save } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function PipelineSettings() {
    const { data: pipelines, isLoading, refetch } = trpc.pipelines.list.useQuery();
    const createPipeline = trpc.pipelines.create.useMutation({
        onSuccess: () => {
            toast.success("Pipeline creado");
            refetch();
            setIsOpen(false);
            setNewPipelineName("");
        }
    });
    const updateStage = trpc.pipelines.updateStage.useMutation({
        onSuccess: () => {
            refetch();
            toast.success("Etapa actualizada");
        },
        onError: (error) => toast.error(error.message),
    });

    const [isOpen, setIsOpen] = useState(false);
    const [newPipelineName, setNewPipelineName] = useState("");
    const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
    const [stageEdits, setStageEdits] = useState<Record<number, { name: string; color: string; order: number }>>({});

    const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId) || pipelines?.[0];

    const handleCreate = () => {
        if (!newPipelineName) return;
        createPipeline.mutate({ name: newPipelineName });
    };

    useEffect(() => {
        if (!selectedPipeline) return;
        const nextEdits: Record<number, { name: string; color: string; order: number }> = {};
        selectedPipeline.stages.forEach((stage) => {
            nextEdits[stage.id] = {
                name: stage.name,
                color: stage.color || "#e2e8f0",
                order: stage.order,
            };
        });
        setStageEdits(nextEdits);
    }, [selectedPipeline]);

    const handleStageChange = (stageId: number, key: "name" | "color", value: string) => {
        setStageEdits((prev) => ({
            ...prev,
            [stageId]: {
                ...prev[stageId],
                [key]: value,
            },
        }));
    };

    const handleSaveStage = (stageId: number) => {
        const draft = stageEdits[stageId];
        if (!draft?.name) {
            toast.error("El nombre no puede estar vacío");
            return;
        }
        updateStage.mutate({
            id: stageId,
            name: draft.name,
            color: draft.color,
            order: draft.order,
        });
    };

    const handleSwapOrder = async (stageId: number, direction: "up" | "down") => {
        if (!selectedPipeline) return;
        const stages = [...selectedPipeline.stages].sort((a, b) => a.order - b.order);
        const index = stages.findIndex((stage) => stage.id === stageId);
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || swapIndex < 0 || swapIndex >= stages.length) return;

        const current = stages[index];
        const target = stages[swapIndex];

        try {
            await updateStage.mutateAsync({ id: current.id, order: target.order });
            await updateStage.mutateAsync({ id: target.id, order: current.order });
            refetch();
        } catch (error: any) {
            toast.error(error?.message ?? "No se pudo reordenar");
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-full items-center justify-center">Cargando...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configuración de Pipelines</h1>
                        <p className="text-muted-foreground">Gestiona tus embudos de venta y etapas.</p>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Nuevo Pipeline
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Pipeline</DialogTitle>
                                <DialogDescription>Genera un nuevo embudo de ventas vacío o con etapas por defecto.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Nombre</Label>
                                    <Input
                                        id="name"
                                        value={newPipelineName}
                                        onChange={(e) => setNewPipelineName(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreate} disabled={createPipeline.isPending}>Crear</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Pipelines</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            {pipelines?.map(pipeline => (
                                <Button
                                    key={pipeline.id}
                                    variant={selectedPipeline?.id === pipeline.id ? "secondary" : "ghost"}
                                    className="w-full justify-start"
                                    onClick={() => setSelectedPipelineId(pipeline.id)}
                                >
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    {pipeline.name}
                                    {pipeline.isDefault && <Badge variant="outline" className="ml-auto text-[10px]">Default</Badge>}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Etapas del Pipeline: {selectedPipeline?.name}</CardTitle>
                            <CardDescription>Define los pasos de tu proceso de ventas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {selectedPipeline?.stages.map((stage) => (
                                    <div key={stage.id} className="flex items-center gap-2 rounded-md border p-3 bg-card">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        <input
                                            type="color"
                                            value={stageEdits[stage.id]?.color ?? stage.color ?? "#e2e8f0"}
                                            onChange={(e) => handleStageChange(stage.id, "color", e.target.value)}
                                            className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent"
                                            aria-label="Color de la etapa"
                                        />
                                        <Input
                                            value={stageEdits[stage.id]?.name ?? stage.name}
                                            onChange={(e) => handleStageChange(stage.id, "name", e.target.value)}
                                            className="h-8 w-[200px]"
                                        />
                                        <div className="ml-auto flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSwapOrder(stage.id, "up")}
                                                    aria-label="Mover arriba"
                                                >
                                                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSwapOrder(stage.id, "down")}
                                                    aria-label="Mover abajo"
                                                >
                                                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                            <Badge variant="secondary">{stage.type}</Badge>
                                            <Button variant="ghost" size="icon" onClick={() => handleSaveStage(stage.id)}>
                                                <Save className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-sm text-muted-foreground">
                                * Los cambios se guardan por etapa. Usa las flechas para reordenar.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
