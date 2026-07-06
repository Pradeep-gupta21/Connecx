import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard · Connecx" }] }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { activeRole, roles, loading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (roles.includes("admin")) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    const target =
      (activeRole && activeRole !== "admin" ? activeRole : null) ??
      (roles.includes("advertiser") ? "advertiser" : "creator");
    navigate({
      to: target === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
      replace: true,
    });
  }, [activeRole, roles, loading, navigate]);

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
