import { FileText } from "lucide-react";

export function EmptyPaymentsState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg">No hay pagos</h3>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
