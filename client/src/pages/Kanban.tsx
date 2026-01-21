import { useState } from "react";
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
  status: 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';
  country: string;
};

type BoardData = Record<string, Lead[]>;

const STATUSES = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  negotiation: "Negociación",
  won: "Ganado",
  lost: "Perdido",
} as const;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  contacted: "bg-yellow-100 text-yellow-800 border-yellow-200",
  qualified: "bg-purple-100 text-purple-800 border-purple-200",
  negotiation: "bg-indigo-100 text-indigo-800 border-indigo-200",
  won: "bg-green-100 text-green-800 border-green-200",
  lost: "bg-red-100 text-red-800 border-red-200",
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
  const { data: leadsByStatus, isLoading, refetch } = trpc.leads.getByStatus.useQuery();
  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      // toast.success("Estado actualizado");
      refetch();
    },
    onError: (err) => {
      toast.error("Error al mover: " + err.message);
      refetch(); // revert changes
    }
  });

  const [activeDragItem, setActiveDragItem] = useState<Lead | null>(null);

  // Sensores para detectar el arrastre
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // evita clicks accidentales
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Manejo del Drag & Drop
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current as Lead; // Pasamos datos en useSortable
    setActiveDragItem(lead);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    // Si soltamos sobre un contenedor (columna) diferente al original
    const activeLead = active.data.current as Lead;
    const overContainer = over.data.current?.sortable?.containerId || over.id; // contenedor destino

    // Si es columna válida y diferente al estado actual
    if (overContainer && Object.keys(STATUSES).includes(overContainer as string)) {
      if (activeLead.status !== overContainer) {
        // Actualizar en backend
        updateStatus.mutate({
          id: activeLead.id,
          status: overContainer as any
        });
        // Nota: Podríamos hacer actualización optimista aquí para UX instantánea
      }
    }
  };

  if (isLoading || !leadsByStatus) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">Cargando tablero...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h1>
          <p className="text-muted-foreground">Arrastra y suelta para gestionar tus leads.</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {Object.keys(STATUSES).map((statusKey) => (
              <KanbanColumn
                key={statusKey}
                id={statusKey}
                title={STATUSES[statusKey as keyof typeof STATUSES]}
                leads={(leadsByStatus as any)[statusKey] || []}
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
