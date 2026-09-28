// Config compartida de estados de pago (label + color). Usada en las tablas/badges
// de admin/payments, admin/tutor-view, tutor/payments y verifier/payments.
export const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "text-warning border-warning/40" },
  verified: { label: "Verificado", className: "text-success border-success/40" },
  autoverificado: { label: "Autoverificado", className: "text-primary border-primary/40" },
  rejected: { label: "Rechazado", className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", className: "text-muted-foreground border-border" },
};
