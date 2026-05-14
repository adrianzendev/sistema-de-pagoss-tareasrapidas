import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import type { Week } from "@shared/schema";

type MatrixCell = {
  grossIncome: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  tutorAdvertisingShare: number;
  paymentCount: number;
};

type SettlementsMatrix = {
  weeks: Week[];
  tutors: Array<{ id: string; name: string; commissionPercent: string; advertisingCostUsd?: string }>;
  matrix: Record<string, Record<string, MatrixCell>>;
};

export default function TutorDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: matrixData, isLoading } = useQuery<SettlementsMatrix>({
    queryKey: ["/api/admin/settlements/matrix"],
  });

  const fmt = (n: number) =>
    "S/. " + new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const fmtUsd = (n: number) =>
    "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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

  if (!tutor) {
    return (
      <div className="p-6 text-muted-foreground">
        Tutor no encontrado.{" "}
        <Link href="/admin" className="underline text-primary">Volver</Link>
      </div>
    );
  }

  const advUsd = Number(tutor.advertisingCostUsd ?? 0);
  const tutorRows = weeks.map(w => {
    const cell = matrix[tutor.id]?.[w.id];
    return { week: w, cell };
  });

  const totalGross = tutorRows.reduce((s, r) => s + (r.cell?.grossIncome ?? 0), 0);
  const totalAdv = tutorRows.reduce((s, r) => s + (r.cell?.tutorAdvertisingShare ?? 0), 0);
  const totalNet = tutorRows.reduce((s, r) => s + (r.cell?.netIncome ?? 0), 0);
  const totalTutor = tutorRows.reduce((s, r) => s + (r.cell?.tutorEarnings ?? 0), 0);
  const totalAgency = tutorRows.reduce((s, r) => s + (r.cell?.agencyEarnings ?? 0), 0);
  const totalPayments = tutorRows.reduce((s, r) => s + (r.cell?.paymentCount ?? 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{tutor.name}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>Comisión: <strong>{tutor.commissionPercent}%</strong></span>
                {advUsd > 0 && (
                  <span>P.C: <strong>{fmtUsd(advUsd / 2)}</strong>/sem</span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-xs">{totalPayments} pagos totales</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-border bg-muted/50">
                  <th className="text-left p-3 font-semibold">Semana</th>
                  <th className="text-left p-3 font-semibold text-[10px] text-muted-foreground">Estado</th>
                  <th className="text-right p-3 font-semibold">Bruto</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground/70">Pub.</th>
                  <th className="text-right p-3 font-semibold">Neto</th>
                  <th className="text-right p-3 font-semibold text-purple-600 dark:text-purple-400">Tutor</th>
                  <th className="text-right p-3 font-semibold text-sky-500 dark:text-sky-400">Agencia</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground text-[10px]">Pgs</th>
                </tr>
              </thead>
              <tbody>
                {tutorRows.map(({ week, cell }) => {
                  const hasActivity = (cell?.paymentCount ?? 0) > 0 || (cell?.tutorAdvertisingShare ?? 0) > 0;
                  return (
                    <tr
                      key={week.id}
                      className={`border-b border-border transition-colors ${hasActivity ? "hover:bg-muted/30" : "opacity-40"}`}
                    >
                      <td className="p-3">
                        <div className="font-semibold">S{week.weekNumber}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(week.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                          {" – "}
                          {new Date(week.endDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                        </div>
                      </td>
                      <td className="p-3">
                        {week.status === "paid" ? (
                          <Badge className="text-[9px] px-1 py-0 h-4 bg-green-600">Pagada</Badge>
                        ) : week.status === "closed" ? (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Cerrada</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Abierta</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hasActivity ? fmt(cell?.grossIncome ?? 0) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground/70 text-xs">
                        {(cell?.tutorAdvertisingShare ?? 0) > 0 ? `−${fmt(cell!.tutorAdvertisingShare)}` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">
                        {hasActivity ? fmt(cell?.netIncome ?? 0) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums font-bold text-purple-600 dark:text-purple-400">
                        {hasActivity ? fmt(cell?.tutorEarnings ?? 0) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium text-sky-500 dark:text-sky-400">
                        {hasActivity ? fmt(cell?.agencyEarnings ?? 0) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground text-xs">
                        {(cell?.paymentCount ?? 0) > 0 ? cell!.paymentCount : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50 font-bold">
                  <td className="p-3 text-sm uppercase text-muted-foreground" colSpan={2}>Total</td>
                  <td className="p-3 text-right tabular-nums">{fmt(totalGross)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground/70 text-xs">
                    {totalAdv > 0 ? `−${fmt(totalAdv)}` : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">{fmt(totalNet)}</td>
                  <td className="p-3 text-right tabular-nums text-purple-600 dark:text-purple-400">{fmt(totalTutor)}</td>
                  <td className="p-3 text-right tabular-nums text-sky-500 dark:text-sky-400">{fmt(totalAgency)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground text-xs">{totalPayments}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
