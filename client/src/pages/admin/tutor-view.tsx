import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calculator, Calendar, Coins, DollarSign, FileText, Image as ImageIcon, Phone, CheckCircle, XCircle, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PaymentWithDetails, Week } from "@shared/schema";

type TutorSettlement = {
  week: Week;
  tutorId: string;
  tutorName: string;
  commissionPercent: number;
  grossIncome: number;
  advertisingCost: number;
  tutorAdvertisingShare: number;
  sharedAdvertisingUsd: number;
  usdRate: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  payments: PaymentWithDetails[];
};

type SettlementResponse = {
  settlements: TutorSettlement[];
  settings: { agencyPercent: number; tutorPercent: number };
  commissionPercent: number;
  tutor: { id: string; name: string; email: string };
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", icon: Clock, className: "text-warning border-warning/40" },
  verified: { label: "Verificado", icon: CheckCircle, className: "text-success border-success/40" },
  rejected: { label: "Rechazado", icon: XCircle, className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", icon: RotateCcw, className: "text-muted-foreground border-border" },
};

function pen(val: number) {
  return `PEN ${val.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmt2(val: number) {
  return val.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "open": return <Badge variant="default">Abierta</Badge>;
    case "closed": return <Badge variant="secondary">Cerrada</Badge>;
    case "paid": return <Badge className="border-success/40 bg-background text-success">Pagada</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminTutorViewPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"payments" | "settlement">("payments");
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: settlementData, isLoading: settlementLoading } = useQuery<SettlementResponse>({
    queryKey: [`/api/admin/tutors/${id}/settlement`],
  });

  const { data: allWeeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const today = new Date().toISOString().split("T")[0];
  const sortedWeeks = [...(allWeeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: [`/api/admin/tutors/${id}/payments`, activeWeekId],
    queryFn: async () => {
      if (!activeWeekId) return [];
      const res = await fetch(`/api/admin/tutors/${id}/payments?weekId=${activeWeekId}`);
      if (!res.ok) throw new Error("Error al cargar pagos");
      return res.json();
    },
    enabled: !!activeWeekId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const tutor = settlementData?.tutor;
  const settlements = settlementData?.settlements ?? [];
  const commissionPercent = settlementData?.commissionPercent ?? 0;
  const selectedWeek = sortedWeeks.find(w => w.id === activeWeekId);

  const totals = settlements.reduce(
    (acc, s) => ({
      grossIncome: acc.grossIncome + s.grossIncome,
      tutorEarnings: acc.tutorEarnings + s.tutorEarnings,
      advertisingCost: acc.advertisingCost + s.tutorAdvertisingShare,
      netIncome: acc.netIncome + s.netIncome,
    }),
    { grossIncome: 0, tutorEarnings: 0, advertisingCost: 0, netIncome: 0 }
  );

  if (settlementLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/tutors">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tutores
          </button>
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{tutor?.name ?? "Tutor"}</h1>
          <p className="text-sm text-muted-foreground">{tutor?.email}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          Vista admin · comisión {commissionPercent}%
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mis Pagos
        </button>
        <button
          onClick={() => setActiveTab("settlement")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "settlement"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Liquidación
        </button>
      </div>

      {/* PAGOS TAB */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Historial de Pagos</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {selectedWeek
                      ? `${payments?.length ?? 0} pago${payments?.length !== 1 ? "s" : ""} en S${selectedWeek.weekNumber}`
                      : "Selecciona una semana"}
                  </CardDescription>
                </div>
                <Select
                  value={activeWeekId ?? ""}
                  onValueChange={(val) => setSelectedWeekId(val)}
                >
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Semana…" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...sortedWeeks].reverse().map((week) => {
                      const isCurrent = currentWeek?.id === week.id;
                      return (
                        <SelectItem key={week.id} value={week.id}>
                          <span className="font-mono">S{week.weekNumber}</span>
                          {isCurrent && <span className="ml-2 text-xs text-success font-medium">● actual</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <div className="px-4 py-2 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Total: <strong className="text-foreground">{payments?.length ?? 0}</strong></span>
              <span>Pendientes: <strong className="text-warning">{payments?.filter(p => p.status === "pending").length ?? 0}</strong></span>
              <span>Verificados: <strong className="text-success">{payments?.filter(p => p.status === "verified").length ?? 0}</strong></span>
            </div>
          </Card>

          {paymentsLoading ? (
            <Card>
              <div className="space-y-0 divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          ) : !payments?.length ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay pagos</h3>
              <p className="text-muted-foreground text-sm">No hay pagos en esta semana</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/40">
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-right text-xs">Monto</TableHead>
                      <TableHead className="text-center text-xs">Img</TableHead>
                      <TableHead className="w-10 text-xs">#</TableHead>
                      <TableHead className="text-xs">Fecha y hora</TableHead>
                      <TableHead className="text-xs">Teléfono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment, index) => {
                      const status = statusConfig[payment.status] ?? statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={payment.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Badge className={`gap-1 text-xs px-2 py-1 ${status.className}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-sm tabular-nums">
                              {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code ?? ""}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {payment.proofImage ? (
                              <button
                                onClick={() => setPreviewImage(payment.proofImage!)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
                              >
                                <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded border mx-auto">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">
                            #{index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="text-foreground">
                                {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                              <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="font-mono">{payment.clientNumber}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* LIQUIDACIÓN TAB */}
      {activeTab === "settlement" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg border border-primary/30">
                    <Coins className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ingreso Bruto Total</p>
                    <p className="text-2xl font-bold">{fmt2(totals.grossIncome)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg border border-destructive/30">
                    <DollarSign className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Publicidad Compartida</p>
                    <p className="text-2xl font-bold">{fmt2(totals.advertisingCost)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg border border-success/30">
                    <Calculator className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ganancia Total</p>
                    <p className="text-2xl font-bold text-success">{fmt2(totals.tutorEarnings)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Liquidación por Semana
              </CardTitle>
              <CardDescription>Hoja de cálculo de ganancias semana a semana</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {settlements.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[860px]">
                    <div className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-b-2 border-border font-bold text-xs uppercase">
                      <div className="p-2 text-center border-r border-border text-muted-foreground">#</div>
                      <div className="p-2 text-center border-r border-primary/25 text-primary">SEMANA</div>
                      <div className="p-2 text-center border-r border-border text-muted-foreground">PERÍODO</div>
                      <div className="p-2 text-center border-r border-border text-muted-foreground">ESTADO</div>
                      <div className="p-2 text-center border-r border-border text-muted-foreground">PAGOS</div>
                      <div className="p-2 text-center border-r border-success/25 text-success">BRUTO</div>
                      <div className="p-2 text-center border-r border-primary/30 text-primary">× {commissionPercent}%</div>
                      <div className="p-2 text-center border-r border-destructive/25 text-destructive">− PUBLICIDAD</div>
                      <div className="p-2 text-center text-success">GANANCIA</div>
                    </div>

                    {settlements.map((s, index) => (
                      <div
                        key={s.week.id}
                        className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-b border-border text-sm"
                      >
                        <div className="p-2 text-center border-r border-border font-medium text-muted-foreground">{index + 1}</div>
                        <div className="p-2 text-center border-r border-primary/30 font-bold">S{s.week.weekNumber}</div>
                        <div className="p-2 text-center border-r border-border text-xs">
                          {new Date(s.week.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} - {new Date(s.week.endDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                        </div>
                        <div className="p-2 text-center border-r border-border flex items-center justify-center">
                          {getStatusBadge(s.week.status)}
                        </div>
                        <div className="p-2 text-center border-r border-border font-medium">{s.payments.length}</div>
                        <div className="p-2 text-right border-r border-success/30 font-medium text-success">{fmt2(s.grossIncome)}</div>
                        <div className="p-2 text-right border-r border-primary/30 font-medium text-primary">{fmt2(s.netIncome)}</div>
                        <div className="p-2 text-right border-r border-destructive/30 font-medium text-destructive">
                          {s.tutorAdvertisingShare > 0 ? (
                            <span title={`$${fmt2(s.sharedAdvertisingUsd)} USD × TC ${fmt2(s.usdRate)}`}>
                              -{fmt2(s.tutorAdvertisingShare)}
                            </span>
                          ) : "—"}
                        </div>
                        <div className={`p-2 text-right font-bold ${s.tutorEarnings < 0 ? "text-destructive" : "text-success"}`}>
                          {fmt2(s.tutorEarnings)}
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-t-2 border-border font-bold text-sm">
                      <div className="p-3 text-center border-r border-border" />
                      <div className="p-3 border-r border-border col-span-4 text-right pr-4">TOTALES:</div>
                      <div className="p-3 text-right border-r border-success/30 text-success">{fmt2(totals.grossIncome)}</div>
                      <div className="p-3 text-right border-r border-primary/30 text-primary">{fmt2(totals.netIncome)}</div>
                      <div className="p-3 text-right border-r border-destructive/30 text-destructive">
                        {totals.advertisingCost > 0 ? `-${fmt2(totals.advertisingCost)}` : "—"}
                      </div>
                      <div className="p-3 text-right text-success">{fmt2(totals.tutorEarnings)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay semanas con pagos aún</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fórmula de Cálculo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg border border-success/30">
                  <p className="font-bold text-success">1. Ingreso Bruto</p>
                  <p className="text-success/70 text-xs">Pagos verificados convertidos a PEN</p>
                </div>
                <div className="p-3 rounded-lg border border-primary/30">
                  <p className="font-bold text-primary">2. Aplicar Comisión ({commissionPercent}%)</p>
                  <p className="text-primary/70 text-xs">Bruto × {commissionPercent}%</p>
                </div>
                <div className="p-3 rounded-lg border border-destructive/30">
                  <p className="font-bold text-destructive">3. Restar Publicidad</p>
                  <p className="text-destructive/70 text-xs">Publicidad USD × TC × 50% ÷ tutores activos</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg text-center border border-border">
                <p className="text-sm font-mono font-bold">
                  Ganancia = (Bruto × {commissionPercent}%) − Publicidad compartida
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="overflow-y-auto flex-1">
              <img src={previewImage} alt="Comprobante" className="w-full rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
