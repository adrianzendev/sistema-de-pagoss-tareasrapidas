import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Week } from "@shared/schema";

// Liquidación semana a semana de un tutor (vista del tutor y del admin)
export type WeeklySettlementRow = {
  week: Week;
  grossIncome: number;
  netIncome: number;
  tutorAdvertisingShare: number;
  sharedAdvertisingUsd: number;
  usdRate: number;
  dailyAdvUsd?: number;
  dailyAdvDays?: number;
  tutorEarnings: number;
  payments: unknown[];
};

const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPen = (n: number) => `${fmt(n)} PEN`;
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" });

function weekStatusBadge(status: string) {
  switch (status) {
    case "open": return <Badge variant="default">Abierta</Badge>;
    case "closed": return <Badge variant="secondary">Cerrada</Badge>;
    case "paid": return <Badge className="border-success/40 bg-background text-success">Pagada</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export function WeeklySettlementTable({ settlements, commissionPercent }: { settlements: WeeklySettlementRow[]; commissionPercent: number }) {
  const totals = settlements.reduce(
    (acc, s) => ({
      grossIncome: acc.grossIncome + s.grossIncome,
      netIncome: acc.netIncome + s.netIncome,
      advertising: acc.advertising + s.tutorAdvertisingShare,
      tutorEarnings: acc.tutorEarnings + s.tutorEarnings,
    }),
    { grossIncome: 0, netIncome: 0, advertising: 0, tutorEarnings: 0 },
  );

  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">#</TableHead>
          <TableHead className="text-center">Semana</TableHead>
          <TableHead className="text-center">Período</TableHead>
          <TableHead className="text-center">Estado</TableHead>
          <TableHead className="text-center">Pagos</TableHead>
          <TableHead className="text-right">Bruto</TableHead>
          <TableHead className="text-right">× {commissionPercent}%</TableHead>
          <TableHead className="text-right">− Publicidad</TableHead>
          <TableHead className="text-right">Ganancia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {settlements.map((s, index) => {
          const n = s.week.weekNumber;
          return (
            <TableRow key={s.week.id} data-testid={`row-settlement-${n}`}>
              <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="text-center" data-testid={`text-week-${n}`}>S{n}</TableCell>
              <TableCell className="text-center whitespace-nowrap">{fmtDate(s.week.startDate)} - {fmtDate(s.week.endDate)}</TableCell>
              <TableCell className="text-center">{weekStatusBadge(s.week.status)}</TableCell>
              <TableCell className="text-center" data-testid={`text-payments-${n}`}>{s.payments.length}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums" data-testid={`text-gross-${n}`}>{fmtPen(s.grossIncome)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums" data-testid={`text-net-commission-${n}`}>{fmtPen(s.netIncome)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums" data-testid={`text-advertising-${n}`}>
                {s.tutorAdvertisingShare > 0 ? (
                  <>
                    <span title={`$${fmt(s.sharedAdvertisingUsd)} USD × TC ${fmt(s.usdRate)}`}>-{fmtPen(s.tutorAdvertisingShare)}</span>
                    {(s.dailyAdvUsd ?? 0) > 0 && (
                      <div className="text-xs font-normal text-muted-foreground" data-testid={`text-daily-adv-${n}`}>
                        incl. diaria: {s.dailyAdvDays} {s.dailyAdvDays === 1 ? "día" : "días"} = ${fmt(s.dailyAdvUsd ?? 0)} USD (50%)
                      </div>
                    )}
                  </>
                ) : fmtPen(0)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums" data-testid={`text-earnings-${n}`}>
                {fmtPen(s.tutorEarnings)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="font-semibold hover:bg-transparent">
          <TableCell colSpan={5} className="text-right">TOTALES:</TableCell>
          <TableCell className="text-right tabular-nums" data-testid="text-total-gross-row">{fmtPen(totals.grossIncome)}</TableCell>
          <TableCell className="text-right tabular-nums" data-testid="text-total-net-row">{fmtPen(totals.netIncome)}</TableCell>
          <TableCell className="text-right tabular-nums" data-testid="text-total-advertising-row">
            {totals.advertising > 0 ? `-${fmtPen(totals.advertising)}` : fmtPen(0)}
          </TableCell>
          <TableCell className="text-right tabular-nums" data-testid="text-total-earnings-row">
            {fmtPen(totals.tutorEarnings)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
