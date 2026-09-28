import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

// Carga el comprobante de un pago on-demand (no viene en la lista, solo al abrir la vista previa).
// `endpoint` es la URL completa ya armada, p. ej. `/api/admin/payments/${id}/proof`.
export function ProofImagePreview({ endpoint }: { endpoint: string }) {
  const { data, isLoading } = useQuery<{ proofImage: string | null }>({
    queryKey: [endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar comprobante");
      return res.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <Skeleton className="w-full h-64 rounded-lg" />;
  if (!data?.proofImage) return null;
  return <img src={data.proofImage} alt="Comprobante" className="w-full rounded-lg" />;
}
