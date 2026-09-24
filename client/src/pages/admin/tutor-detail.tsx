import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronDown, ChevronRight, Image, Pencil, Check, X, Power, Megaphone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Week } from "@shared/schema";

type DailyCampaign = {
  id: string;
  dailyCostUsd: string;
  startDate: string;
  endDate: string | null;
  days: number;
  active: boolean;
};

type CurrencyEntry = { code: string; symbol: string; total: number };

type MatrixCell = {
  grossIncome: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  tutorAdvertisingShare: number;
  paymentCount: number;
  currencies: CurrencyEntry[];
};

type SettlementsMatrix = {
  weeks: Week[];
  tutors: Array<{ id: string; name: string; commissionPercent: string; advertisingCostUsd?: string }>;
  matrix: Record<string, Record<string, MatrixCell>>;
  weekPaidMap: Record<string, string[]>;
  tutorWeekAdvMap: Record<string, Record<string, number>>;
  tutorWeekAdvDisabledMap?: Record<string, Record<string, boolean>>;
  usdRate?: number;
};

type Payment = {
  id: string;
  amount: string;
  clientNumber: string;
  status: string;
  createdAt: string;
  verifiedAt?: string;
  proofImage?: string;
  exchangeRateSnapshot?: string;
  currency?: { code: string; symbol: string; exchangeRate: string };
  verifier?: { name: string };
};

function WeekPayments({ tutorId, weekId }: { tutorId: string; weekId: string }) {
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: [`/api/admin/tutors/${tutorId}/payments`, weekId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tutors/${tutorId}/payments?weekId=${weekId}`);
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const fmtAmt = (amount: string, code: string) =>
    `${code} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))}`;

  if (isLoading) {
    return (
      <tr>
        <td colSpan={8} className="px-6 py-3 bg-muted/30">
          <Skeleton className="h-4 w-48" />
        </td>
      </tr>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <tr>
        <td colSpan={8} className="px-6 py-3 bg-muted/20 text-muted-foreground text-xs italic">
          Sin pagos en esta semana.
        </td>
      </tr>
    );
  }

  return (
    <>
      {payments.map((p, i) => {
        const rate = Number(p.exchangeRateSnapshot ?? p.currency?.exchangeRate ?? 1);
        const amountSoles = Number(p.amount) * rate;
        return (
          <tr key={p.id} className={`${i % 2 === 0 ? "bg-muted/10" : "bg-muted/20"} text-xs`}>
            <td className="pl-10 pr-4 py-2 text-muted-foreground">
              {new Date(p.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
              <div className="text-xs opacity-60">{new Date(p.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</div>
            </td>
            <td className="px-4 py-2 text-muted-foreground">{p.clientNumber}</td>
            <td className="px-4 py-2 tabular-nums">
              <span className="font-medium">{fmtAmt(p.amount, p.currency?.code ?? "USD")}</span>
            </td>
            <td className="px-4 py-2 tabular-nums text-muted-foreground">
              {rate !== 1 ? `PEN ${amountSoles.toFixed(2)}` : "—"}
            </td>
            <td className="px-4 py-2 tabular-nums text-muted-foreground/70 text-xs">
              {rate !== 1 ? (
                <span title="Tipo de cambio al momento del pago">TC: {rate.toFixed(4)}</span>
              ) : "—"}
            </td>
            <td className="px-4 py-2">
              {p.status === "verified" ? (
                <Badge className="text-xs px-2 py-0 h-5 bg-success">Verificado</Badge>
              ) : p.status === "rejected" ? (
                <Badge variant="destructive" className="text-xs px-2 py-0 h-5">Rechazado</Badge>
              ) : (
                <Badge variant="outline" className="text-xs px-2 py-0 h-5">Pendiente</Badge>
              )}
              {p.verifier && <div className="text-xs text-muted-foreground mt-1">{p.verifier.name}</div>}
              {p.verifiedAt && <div className="text-xs text-muted-foreground/60">{new Date(p.verifiedAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
            </td>
            <td className="px-4 py-2">
              {p.proofImage && (
                <a href={p.proofImage} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  <Image className="w-3 h-3" /> <span className="text-xs">ver</span>
                </a>
              )}
            </td>
            <td />
          </tr>
        );
      })}
    </>
  );
}

export default function TutorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [editingAdv, setEditingAdv] = useState<string | null>(null);
  const [advInput, setAdvInput] = useState("");
  const [campaignInput, setCampaignInput] = useState("");
  const [showPastCampaigns, setShowPastCampaigns] = useState(false);

  const { data: matrixData, isLoading } = useQuery<SettlementsMatrix>({
    queryKey: ["/api/admin/settlements/matrix"],
  });

  const fmt = (n: number) =>
    "PEN " + new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtUsd = (n: number) =>
    "USD " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const markPaidMutation = useMutation({
    mutationFn: ({ weekId }: { weekId: string }) =>
      apiRequest("POST", `/api/admin/weeks/${weekId}/tutor-paid/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] }),
  });

  const unmarkPaidMutation = useMutation({
    mutationFn: ({ weekId }: { weekId: string }) =>
      apiRequest("DELETE", `/api/admin/weeks/${weekId}/tutor-paid/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] }),
  });

  const setAdvMutation = useMutation({
    mutationFn: ({ weekId, cost }: { weekId: string; cost: number }) =>
      apiRequest("PATCH", `/api/admin/tutors/${id}/week-advertising/${weekId}`, { advertisingCostUsd: cost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
      setEditingAdv(null);
    },
  });

  const { data: campaigns = [] } = useQuery<DailyCampaign[]>({
    queryKey: [`/api/admin/tutors/${id}/daily-campaigns`],
  });

  const toggleAdvMutation = useMutation({
    mutationFn: ({ weekId, disabled }: { weekId: string; disabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/tutors/${id}/week-advertising/${weekId}/toggle`, { disabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] }),
  });

  const startCampaignMutation = useMutation({
    mutationFn: (dailyCostUsd: number) =>
      apiRequest("POST", `/api/admin/tutors/${id}/daily-campaigns`, { dailyCostUsd }),
    onSuccess: () => {
      setCampaignInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tutors/${id}/daily-campaigns`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
    },
  });

  const endCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      apiRequest("PATCH", `/api/admin/daily-campaigns/${campaignId}/end`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tutors/${id}/daily-campaigns`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const tutor = matrixData?.tutors.find(t => t.id === id);
  const weeks = matrixData?.weeks ?? [];
  const matrix = matrixData?.matrix ?? {};
  const weekPaidMap = matrixData?.weekPaidMap ?? {};

  if (!tutor) {
    return (
      <div className="p-6 text-muted-foreground">
        Tutor no encontrado.{" "}
        <Link href="/admin" className="underline text-primary">Volver</Link>
      </div>
    );
  }

  const tutorWeekAdvMap = matrixData?.tutorWeekAdvMap ?? {};
  const tutorWeekAdvDisabledMap = matrixData?.tutorWeekAdvDisabledMap ?? {};
  const activeCampaign = campaigns.find(c => c.active);
  const pastCampaigns = campaigns.filter(c => !c.active);
  const tutorRows = weeks.map(w => ({ week: w, cell: matrix[tutor.id]?.[w.id] }));

  const currencyMap = new Map<string, { code: string; symbol: string }>();
  for (const { cell } of tutorRows) {
    for (const c of (cell?.currencies ?? [])) {
      if (!currencyMap.has(c.code)) currencyMap.set(c.code, { code: c.code, symbol: c.symbol });
    }
  }
  const allCurrencies = Array.from(currencyMap.values());

  const totalGross = tutorRows.reduce((s, r) => s + (r.cell?.grossIncome ?? 0), 0);
  const totalAdv = tutorRows.reduce((s, r) => s + (r.cell?.tutorAdvertisingShare ?? 0), 0);
  const totalNet = tutorRows.reduce((s, r) => s + (r.cell?.netIncome ?? 0), 0);
  const totalTutor = tutorRows.reduce((s, r) => s + (r.cell?.tutorEarnings ?? 0), 0);
  const totalAgency = tutorRows.reduce((s, r) => s + (r.cell?.agencyEarnings ?? 0), 0);
  const totalPayments = tutorRows.reduce((s, r) => s + (r.cell?.paymentCount ?? 0), 0);

  const totalPaid = tutorRows
    .filter(r => weekPaidMap[r.week.id]?.includes(tutor.id))
    .reduce((s, r) => s + (r.cell?.tutorEarnings ?? 0), 0);
  const totalPending = totalTutor - totalPaid;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin/tutors">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tutores
          </button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Megaphone className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Campaña de publicidad diaria</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeCampaign ? (
            <div className="flex items-center justify-between flex-wrap gap-3 rounded-md border border-success/40 bg-success/5 p-3" data-testid="active-campaign">
              <div className="text-sm">
                <span className="font-semibold text-success">Activa</span>{" "}
                <span className="font-medium">USD {Number(activeCampaign.dailyCostUsd).toFixed(2)}/día</span>
                <div className="text-xs text-muted-foreground">
                  Desde {new Date(activeCampaign.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} · {activeCampaign.days} {activeCampaign.days === 1 ? "día" : "días"} acumulados · USD {(activeCampaign.days * Number(activeCampaign.dailyCostUsd)).toFixed(2)} total (50% tutor)
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={endCampaignMutation.isPending}
                onClick={() => endCampaignMutation.mutate(activeCampaign.id)}
                data-testid="btn-end-campaign"
              >Desactivar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                className="h-8 w-32 text-sm"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="USD por día"
                value={campaignInput}
                onChange={e => setCampaignInput(e.target.value)}
                data-testid="input-campaign-cost"
              />
              <Button
                size="sm"
                disabled={startCampaignMutation.isPending || !(Number(campaignInput) > 0)}
                onClick={() => startCampaignMutation.mutate(Number(campaignInput))}
                data-testid="btn-start-campaign"
              >Activar campaña</Button>
              <span className="text-xs text-muted-foreground">Se cobra por día calendario (Perú), 50% tutor / 50% agencia.</span>
            </div>
          )}
          {pastCampaigns.length > 0 && (
            <div>
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() => setShowPastCampaigns(!showPastCampaigns)}
                data-testid="btn-toggle-past-campaigns"
              >
                {showPastCampaigns ? "Ocultar" : "Ver"} campañas pasadas ({pastCampaigns.length})
              </button>
              {showPastCampaigns && (
                <div className="mt-2 space-y-1">
                  {pastCampaigns.map(c => (
                    <div key={c.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="tabular-nums">
                        {new Date(c.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                        {" – "}
                        {c.endDate ? new Date(c.endDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—"}
                      </span>
                      <span>USD {Number(c.dailyCostUsd).toFixed(2)}/día</span>
                      <span>· {c.days} {c.days === 1 ? "día" : "días"}</span>
                      <span className="font-medium">· USD {(c.days * Number(c.dailyCostUsd)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-xl">{tutor.name}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>Comisión: <strong>{tutor.commissionPercent}%</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase">Cobrado</div>
                <div className="text-sm font-bold text-success">{fmt(totalPaid)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase">Pendiente</div>
                <div className="text-sm font-bold text-warning">{fmt(totalPending)}</div>
              </div>
              <Badge variant="outline" className="text-xs">{totalPayments} pagos</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-border bg-muted/50">
                  <th className="text-left px-4 py-3 w-6" />
                  <th className="text-left px-4 py-3 font-semibold">Semana</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground">Estado</th>
                  {allCurrencies.map(c => (
                    <th key={c.code} className="text-right px-4 py-3 font-semibold text-xs text-warning">{c.code}</th>
                  ))}
                  <th className="text-right px-4 py-3 font-semibold">Bruto</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Pub.</th>
                  <th className="text-right px-4 py-3 font-semibold">Neto</th>
                  <th className="text-right px-4 py-3 font-semibold text-success">Tutor</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Agencia</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground">Pago tutor</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">Pgs</th>
                </tr>
              </thead>
              <tbody>
                {tutorRows.map(({ week, cell }) => {
                  const hasActivity = (cell?.paymentCount ?? 0) > 0 || (cell?.tutorAdvertisingShare ?? 0) > 0;
                  const isExpanded = expandedWeek === week.id;
                  const isPaid = weekPaidMap[week.id]?.includes(tutor.id) ?? false;
                  const isMutating = markPaidMutation.isPending || unmarkPaidMutation.isPending;
                  return (
                    <>
                      <tr
                        key={week.id}
                        className={`border-b border-border transition-colors cursor-pointer select-none ${
                          hasActivity ? "hover:bg-muted/40" : "opacity-40"
                        } ${isExpanded ? "bg-muted/30" : ""}`}
                        onClick={() => hasActivity && setExpandedWeek(isExpanded ? null : week.id)}
                        data-testid={`row-week-${week.id}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground/50">
                          {hasActivity && (isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">S{week.weekNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(week.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                            {" – "}
                            {new Date(week.endDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {week.status === "paid" ? (
                            <Badge className="text-xs px-2 py-0 h-5 bg-success">Cerrada</Badge>
                          ) : week.status === "closed" ? (
                            <Badge variant="secondary" className="text-xs px-2 py-0 h-5">Cerrada</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-2 py-0 h-5">Abierta</Badge>
                          )}
                        </td>
                        {allCurrencies.map(c => {
                          const entry = cell?.currencies?.find(x => x.code === c.code);
                          return (
                            <td key={c.code} className="px-4 py-3 text-right tabular-nums text-xs text-warning">
                              {entry ? `${c.code} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entry.total)}` : "—"}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right tabular-nums">{hasActivity ? fmt(cell?.grossIncome ?? 0) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground/70 text-xs" onClick={e => e.stopPropagation()}>
                          {editingAdv === week.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                className="h-6 w-20 text-xs text-right px-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={advInput}
                                onChange={e => setAdvInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") setAdvMutation.mutate({ weekId: week.id, cost: Number(advInput) });
                                  if (e.key === "Escape") setEditingAdv(null);
                                }}
                                autoFocus
                                data-testid={`input-adv-${week.id}`}
                              />
                              <button
                                className="text-success hover:text-success/80"
                                onClick={() => setAdvMutation.mutate({ weekId: week.id, cost: Number(advInput) })}
                                data-testid={`btn-adv-save-${week.id}`}
                              ><Check className="w-3 h-3" /></button>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setEditingAdv(null)}
                                data-testid={`btn-adv-cancel-${week.id}`}
                              ><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end group">
                              {tutorWeekAdvDisabledMap[tutor.id]?.[week.id] ? (
                                <span className="flex flex-col items-end">
                                  <span className="text-xs uppercase text-muted-foreground/60 italic">pub. off</span>
                                  {(cell?.tutorAdvertisingShare ?? 0) > 0 && (
                                    <span title="Publicidad compartida (no afectada por el toggle)">−{fmt(cell!.tutorAdvertisingShare)}</span>
                                  )}
                                </span>
                              ) : (
                                <span>
                                  {(cell?.tutorAdvertisingShare ?? 0) > 0 ? `−${fmt(cell!.tutorAdvertisingShare)}` : "—"}
                                </span>
                              )}
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  const current = tutorWeekAdvMap[tutor.id]?.[week.id] ?? Number(tutor.advertisingCostUsd ?? 0);
                                  setAdvInput(String(current));
                                  setEditingAdv(week.id);
                                }}
                                data-testid={`btn-adv-edit-${week.id}`}
                              ><Pencil className="w-3 h-3" /></button>
                              <button
                                className={`transition-opacity ${
                                  tutorWeekAdvDisabledMap[tutor.id]?.[week.id]
                                    ? "text-destructive opacity-100"
                                    : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                }`}
                                title={tutorWeekAdvDisabledMap[tutor.id]?.[week.id] ? "Publicidad desactivada esta semana (semanal y diaria) — clic para activar" : "Desactivar publicidad de esta semana (semanal y diaria)"}
                                disabled={toggleAdvMutation.isPending}
                                onClick={() => toggleAdvMutation.mutate({ weekId: week.id, disabled: !tutorWeekAdvDisabledMap[tutor.id]?.[week.id] })}
                                data-testid={`btn-adv-toggle-${week.id}`}
                              ><Power className="w-3 h-3" /></button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{hasActivity ? fmt(cell?.netIncome ?? 0) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-success">
                          {hasActivity ? fmt(cell?.tutorEarnings ?? 0) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-muted-foreground">
                          {hasActivity ? fmt(cell?.agencyEarnings ?? 0) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {hasActivity ? (
                            isPaid ? (
                              <Badge
                                className="text-xs px-2 py-0 h-4 bg-success cursor-pointer hover:bg-success/90"
                                onClick={() => !isMutating && unmarkPaidMutation.mutate({ weekId: week.id })}
                              >Pagado</Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0 h-4 cursor-pointer hover:bg-muted"
                                onClick={() => !isMutating && markPaidMutation.mutate({ weekId: week.id })}
                              >Por pagar</Badge>
                            )
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {(cell?.paymentCount ?? 0) > 0 ? cell!.paymentCount : "—"}
                        </td>
                      </tr>
                      {isExpanded && <WeekPayments tutorId={tutor.id} weekId={week.id} />}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50 font-bold">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-sm uppercase text-muted-foreground" colSpan={2}>Total</td>
                  {allCurrencies.map(c => {
                    const total = tutorRows.reduce((s, r) => s + (r.cell?.currencies?.find(x => x.code === c.code)?.total ?? 0), 0);
                    return (
                      <td key={c.code} className="px-4 py-3 text-right tabular-nums text-xs text-warning">
                        {`${c.code} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}`}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totalGross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground/70 text-xs">
                    {totalAdv > 0 ? `−${fmt(totalAdv)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totalNet)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">{fmt(totalTutor)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(totalAgency)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs text-success">{fmt(totalPaid)} cobrado</div>
                    <div className="text-xs text-warning">{fmt(totalPending)} pendiente</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">{totalPayments}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
