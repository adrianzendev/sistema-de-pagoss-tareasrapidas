import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Maneja la subida del comprobante en los 3 formularios de pago: valida tipo/tamaño
// y convierte a base64. Usado en new-payment-modal, verified-payment-modal y tutor/new-payment.
export function useProofImageUpload() {
  const { toast } = useToast();
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen debe ser menor a 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Error", description: "No se pudo procesar la imagen", variant: "destructive" });
      setIsUploading(false);
    }
  };

  return { proofImage, setProofImage, isUploading, handleFileChange };
}
