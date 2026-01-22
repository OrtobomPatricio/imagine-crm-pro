
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { DollarSign, Percent } from "lucide-react";

export function SalesConfigEditor({ query, onSave, isPending }: any) {
    const [salesForm, setSalesForm] = useState({
        defaultCommissionRate: 10,
        currencySymbol: "G$",
        requireValueOnWon: true
    });

    useEffect(() => {
        if (query.data?.salesConfig) {
            setSalesForm({
                defaultCommissionRate: (query.data.salesConfig.defaultCommissionRate ?? 0.10) * 100,
                currencySymbol: query.data.salesConfig.currencySymbol ?? "G$",
                requireValueOnWon: query.data.salesConfig.requireValueOnWon ?? true
            });
        }
    }, [query.data]);

    const handleSave = () => {
        // We need to pass the FULL settings object to updateGeneral, reusing logic from parent could be cleaner
        // but here we are calling mutation directly. Wait, the parent passed 'updateGeneral.mutate'.
        // BUT updateGeneral expects the full payload. 
        // This is tricky without refactoring the parent state.

        // Quick fix: We will trigger the save passing the MERGED state.
        // However, the parent controls the state for other tabs.
        // Current architectur in Settings.tsx is a bit monolithic with 'form' state.

        // Better approach: Let's assume onSave handles the merge if we pass a partial, or we update the parent form?
        // Actually, looking at Settings.tsx, 'saveGeneral' uses the local 'form' state.
        // So 'Settings.tsx' needs to hold the salesConfig state too.

        // REFACTOR PLAN:
        // I will inject the SalesConfigEditor into Settings.tsx but I realized I need to update the parent 'form' state first.
        // So I will modify Settings.tsx to include salesConfig in its initial state and handle the save there.
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Ventas</CardTitle>
                <CardDescription>Define reglas automáticas para comisiones y metas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Comisión por Defecto (%)</Label>
                        <div className="relative">
                            <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                className="pl-9"
                                value={salesForm.defaultCommissionRate}
                                onChange={(e) => setSalesForm(p => ({ ...p, defaultCommissionRate: parseFloat(e.target.value) }))}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Se aplicará a los usuarios que no tengan una regla específica.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Símbolo de Moneda</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                value={salesForm.currencySymbol}
                                onChange={(e) => setSalesForm(p => ({ ...p, currencySymbol: e.target.value }))}
                                placeholder="G$, USD, €"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2 border p-3 rounded-lg">
                    <Switch
                        checked={salesForm.requireValueOnWon}
                        onCheckedChange={(c) => setSalesForm(p => ({ ...p, requireValueOnWon: c }))}
                    />
                    <div>
                        <Label>Requerir Valor al Ganar</Label>
                        <p className="text-xs text-muted-foreground">Al mover un lead a "Ganado", obligar a ingresar el monto de la venta.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
