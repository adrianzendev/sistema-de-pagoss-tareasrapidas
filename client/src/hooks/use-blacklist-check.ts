import { useState, useEffect } from "react";

export type BlacklistCheck = {
  blacklisted: boolean;
  reason?: string;
};

// Chequea la lista negra 500ms después de que el usuario deja de escribir el número/usuario
// de cliente. Usado en new-payment-modal, verified-payment-modal y tutor/new-payment.
export function useBlacklistCheck(clientNumber: string) {
  const [blacklistWarning, setBlacklistWarning] = useState<BlacklistCheck | null>(null);

  useEffect(() => {
    const checkBlacklist = async () => {
      if (!clientNumber || clientNumber.length < 2) {
        setBlacklistWarning(null);
        return;
      }
      try {
        const res = await fetch(`/api/blacklist/check/${encodeURIComponent(clientNumber)}`);
        if (res.ok) {
          const data: BlacklistCheck = await res.json();
          setBlacklistWarning(data.blacklisted ? data : null);
        }
      } catch {
      }
    };
    const timeout = setTimeout(checkBlacklist, 500);
    return () => clearTimeout(timeout);
  }, [clientNumber]);

  return blacklistWarning;
}
