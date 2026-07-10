import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "advertiser" | "creator" | "admin" | "moderator";
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type WorkspaceContextValue = {
  activeRole: AppRole | null;
  setActiveRole: (r: AppRole) => void;
  roles: AppRole[];
  profile: Profile | null;
  loading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
const STORAGE_KEY = "brandbridge-active-role";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, bio, location, active_role, onboarded, created_at, updated_at, country, deleted_at, suspended_at, suspended_reason, banner_url, banner_position, avatar_updated_at, banner_updated_at, username"
        )
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      // User/profile deleted -> immediately sign out.
      if (!data) {
        await supabase.auth.signOut();
        return null;
      }

      const { data: phone } = await supabase.rpc("get_my_phone");

      return {
        ...data,
        phone: (phone as string | null) ?? null,
      } as Profile;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (error) throw error;

      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  useEffect(() => {
    if (!user || !rolesQuery.data) return;

    const stored =
      typeof window !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as AppRole | null)
        : null;

    const fromProfile =
      (profileQuery.data?.active_role as AppRole | null | undefined) ?? null;

    const next =
      (stored && rolesQuery.data.includes(stored) ? stored : null) ??
      fromProfile ??
      rolesQuery.data[0] ??
      null;

    setActiveRoleState(next);
  }, [user, rolesQuery.data, profileQuery.data]);

  // Safety check: if the profile disappears while logged in,
  // immediately sign the user out.
  useEffect(() => {
    if (!user) return;

    if (
      !profileQuery.isLoading &&
      profileQuery.data === null &&
      profileQuery.status === "success"
    ) {
      supabase.auth.signOut();
    }
  }, [user, profileQuery.data, profileQuery.isLoading, profileQuery.status]);

  const setActiveRole = (r: AppRole) => {
    setActiveRoleState(r);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, r);
    }

    if (user) {
      supabase
        .from("profiles")
        .update({ active_role: r })
        .eq("id", user.id)
        .then(() => {});
    }
  };

  const value = useMemo(
    () => ({
      activeRole,
      setActiveRole,
      roles: rolesQuery.data ?? [],
      profile: profileQuery.data ?? null,
      loading:
        profileQuery.isLoading ||
        rolesQuery.isLoading,
    }),
    [
      activeRole,
      rolesQuery.data,
      profileQuery.data,
      profileQuery.isLoading,
      rolesQuery.isLoading,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);

  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return ctx;
}