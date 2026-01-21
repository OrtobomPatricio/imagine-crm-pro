import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Upload, FileJson, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Backup() {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    const createBackupMutation = trpc.backup.createBackup.useMutation({
        onSuccess: (data) => {
            // Download as JSON file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
            toast.success("Backup descargado exitosamente");
        },
        onError: (error) => {
            setIsExporting(false);
            toast.error("Error al crear backup: " + error.message);
        },
    });

    const exportLeadsQuery = trpc.backup.exportLeadsCSV.useQuery(undefined, {
        enabled: false,
    });

    const importLeadsMutation = trpc.backup.importLeadsCSV.useMutation({
        onSuccess: (result) => {
            setIsImporting(false);
            toast.success(
                `Importación completada: ${result.imported} importados, ${result.duplicates} duplicados, ${result.errors} errores`
            );
        },
        onError: (error) => {
            setIsImporting(false);
            toast.error("Error al importar: " + error.message);
        },
    });

    const handleBackupDownload = () => {
        setIsExporting(true);
        createBackupMutation.mutate();
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const result = await exportLeadsQuery.refetch();
            if (result.data) {
                const blob = new Blob([result.data.csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`${result.data.count} leads exportados`);
            }
        } catch (error: any) {
            toast.error("Error al exportar: " + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const csvContent = e.target?.result as string;
            setIsImporting(true);
            importLeadsMutation.mutate({ csvContent });
        };
        reader.readAsText(file);
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backups e Importación</h1>
                    <p className="text-muted-foreground">
                        Administra tus datos: backups completos y gestión de leads via CSV
                    </p>
                </div>

                {/* Full System Backup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5" />
                            Backup Completo del Sistema
                        </CardTitle>
                        <CardDescription>
                            Descarga todos los datos del CRM (leads, campañas, conversaciones) en formato JSON
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                El backup incluye: Leads, Campañas, Conversaciones, Mensajes y Números WhatsApp
                            </AlertDescription>
                        </Alert>

                        <Button
                            onClick={handleBackupDownload}
                            disabled={isExporting}
                            className="w-full sm:w-auto"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isExporting ? "Generando..." : "Descargar Backup Completo"}
                        </Button>
                    </CardContent>
                </Card>

                {/* CSV Import/Export */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5" />
                            Gestión de Leads (CSV)
                        </CardTitle>
                        <CardDescription>
                            Importa o exporta leads en formato CSV
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label>Exportar Leads a CSV</Label>
                            <p className="text-sm text-muted-foreground">
                                Descarga todos tus leads en un archivo CSV compatible con Excel
                            </p>
                            <Button
                                onClick={handleExportCSV}
                                variant="outline"
                                disabled={isExporting}
                                className="w-full sm:w-auto"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                {isExporting ? "Exportando..." : "Exportar a CSV"}
                            </Button>
                        </div>

                        <div className="border-t pt-6 space-y-3">
                            <Label>Importar Leads desde CSV</Label>
                            <p className="text-sm text-muted-foreground">
                                Sube un archivo CSV con columnas: nombre, telefono, email, pais, estado, notas
                            </p>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Los leads duplicados (mismo teléfono) serán ignorados automáticamente
                                </AlertDescription>
                            </Alert>

                            <input
                                ref={csvInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleImportCSV}
                                className="hidden"
                            />

                            <Button
                                onClick={() => csvInputRef.current?.click()}
                                variant="outline"
                                disabled={isImporting}
                                className="w-full sm:w-auto"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                {isImporting ? "Importando..." : "Seleccionar archivo CSV"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
