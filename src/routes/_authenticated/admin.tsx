import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, ShieldAlert } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Console · Connecx" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const { loading } = useWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-6 surface-card p-10"
        >
          <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Restricted area</h1>
            <p className="text-sm text-muted-foreground">
              The admin console is limited to platform operators. If you believe you should have access, contact a platform administrator.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
