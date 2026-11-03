import { useCallback, useEffect, useState } from "react";
import {
  invitationsApiService,
  type PersonalTicket,
} from "../services/invitations.api";

export function useMyTickets() {
  const [tickets, setTickets] = useState<PersonalTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invitationsApiService.fetchMyTickets({ pageSize: 50 });
      setTickets(res.items || []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách vé cá nhân.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
  };
}
