import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client, normalizePhone } from "@shared/schema";

// Dropdown de clientes existentes mientras se escribe el teléfono/usuario, con cierre al
// hacer clic afuera. Usado en new-payment-modal y verified-payment-modal.
export function useClientAutocomplete(clientNumber: string, onSelect: (phoneNumber: string) => void) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: allClients } = useQuery<Client[]>({
    queryKey: ["/api/clients/search"],
    queryFn: async () => {
      const res = await fetch("/api/clients/search?q=");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (!clientNumber || clientNumber.length < 1) {
      setFilteredClients([]);
      return;
    }
    const normalized = normalizePhone(clientNumber);
    const matches = (allClients || []).filter(c =>
      c.normalizedPhone.includes(normalized) ||
      c.phoneNumber.toLowerCase().includes(clientNumber.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(clientNumber.toLowerCase()))
    ).slice(0, 8);
    setFilteredClients(matches);
  }, [clientNumber, allClients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectClient = (client: Client) => {
    onSelect(client.phoneNumber);
    setShowSuggestions(false);
  };

  return { filteredClients, showSuggestions, setShowSuggestions, suggestionsRef, selectClient };
}
