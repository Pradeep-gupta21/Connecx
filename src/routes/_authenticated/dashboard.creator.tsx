import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import DashboardComponent from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/creator")({
  head: () => ({ meta: [{ title: "Creator dashboard · BrandBridge" }] }),
  component: CreatorDashboard,
});

function CreatorDashboard() {
  const { setActiveRole, activeRole, roles } = useWorkspace();
  useEffect(() => {
    if (roles.includes("creator") && activeRole !== "creator") setActiveRole("creator");
  }, [roles, activeRole, setActiveRole]);
  return <DashboardComponent />;
}
