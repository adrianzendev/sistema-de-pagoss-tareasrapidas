import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Plus, Settings, Eye, Trash2, Coins, DollarSign, AlertCircle } from "lucide-react";
import type { Week, AgencySettings } from "@shared/schema";

type WeekSettlement = {
  week: Week;
  settlements: Array<{
    tutorId: string;
    tutorName: string;
    autoVerificaPagos: boolean;
    commissionPercent: number;
    grossIncome: number;
    grossDirect: number;
    grossRegular: number;
    tutorAdvertisingShare: number;
    netIncome: number;
    tutorEarnings: number;
    agencyEarnings: number;
    netTransfer: number;
    payments: any[];
  }>;
  totals: {
    grossIncome: number;
    advertisingCost: number;
    netIncome: number;
    tutorEarnings: number;
    agencyEarnings: number;
  };
  settings: {
    agencyPercent: number;
    tutorPercent: number;
  };
  advertising: {
    sharedAdvertisingUsd: number;
    usdRate: number;
    advertisingInSoles: number;
    agencyShare: number;
    tutorsShare: number;
  };
};

export default function WeeksPage() {
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [sharedAdvertisingUsd, setSharedAdvertisingUsd] = useState("");
  const [weekStatus, setWeekStatus] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agencyPercent, setAgencyPercent] = useState("");
  const [tutorPercent, setTutorPercent] = useState("");

  const { data: weeks, isLoading } = useQuery<Week[]>({
    queryKey: ["/api/admin/weeks"],
  });

  const { data: settings } = useQuery<AgencySettings>({
    queryKey: ["/api/admin/settings"],
  });

  const { data: currencies } = useQuery<{ code: string; exchangeRate: string }[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: tutors } = useQuery<{ id: string }[]>({
    queryKey: ["/api/admin/tutors"],
  });

  const usdRate = Number(currencies?.find(c => c.code === "USD")?.exchangeRate ?? 1);
  const advertisingInSoles = Number(sharedAdvertisingUsd || 0) * usdRate;
  const tutorCount = tutors?.length || 1;

  const { data: settlement, isLoading: settlementLoading } = useQuery<WeekSettlement>({
    queryKey: ["/api/admin/weeks", selectedWeek?.id, "settlement"],
    enabled: !!selectedWeek,
  });

  const generateWeekMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/weeks/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weeks"] });
      toast({ title: "Semana generada correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateWeekMutation = useMutation({
    mutationFn: (data: { id: string; sharedAdvertisingUsd?: string; status?: string }) =>
      apiRequest("PATCH", `/api/admin/weeks/${data.id}`, {
        sharedAdvertisingUsd: data.sharedAdvertisingUsd,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weeks"] });
      if (selectedWeek) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/weeks", selectedWeek.id, "settlement"] });
      }
      setEditingWeek(null);
      toast({ title: "Semana actualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteWeekMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/weeks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/weeks"] });
      toast({ title: "Semana eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: { agencyPercent: string; tutorPercent: string }) =>
      apiRequest("PATCH", "/api/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      setSettingsOpen(false);
      toast({ title: "Configuración actualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default" data-testid="badge-status-open">Abierta</Badge>;
      case "closed":
        return <Badge variant="secondary" data-testid="badge-status-closed">Cerrada</Badge>;
      case "paid":
        return <Badge className="bg-success" data-testid="badge-status-paid">Pagada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openEditDialog = (week: Week) => {
    setEditingWeek(week);
    setSharedAdvertisingUsd(week.sharedAdvertisingUsd ?? "0");
    setWeekStatus(week.status);
  };

  const openSettingsDialog = () => {
    setAgencyPercent(settings?.agencyPercent ?? "30");
    setTutorPercent(settings?.tutorPercent ?? "70");
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    const agency = parseFloat(agencyPercent);
    const tutor = parseFloat(tutorPercent);
    if (agency + tutor !== 100) {
      toast({ title: "Error", description: "Los porcentajes deben sumar 100%", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ agencyPercent, tutorPercent });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Semanas de Pago</h1>
          <p className="text-muted-foreground">Gestiona las semanas y liquidaciones</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => generateWeekMutation.mutate()}
            disabled={generateWeekMutation.isPending}
            data-testid="button-generate-week"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Semana
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Semanas</CardTitle>
          <CardDescription>Semanas de domingo a sábado con sus liquidaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {weeks && weeks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Publicidad Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((week) => (
                  <TableRow key={week.id} data-testid={`row-week-${week.weekNumber}`}>
                    <TableCell className="font-medium" data-testid={`text-week-number-${week.weekNumber}`}>
                      S{week.weekNumber}
                    </TableCell>
                    <TableCell>
                      {formatDate(week.startDate)} - {formatDate(week.endDate)}
                    </TableCell>
                    <TableCell data-testid={`text-advertising-${week.weekNumber}`}>
                      <span className="font-mono text-sm">
                        ${formatCurrency(Number(week.sharedAdvertisingUsd ?? 0))} USD
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(week.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedWeek(week)}
                          data-testid={`button-view-week-${week.weekNumber}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteWeekMutation.mutate(week.id)}
                          data-testid={`button-delete-week-${week.weekNumber}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay semanas creadas</p>
              <p className="text-sm">Haz clic en "Nueva Semana" para comenzar</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración de Comisiones</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Porcentaje Tutor (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={tutorPercent}
                onChange={(e) => setTutorPercent(e.target.value)}
                data-testid="input-tutor-percent"
              />
            </div>
            <div className="space-y-2">
              <Label>Porcentaje Agencia (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={agencyPercent}
                onChange={(e) => setAgencyPercent(e.target.value)}
                data-testid="input-agency-percent"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Total: {(parseFloat(tutorPercent || "0") + parseFloat(agencyPercent || "0")).toFixed(0)}%
              {parseFloat(tutorPercent || "0") + parseFloat(agencyPercent || "0") !== 100 && (
                <span className="text-destructive ml-2">(debe ser 100%)</span>
              )}
            </p>
            <Button
              className="w-full"
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingWeek} onOpenChange={() => setEditingWeek(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Semana S{editingWeek?.weekNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-success" />
                Publicidad (USD) — costo total
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sharedAdvertisingUsd}
                  onChange={(e) => setSharedAdvertisingUsd(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                  data-testid="input-advertising-cost"
                />
              </div>
              {Number(sharedAdvertisingUsd) > 0 ? (
                <div className="text-xs space-y-1 p-3 bg-muted rounded-md border">
                  <p className="font-semibold text-foreground mb-2">Desglose del costo:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Total USD ingresado:</span>
                    <span className="font-mono font-bold text-right">${formatCurrency(Number(sharedAdvertisingUsd))}</span>
                    <span className="text-muted-foreground">Total en soles:</span>
                    <span className="font-mono font-bold text-right">S/ {formatCurrency(advertisingInSoles)}</span>
                    <span className="text-primary">Agencia paga (50%):</span>
                    <span className="font-mono font-bold text-right text-primary">S/ {formatCurrency(advertisingInSoles * 0.5)}</span>
                    <span className="text-destructive">Tutores pagan (50%):</span>
                    <span className="font-mono font-bold text-right text-destructive">S/ {formatCurrency(advertisingInSoles * 0.5)}</span>
                    <span className="text-warning">Aprox. por tutor:</span>
                    <span className="font-mono font-bold text-right text-warning">
                      S/ {formatCurrency((advertisingInSoles * 0.5) / tutorCount)}
                      <span className="font-normal ml-1 text-[10px] text-muted-foreground">({tutorCount} tutores)</span>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ingresa el costo total. El sistema divide en 2: 50% agencia · 50% tutores activos
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={weekStatus} onValueChange={setWeekStatus}>
                <SelectTrigger data-testid="select-week-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="closed">Cerrada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() =>
                editingWeek &&
                updateWeekMutation.mutate({
                  id: editingWeek.id,
                  sharedAdvertisingUsd,
                  status: weekStatus,
                })
              }
              disabled={updateWeekMutation.isPending}
              data-testid="button-save-week"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedWeek} onOpenChange={() => setSelectedWeek(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Liquidación Semana S{selectedWeek?.weekNumber}</DialogTitle>
          </DialogHeader>
          {settlementLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : settlement ? (
            <div className="space-y-4">
              {settlement.advertising.sharedAdvertisingUsd > 0 && (
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-lg text-sm">
                  <p className="font-medium text-primary mb-1">Publicidad Compartida</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total USD:</span>
                      <span className="font-mono font-bold ml-1">${formatCurrency(settlement.advertising.sharedAdvertisingUsd)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">TC:</span>
                      <span className="font-mono font-bold ml-1">S/{formatCurrency(settlement.advertising.usdRate)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Agencia paga:</span>
                      <span className="font-mono font-bold ml-1 text-warning">S/{formatCurrency(settlement.advertising.agencyShare)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tutores pagan:</span>
                      <span className="font-mono font-bold ml-1 text-destructive">S/{formatCurrency(settlement.advertising.tutorsShare)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">{formatCurrency(settlement.totals.grossIncome)}</div>
                  <div className="text-xs text-muted-foreground">Ingreso Bruto</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">{formatCurrency(settlement.totals.netIncome)}</div>
                  <div className="text-xs text-muted-foreground">Por comisión</div>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg">
                  <div className="text-lg font-bold text-primary">{formatCurrency(settlement.totals.tutorEarnings)}</div>
                  <div className="text-xs text-muted-foreground">Ganancia Tutores</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">{formatCurrency(settlement.totals.agencyEarnings)}</div>
                  <div className="text-xs text-muted-foreground">Ganancia Agencia</div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Todos los valores en soles (S/). La publicidad ingresada en USD se convierte al tipo de cambio vigente.</p>
              {settlement.settlements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tutor</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead className="text-right">Bruto S/</TableHead>
                      <TableHead className="text-right">× %</TableHead>
                      <TableHead className="text-right">− Pub. S/</TableHead>
                      <TableHead className="text-right font-semibold">Gan. Tutor S/</TableHead>
                      <TableHead className="text-right font-semibold">Gan. Agencia S/</TableHead>
                      <TableHead className="text-right font-semibold">Transf. neta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlement.settlements.map((s) => {
                      const owesAgency = s.netTransfer < 0;
                      return (
                        <TableRow key={s.tutorId}>
                          <TableCell className="font-medium">{s.tutorName}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{s.commissionPercent}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(s.grossIncome)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.netIncome)}</TableCell>
                          <TableCell className="text-right">
                            {s.tutorAdvertisingShare > 0 ? `-${formatCurrency(s.tutorAdvertisingShare)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(s.tutorEarnings)}</TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={`inline-flex items-center justify-end gap-1 ${s.agencyEarnings < 0 ? "text-destructive" : ""}`}>
                              {s.agencyEarnings < 0 && (
                                <span title={`La publicidad (S/${formatCurrency(s.tutorAdvertisingShare)}) supera los ingresos por comisión de la agencia (S/${formatCurrency(s.grossIncome * (1 - s.commissionPercent / 100))}) para este tutor. La semana tiene pérdida neta.`}>
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 cursor-help" />
                                </span>
                              )}
                              {formatCurrency(s.agencyEarnings)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-net-transfer-${s.tutorId}`}>
                            <div className={`text-xs font-semibold ${owesAgency ? "text-destructive" : "text-success"}`}>
                              {owesAgency
                                ? `🔴 Tutor paga S/${formatCurrency(Math.abs(s.netTransfer))}`
                                : `✅ Agencia paga S/${formatCurrency(s.netTransfer)}`
                              }
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay pagos verificados en esta semana
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
