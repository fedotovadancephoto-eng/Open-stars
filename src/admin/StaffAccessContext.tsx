import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import {
  fetchStaffIdentity,
  getStaffSession,
  STAFF_SESSION_CHANGED_EVENT,
  StaffIdentity,
  StaffRole,
} from "@/admin/adminApi";

type StaffAccessValue = {
  identity: StaffIdentity | null;
  role: StaffRole | null;
  loading: boolean;
};

const StaffAccessContext = createContext<StaffAccessValue>({ identity: null, role: null, loading: true });

export function StaffAccessProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      if (!getStaffSession()) {
        if (!cancelled) {
          setIdentity(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const nextIdentity = await fetchStaffIdentity();
        if (!cancelled) setIdentity(nextIdentity);
      } catch {
        if (!cancelled) setIdentity(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const handleSessionChange = () => { void loadIdentity(); };
    void loadIdentity();
    window.addEventListener(STAFF_SESSION_CHANGED_EVENT, handleSessionChange);
    window.addEventListener("storage", handleSessionChange);
    return () => {
      cancelled = true;
      window.removeEventListener(STAFF_SESSION_CHANGED_EVENT, handleSessionChange);
      window.removeEventListener("storage", handleSessionChange);
    };
  }, []);

  const value = useMemo<StaffAccessValue>(() => ({
    identity,
    role: identity?.role || null,
    loading,
  }), [identity, loading]);

  return <StaffAccessContext.Provider value={value}>{children}</StaffAccessContext.Provider>;
}

export function useStaffAccess() {
  return useContext(StaffAccessContext);
}
