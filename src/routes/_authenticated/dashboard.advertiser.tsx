import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdvertiserDashboardView } from "@/components/dashboard/AdvertiserDashboardView";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/_authenticated/dashboard/advertiser")({
  head: () => ({ meta: [{ title: "Advertiser dashboard · BrandBridge" }] }),
  component: AdvertiserDashboard,
});

function AdvertiserDashboard() {
  const { setActiveRole, activeRole, roles } = useWorkspace();
  useEffect(() => {
    if (roles.includes("advertiser") && activeRole !== "advertiser") setActiveRole("advertiser");
  }, [roles, activeRole, setActiveRole]);
  return <AdvertiserDashboardView />;
}

