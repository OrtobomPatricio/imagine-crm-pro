import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// -- Tipos --
type Lead = {
  id: number;
  name: string;
  phone: string;
  status: string; // kept for legacy display if needed, but we rely on pipelineStageId
  pipelineStageId?: number | null;
  country: string;
};

// -- Componente Tarjeta (Sortable Item) --
function SortableItem({ lead }: { lead: Lead }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { ...lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-sm truncate pr-2">{lead.name}</h4>
            <Badge variant="outline" className="text-[10px] px-1 h-5">
              {lead.country}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{lead.phone}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// -- Componente Columna --
function KanbanColumn({ id, title, leads }: { id: string; title: string; leads: Lead[] }) {
  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg p-2 min-w-[280px] w-[280px]">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="font-bold text-sm text-foreground/80">{title}</h3>
        <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
      </div>
      <ScrollArea className="flex-1">
        <SortableContext
          id={id}
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="px-1 min-h-[50px]">
            {leads.map((lead) => (
              <SortableItem key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

// -- Página Principal --
export default function KanbanBoard() {
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null);

  // Fetch pipelines
  const { data: pipelines, isLoading: isLoadingPipelines } = trpc.pipelines.list.useQuery();

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !activePipelineId) {
      const def = pipelines.find((p: any) => p.isDefault) || pipelines[0];
      setActivePipelineId(def.id);
    }
  }, [pipelines, activePipelineId]);

  // Fetch leads for active pipeline
  const { data: leadsByStage, isLoading: isLoadingLeads, refetch } = trpc.leads.getByPipeline.useQuery(
    { pipelineId: activePipelineId ?? undefined },
    { enabled: !!activePipelineId }
  );

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      // toast.success("Estado actualizado");
      refetch();
    },
    onError: (err) => {
      toast.error("Error al mover: " + err.message);
      refetch();
    }
  });

  const [activeDragItem, setActiveDragItem] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activePipeline = pipelines?.find(p => p.id === activePipelineId);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current as Lead;
    setActiveDragItem(lead);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeLead = active.data.current as Lead;
    // over.id should be the stageId (column)
    const overStageId = Number(over.data.current?.sortable?.containerId || over.id);

    if (overStageId && activePipeline?.stages.find(s => s.id === overStageId)) {
      if (activeLead.pipelineStageId !== overStageId) {
        updateStatus.mutate({
          id: activeLead.id,
          pipelineStageId: overStageId
        });
      }
    }
  };

  if (isLoadingPipelines || (activePipelineId && isLoadingLeads)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">Cargando tablero...</div>
      </DashboardLayout>
    );
  }

  // Derived columns from active pipeline
  const columns = activePipeline?.stages || [];

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col p-4">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h1>
            <p className="text-muted-foreground">
              {activePipeline?.name || "Cargando..."}
            </p>
          </div>
          {/* Pipeline Selector could go here */}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {columns.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={String(stage.id)} // DnD expects string IDs often, but we parse it back
                title={stage.name}
                leads={(leadsByStage as any)?.[stage.id] || []}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
            {activeDragItem ? <SortableItem lead={activeDragItem} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DashboardLayout>
  );
}
