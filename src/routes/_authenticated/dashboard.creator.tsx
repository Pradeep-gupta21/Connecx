import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreatorDashboardView } from "@/components/dashboard/CreatorDashboardView";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/_authenticated/dashboard/creator")({
  head: () => ({ meta: [{ title: "Creator dashboard · Connecx" }] }),
  component: CreatorDashboard,
});

function CreatorDashboard() {
  const { setActiveRole, activeRole, roles } = useWorkspace();
  useEffect(() => {
    if (roles.includes("creator") && activeRole !== "creator") setActiveRole("creator");
  }, [roles, activeRole, setActiveRole]);
  return <CreatorDashboardView />;
}
