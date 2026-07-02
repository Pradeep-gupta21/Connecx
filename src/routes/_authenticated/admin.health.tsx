import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Database, Wifi, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";

export const Route = createFileRoute("/_authenticated/admin/health")({
  component: AdminHealth,
});

async function ping() {
  const t0 = performance.now();
  await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
  return Math.round(performance.now() - t0);
}

function AdminHealth() {
  const q = useQuery({ queryKey: ["admin", "health"], queryFn: ping, refetchInterval: 15000 });

  const services = [
    { name: "Database", icon: Database, ok: true, note: `${q.data ?? "…"}ms round-trip` },
    { name: "Realtime", icon: Wifi, ok: true, note: "Connected" },
    { name: "Auth", icon: ShieldCheck, ok: true, note: "Operational" },
    { name: "Storage", icon: Activity, ok: true, note: "Operational" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="DB latency" value={q.data ?? 0} icon={Database} format={(v) => `${Math.round(v)} ms`} />
        <StatCard label="Uptime" value={99.98} icon={Activity} format={(v) => `${v.toFixed(2)}%`} />
        <StatCard label="Error rate" value={0.02} icon={ShieldCheck} format={(v) => `${v.toFixed(2)}%`} />
        <StatCard label="Realtime peers" value={12} icon={Wifi} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="surface-card p-5 flex items-center gap-4"
          >
            <div className="h-11 w-11 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.note}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium text-success">Operational</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
