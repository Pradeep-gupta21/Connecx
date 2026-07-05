import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Landmark,
  Smartphone,
  Plus,
  Star,
  Trash2,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// payout_methods types are generated after the migration runs; use a loose
// alias here so this compiles regardless of the current types.ts snapshot.
const supabase = supabaseTyped as unknown as {
  from: (t: string) => {
    select: (...args: unknown[]) => any;
    insert: (...args: unknown[]) => any;
    update: (...args: unknown[]) => any;
    delete: (...args: unknown[]) => any;
  };
};

type MethodType = "bank" | "upi";
type VerificationStatus = "pending" | "verified" | "rejected";
type BankAccountType = "savings" | "current";

interface PayoutMethod {
  id: string;
  user_id: string;
  method_type: MethodType;
  label: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_last4: string | null;
  ifsc: string | null;
  account_type: BankAccountType | null;
  upi_id: string | null;
  is_default: boolean;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  created_at: string;
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/;

export function PayoutMethods() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayoutMethod | null>(null);
  const [tab, setTab] = useState<MethodType>("bank");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payout_methods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods" as never)
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayoutMethod[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["payout_methods", user?.id] });

  const openNew = (type: MethodType) => {
    setTab(type);
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m: PayoutMethod) => {
    setTab(m.method_type);
    setEditing(m);
    setDialogOpen(true);
  };

  const setDefault = async (id: string) => {
    const { error } = await supabase
      .from("payout_methods" as never)
      .update({ is_default: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Default payout method updated");
    refresh();
  };

  const remove = async () => {
    if (!deletingId) return;
    const { error } = await supabase
      .from("payout_methods" as never)
      .delete()
      .eq("id", deletingId);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    toast.success("Payout method removed");
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Payout methods</h2>
          <p className="text-sm text-muted-foreground">
            Where withdrawals will be sent. Admin verifies every account before payout.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNew("upi")}>
            <Smartphone className="h-4 w-4 mr-2" /> Add UPI
          </Button>
          <Button onClick={() => openNew("bank")}>
            <Plus className="h-4 w-4 mr-2" /> Add bank account
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="surface-card p-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : methods.length === 0 ? (
        <div className="surface-card p-10 text-center space-y-3">
          <Landmark className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">No payout methods yet</p>
            <p className="text-sm text-muted-foreground">
              Add a bank account to receive your earnings.
            </p>
          </div>
          <Button onClick={() => openNew("bank")}>
            <Plus className="h-4 w-4 mr-2" /> Add bank account
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {methods.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <PayoutCard
                  m={m}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeletingId(m.id)}
                  onSetDefault={() => setDefault(m.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <PayoutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={tab}
        setType={setTab}
        editing={editing}
        existing={methods}
        onSaved={refresh}
        userId={user?.id ?? ""}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payout method?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified")
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        <ShieldCheck className="h-3 w-3 mr-1" /> Verified
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">
        <ShieldAlert className="h-3 w-3 mr-1" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
      <Clock className="h-3 w-3 mr-1" /> Pending verification
    </Badge>
  );
}

function PayoutCard({
  m,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  m: PayoutMethod;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const Icon = m.method_type === "bank" ? Landmark : Smartphone;
  return (
    <div
      className={cn(
        "surface-card p-5 space-y-4 transition-all hover:shadow-md",
        m.is_default && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium leading-tight">
                {m.method_type === "bank"
                  ? m.bank_name || "Bank account"
                  : "UPI"}
              </p>
              {m.is_default && (
                <Badge variant="outline" className="text-xs">
                  <Star className="h-3 w-3 mr-1 fill-current" /> Default
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {m.method_type === "bank"
                ? `${m.account_holder_name} · •••• ${m.account_number_last4} · ${m.ifsc}`
                : m.upi_id}
            </p>
            {m.method_type === "bank" && m.account_type && (
              <p className="text-xs text-muted-foreground capitalize">{m.account_type} account</p>
            )}
          </div>
        </div>
        <VerificationBadge status={m.verification_status} />
      </div>

      {m.verification_status === "rejected" && m.rejection_reason && (
        <p className="text-xs text-red-600 bg-red-500/5 p-2 rounded-md border border-red-500/10">
          {m.rejection_reason}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {!m.is_default && (
          <Button size="sm" variant="ghost" onClick={onSetDefault}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Set default
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );
}

function PayoutDialog({
  open,
  onOpenChange,
  type,
  setType,
  editing,
  existing,
  onSaved,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: MethodType;
  setType: (t: MethodType) => void;
  editing: PayoutMethod | null;
  existing: PayoutMethod[];
  onSaved: () => void;
  userId: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit payout method" : "Add payout method"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Updating account details will re-set verification to pending."
              : "Your details are stored securely. Admin verifies every account before withdrawals."}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <PayoutForm
            type={type}
            editing={editing}
            existing={existing}
            userId={userId}
            onDone={() => {
              onSaved();
              onOpenChange(false);
            }}
          />
        ) : (
          <Tabs value={type} onValueChange={(v) => setType(v as MethodType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bank">
                <Landmark className="h-4 w-4 mr-2" /> Bank
              </TabsTrigger>
              <TabsTrigger value="upi">
                <Smartphone className="h-4 w-4 mr-2" /> UPI
              </TabsTrigger>
            </TabsList>
            <TabsContent value="bank" className="mt-4">
              <PayoutForm
                type="bank"
                editing={null}
                existing={existing}
                userId={userId}
                onDone={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              />
            </TabsContent>
            <TabsContent value="upi" className="mt-4">
              <PayoutForm
                type="upi"
                editing={null}
                existing={existing}
                userId={userId}
                onDone={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayoutForm({
  type,
  editing,
  existing,
  userId,
  onDone,
}: {
  type: MethodType;
  editing: PayoutMethod | null;
  existing: PayoutMethod[];
  userId: string;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);

  // bank fields
  const [holder, setHolder] = useState(editing?.account_holder_name ?? "");
  const [bankName, setBankName] = useState(editing?.bank_name ?? "");
  const [acc, setAcc] = useState("");
  const [accConfirm, setAccConfirm] = useState("");
  const [ifsc, setIfsc] = useState(editing?.ifsc ?? "");
  const [accType, setAccType] = useState<BankAccountType>(editing?.account_type ?? "savings");

  // upi
  const [upi, setUpi] = useState(editing?.upi_id ?? "");

  const [isDefault, setIsDefault] = useState(
    editing?.is_default ?? existing.length === 0,
  );

  const submit = async () => {
    if (type === "bank") {
      if (!holder.trim()) return toast.error("Account holder name is required");
      if (!bankName.trim()) return toast.error("Bank name is required");
      if (!editing) {
        if (!acc || acc.length < 6) return toast.error("Enter a valid account number");
        if (acc !== accConfirm) return toast.error("Account numbers do not match");
      }
      if (!IFSC_RE.test(ifsc.toUpperCase()))
        return toast.error("IFSC must be 11 characters, e.g. HDFC0001234");
    } else {
      if (!UPI_RE.test(upi.trim())) return toast.error("Enter a valid UPI ID, e.g. name@bank");
    }

    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { is_default: isDefault };
        if (type === "bank") {
          payload.account_holder_name = holder.trim();
          payload.bank_name = bankName.trim();
          payload.ifsc = ifsc.toUpperCase();
          payload.account_type = accType;
          if (acc) payload.account_number = acc;
        } else {
          payload.upi_id = upi.trim();
        }
        // any material change resets verification to pending
        if (
          type === "bank"
            ? holder !== editing.account_holder_name ||
              bankName !== editing.bank_name ||
              ifsc.toUpperCase() !== editing.ifsc ||
              accType !== editing.account_type ||
              !!acc
            : upi.trim() !== editing.upi_id
        ) {
          payload.verification_status = "pending";
          payload.rejection_reason = null;
        }
        const { error } = await supabase
          .from("payout_methods" as never)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Payout method updated");
      } else {
        const payload: Record<string, unknown> = {
          user_id: userId,
          method_type: type,
          is_default: isDefault,
        };
        if (type === "bank") {
          payload.account_holder_name = holder.trim();
          payload.bank_name = bankName.trim();
          payload.account_number = acc;
          payload.ifsc = ifsc.toUpperCase();
          payload.account_type = accType;
        } else {
          payload.upi_id = upi.trim();
        }
        const { error } = await (supabase as unknown as { from: (t: string) => any }).from("payout_methods").insert(payload);
        if (error) {
          if (error.code === "23505")
            throw new Error("You've already added this account");
          throw error;
        }
        toast.success("Payout method added");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save payout method");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {type === "bank" ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Account holder name</Label>
              <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As per bank" />
            </div>
            <div className="space-y-2">
              <Label>Bank name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Account number {editing && <span className="text-xs text-muted-foreground">(leave blank to keep)</span>}</Label>
              <Input
                value={acc}
                onChange={(e) => setAcc(e.target.value.replace(/\s+/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                placeholder={editing ? `•••• ${editing.account_number_last4 ?? ""}` : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm account number</Label>
              <Input
                value={accConfirm}
                onChange={(e) => setAccConfirm(e.target.value.replace(/\s+/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>IFSC code</Label>
              <Input
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                maxLength={11}
                placeholder="HDFC0001234"
              />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select value={accType} onValueChange={(v) => setAccType(v as BankAccountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label>UPI ID</Label>
          <Input
            value={upi}
            onChange={(e) => setUpi(e.target.value.trim())}
            placeholder="yourname@bank"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Works with Google Pay, PhonePe, Paytm, and BHIM.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-input"
        />
        Set as default payout method
      </label>

      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add payout method"}
        </Button>
      </DialogFooter>
    </div>
  );
}
