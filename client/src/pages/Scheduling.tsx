import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  Phone, 
  Mail,
  Settings,
  X,
  Edit,
  Trash2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export default function Scheduling() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDayViewOpen, setIsDayViewOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isReasonsDialogOpen, setIsReasonsDialogOpen] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [newReasonColor, setNewReasonColor] = useState("#3b82f6");
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reasonId, setReasonId] = useState<string>("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: appointments = [], refetch: refetchAppointments } = trpc.scheduling.list.useQuery();
  const { data: reasons = [], refetch: refetchReasons } = trpc.scheduling.listReasons.useQuery();
  const { data: schedRules } = trpc.settings.getScheduling.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createAppointment = trpc.scheduling.create.useMutation({
    onSuccess: () => {
      toast.success("Cita agendada correctamente");
      refetchAppointments();
      resetForm();
      setIsNewAppointmentOpen(false);
    },
    onError: (error) => {
      toast.error("Error al agendar: " + error.message);
    },
  });

  const deleteAppointment = trpc.scheduling.delete.useMutation({
    onSuccess: () => {
      toast.success("Cita eliminada");
      refetchAppointments();
    },
  });

  const createReason = trpc.scheduling.createReason.useMutation({
    onSuccess: () => {
      toast.success("Motivo creado");
      refetchReasons();
      setNewReason("");
      setNewReasonColor("#3b82f6");
    },
  });

  const deleteReason = trpc.scheduling.deleteReason.useMutation({
    onSuccess: () => {
      toast.success("Motivo eliminado");
      refetchReasons();
    },
  });

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setReasonId("");
    setAppointmentTime("");
    setNotes("");
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of week offset
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, typeof appointments> = {};
    appointments.forEach((apt) => {
      const dateKey = format(new Date(apt.appointmentDate), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDateAppointments = selectedDateKey ? appointmentsByDate[selectedDateKey] || [] : [];

  const maxPerSlot = schedRules?.maxPerSlot ?? 6;
  const slotMinutes = schedRules?.slotMinutes ?? 15;
  const allowCustomTime = schedRules?.allowCustomTime ?? true;
  const selectedSlotCount = appointmentTime
    ? selectedDateAppointments.filter((a) => a.appointmentTime === appointmentTime).length
    : 0;
  const slotIsFull = selectedSlotCount >= maxPerSlot;

  const handleCreateAppointment = () => {
    if (!selectedDate || !firstName || !lastName || !phone || !appointmentTime) {
      toast.error("Por favor complete los campos requeridos");
      return;
    }

    if (slotIsFull) {
      toast.error(`Ese horario ya está completo (${maxPerSlot}/${maxPerSlot}). Probá otro horario`);
      return;
    }

    createAppointment.mutate({
      firstName,
      lastName,
      phone,
      email: email || undefined,
      reasonId: reasonId ? parseInt(reasonId) : undefined,
      appointmentDate: selectedDate.toISOString(),
      appointmentTime,
      notes: notes || undefined,
    });
  };

  const handleCreateReason = () => {
    if (!newReason.trim()) return;
    createReason.mutate({ name: newReason, color: newReasonColor });
  };

  const getReasonById = (id: number | null) => {
    if (!id) return null;
    return reasons.find((r) => r.id === id);
  };

  // Day view grid rows (by hour)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 -> 20:00

  const reasonColors = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamiento</h1>
            <p className="text-muted-foreground">Gestiona tus citas y reuniones</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isReasonsDialogOpen} onOpenChange={setIsReasonsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Motivos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gestionar Motivos de Cita</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nuevo motivo..."
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                    />
                    <Select value={newReasonColor} onValueChange={setNewReasonColor}>
                      <SelectTrigger className="w-20">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: newReasonColor }}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {reasonColors.map((color) => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: color }}
                              />
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleCreateReason} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {reasons.map((reason) => (
                        <div 
                          key={reason.id} 
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: reason.color || "#3b82f6" }}
                            />
                            <span>{reason.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteReason.mutate({ id: reason.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {reasons.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No hay motivos configurados
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Days header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
                  <div 
                    key={day} 
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} className="h-24" />
                ))}
                {daysInMonth.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayAppointments = appointmentsByDate[dateKey] || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateKey}
                      onClick={() => {
                        setSelectedDate(day);
                        setIsDayViewOpen(true);
                        if (!appointmentTime) setAppointmentTime("09:00");
                      }}
                      className={`
                        h-24 p-1 rounded-lg cursor-pointer transition-all border
                        ${isSelected 
                          ? "bg-primary/20 border-primary" 
                          : "bg-muted/30 border-transparent hover:bg-muted/50"
                        }
                        ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
                      `}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${isToday ? "text-primary" : "text-foreground"}
                      `}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayAppointments.slice(0, 2).map((apt) => {
                          const reason = getReasonById(apt.reasonId);
                          return (
                            <div
                              key={apt.id}
                              className="text-xs truncate px-1 py-0.5 rounded"
                              style={{ 
                                backgroundColor: reason?.color ? `${reason.color}30` : "#3b82f630",
                                color: reason?.color || "#3b82f6"
                              }}
                            >
                              {apt.appointmentTime} {apt.firstName}
                            </div>
                          );
                        })}
                        {dayAppointments.length > 2 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayAppointments.length - 2} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day panel */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                {selectedDate 
                  ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
                  : "Selecciona un día"
                }
              </CardTitle>
              {selectedDate && (
                <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Nueva Cita
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Agendar Nueva Cita</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Nombre *</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Juan"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Apellido *</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Pérez"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono *</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+507 6999-8888"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email (opcional)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Motivo</Label>
                        <Select value={reasonId} onValueChange={setReasonId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {reasons.map((reason) => (
                              <SelectItem key={reason.id} value={reason.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: reason.color || "#3b82f6" }}
                                  />
                                  {reason.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="time">Hora *</Label>
                        <Input
                          id="time"
                          type="time"
                          step={allowCustomTime ? 60 : slotMinutes * 60}
                          value={appointmentTime}
                          onChange={(e) => setAppointmentTime(e.target.value)}
                          placeholder="HH:MM"
                        />
                        <p className={
                          slotIsFull ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                        }>
                          Cupo para este horario: {selectedSlotCount}/{maxPerSlot}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notas</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notas adicionales..."
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsNewAppointmentOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCreateAppointment}
                          disabled={createAppointment.isPending || slotIsFull}
                        >
                          {createAppointment.isPending ? "Guardando..." : "Agendar"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <ScrollArea className="h-[500px]">
                  {selectedDateAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDateAppointments
                        .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
                        .map((apt) => {
                          const reason = getReasonById(apt.reasonId);
                          return (
                            <div
                              key={apt.id}
                              className="p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">{apt.appointmentTime}</span>
                                  {reason && (
                                    <Badge 
                                      variant="outline"
                                      style={{ 
                                        borderColor: reason.color || "#3b82f6",
                                        color: reason.color || "#3b82f6"
                                      }}
                                    >
                                      {reason.name}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => deleteAppointment.mutate({ id: apt.id })}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span>{apt.firstName} {apt.lastName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <span>{apt.phone}</span>
                                </div>
                                {apt.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span>{apt.email}</span>
                                  </div>
                                )}
                                {apt.notes && (
                                  <p className="text-muted-foreground mt-2 text-xs">
                                    {apt.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay citas para este día</p>
                      <p className="text-sm">Haz clic en "Nueva Cita" para agendar</p>
                    </div>
                  )}
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Selecciona un día en el calendario</p>
                  <p className="text-sm">para ver o crear citas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        {/* Day View Modal (Full Screen) */}
        <Dialog open={isDayViewOpen} onOpenChange={setIsDayViewOpen}>
          <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedDate
                      ? format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })
                      : "Vista de día"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Máximo {maxPerSlot} personas por horario • {allowCustomTime ? "Hora manual" : `Slots de ${slotMinutes}m`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!selectedDate) return;
                      resetForm();
                      setIsNewAppointmentOpen(true);
                    }}
                    disabled={!selectedDate}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva cita
                  </Button>

                  <Button variant="ghost" size="icon" onClick={() => setIsDayViewOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {hours.map((hour) => {
                    const hourStr = String(hour).padStart(2, "0");
                    const inHour = selectedDateAppointments.filter((a) =>
                      a.appointmentTime?.startsWith(`${hourStr}:`)
                    );

                    const grouped = inHour.reduce(
                      (acc: Record<string, typeof inHour>, apt) => {
                        const t = apt.appointmentTime;
                        if (!acc[t]) acc[t] = [];
                        acc[t].push(apt);
                        return acc;
                      },
                      {}
                    );

                    const timeKeys = Object.keys(grouped).sort();
                    const isSelectedHour = appointmentTime?.startsWith(`${hourStr}:`);

                    return (
                      <div
                        key={hour}
                        className={
                          "rounded-xl border p-4 bg-muted/20 " +
                          (isSelectedHour ? "border-primary bg-primary/5" : "border-border")
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm font-medium hover:underline"
                            onClick={() => setAppointmentTime(`${hourStr}:00`)}
                          >
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {hourStr}:00
                          </button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (!selectedDate) return;
                              setAppointmentTime(`${hourStr}:00`);
                              resetForm();
                              setIsNewAppointmentOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Agendar
                          </Button>
                        </div>

                        {timeKeys.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">Sin citas en esta hora</p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {timeKeys.map((t) => {
                              const list = grouped[t] ?? [];
                              const full = list.length >= maxPerSlot;

                              return (
                                <div
                                  key={t}
                                  className={
                                    "rounded-lg border px-3 py-2 bg-background/60 " +
                                    (appointmentTime === t ? "border-primary" : "border-border")
                                  }
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      className="text-sm font-semibold hover:underline"
                                      onClick={() => setAppointmentTime(t)}
                                    >
                                      {t}
                                    </button>
                                    <Badge variant={full ? "destructive" : "outline"}>
{list.length}/{maxPerSlot}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {list.slice(0, maxPerSlot).map((apt) => (
                                      <div
                                        key={apt.id}
                                        className="text-xs rounded-md bg-muted px-2 py-1 border border-border"
                                      >
                                        {apt.firstName} {apt.lastName}
                                      </div>
                                    ))}
                                  </div>

                                  {full && (
                                    <p className="mt-2 text-xs text-destructive">
                                      Horario lleno • Probá otro horario
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

