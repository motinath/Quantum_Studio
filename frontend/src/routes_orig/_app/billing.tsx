import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, CreditCard, Download, Plus, Sparkles, TrendingUp, Zap, Layers } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth, canAccess } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Usage — Silicofeller" },
      {
        name: "description",
        content:
          "Manage subscriptions, AI credits, invoices, and quantum chip generation usage on Silicofeller.",
      },
    ],
  }),
  component: BillingPage,
});

const summary = [
  {
    label: "AI Credits Remaining",
    value: "12,450",
    hint: "Available generation credits",
    icon: Zap,
  },
  {
    label: "Quantum Designs Generated",
    value: "324",
    hint: "Total generated architectures",
    icon: Layers,
  },
  {
    label: "Current Plan",
    value: "Quantum Pro",
    hint: "Active subscription",
    icon: Sparkles,
  },
  {
    label: "Monthly Usage",
    value: "82%",
    hint: "Credits consumed this month",
    icon: TrendingUp,
    progress: 82,
  },
];

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    features: [
      "1,000 AI Credits",
      "Basic Quantum Designs",
      "Community Support",
      "Standard Generation Queue",
    ],
    cta: "Choose Starter",
    current: false,
  },
  {
    name: "Quantum Pro",
    price: "$99",
    period: "/month",
    features: [
      "10,000 AI Credits",
      "Advanced Optimization",
      "Faster Generation",
      "Architecture Export",
      "Priority Queue",
    ],
    cta: "Current Plan",
    current: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Unlimited Credits",
      "Team Management",
      "Dedicated Infrastructure",
      "SLA Support",
      "API Access",
    ],
    cta: "Contact Sales",
    current: false,
  },
];

const creditTrend = [
  { d: "W1", v: 1800 },
  { d: "W2", v: 2400 },
  { d: "W3", v: 2100 },
  { d: "W4", v: 3200 },
  { d: "W5", v: 2800 },
  { d: "W6", v: 3600 },
  { d: "W7", v: 4100 },
  { d: "W8", v: 4400 },
];
const designs = [
  { m: "Jan", v: 18 },
  { m: "Feb", v: 24 },
  { m: "Mar", v: 31 },
  { m: "Apr", v: 28 },
  { m: "May", v: 42 },
  { m: "Jun", v: 51 },
];
const spend = [
  { m: "Jan", v: 99 },
  { m: "Feb", v: 99 },
  { m: "Mar", v: 129 },
  { m: "Apr", v: 99 },
  { m: "May", v: 149 },
  { m: "Jun", v: 99 },
];
const aiUsage = [
  { d: "Mon", v: 240 },
  { d: "Tue", v: 320 },
  { d: "Wed", v: 280 },
  { d: "Thu", v: 410 },
  { d: "Fri", v: 380 },
  { d: "Sat", v: 200 },
  { d: "Sun", v: 150 },
];

const invoices = [
  { id: "INV-2026-001", date: "May 2026", amount: "$99", status: "Paid" },
  { id: "INV-2026-002", date: "April 2026", amount: "$99", status: "Paid" },
  { id: "INV-2026-003", date: "March 2026", amount: "$99", status: "Paid" },
];

const ACCENT = "#6D5AF0";
const INK = "#0A0A0A";
const MUTED = "#A3A3A3";

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border p-5 shadow-none">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const tooltipStyle = {
  background: "#0A0A0A",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  padding: "6px 10px",
};

function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user && !canAccess(user.role, "billing")) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const [autoRenew, setAutoRenew] = useState(true);
  const [emailInvoice, setEmailInvoice] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);
  const [overage, setOverage] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10"
    >
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-[2rem]">
            Billing &amp; Usage
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage subscriptions, AI credits, invoices, and quantum chip generation usage.
          </p>
        </div>
        <Button
          className="h-10 rounded-full px-5 text-sm font-semibold"
          onClick={() => toast.success("Upgrade flow — demo only")}
        >
          Upgrade Plan
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <Card className="rounded-2xl border-border p-5 shadow-none transition-shadow hover:shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <s.icon className="h-4 w-4 text-accent" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
              {typeof s.progress === "number" && (
                <Progress value={s.progress} className="mt-3 h-1.5" />
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Plans */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Choose Your Plan</h2>
            <p className="text-sm text-muted-foreground">
              Scale credits and capabilities as your team grows.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Card
                className={cn(
                  "relative h-full rounded-3xl border-border p-7 shadow-none",
                  p.current && "border-foreground shadow-[var(--shadow-card)]",
                )}
              >
                {p.badge && (
                  <Badge className="absolute -top-2.5 right-6 rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-medium text-accent hover:bg-[color:var(--accent-soft)]">
                    {p.badge}
                  </Badge>
                )}
                <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {p.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-foreground">{p.price}</span>
                  {p.period && <span className="text-sm text-muted-foreground">{p.period}</span>}
                </div>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    "mt-7 h-11 w-full rounded-full text-sm font-semibold",
                    !p.current && "bg-foreground text-background hover:bg-foreground/90",
                    p.current &&
                      "bg-[color:var(--accent-soft)] text-accent hover:bg-[color:var(--accent-soft)]",
                  )}
                  variant={p.current ? "secondary" : "default"}
                  disabled={p.current}
                  onClick={() => !p.current && toast.success(`${p.name} — demo only`)}
                >
                  {p.cta}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Analytics */}
      <section className="mt-12">
        <h2 className="mb-5 text-xl font-semibold text-foreground">Usage Analytics</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Credit Usage Trend" subtitle="Last 8 weeks">
            <LineChart data={creditTrend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="d" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: ACCENT, strokeOpacity: 0.2 }}
              />
              <Line type="monotone" dataKey="v" stroke={INK} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Quantum Designs Generated" subtitle="Monthly volume">
            <BarChart data={designs} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="m" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(109,90,240,0.08)" }} />
              <Bar dataKey="v" fill={INK} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Monthly Spending" subtitle="USD billed">
            <AreaChart data={spend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="g-spend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="m" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={ACCENT}
                strokeWidth={2}
                fill="url(#g-spend)"
              />
            </AreaChart>
          </ChartCard>

          <ChartCard title="AI Processing Consumption" subtitle="Compute-minutes / day">
            <LineChart data={aiUsage} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="d" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: ACCENT, strokeOpacity: 0.2 }}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke={INK}
                strokeWidth={2}
                dot={{ r: 2.5, fill: ACCENT, stroke: ACCENT }}
              />
            </LineChart>
          </ChartCard>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border-border p-6 shadow-none lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Payment Methods</h2>
            <AddPaymentDialog />
          </div>
          <div className="space-y-3">
            <PaymentRow brand="Visa" last4="4242" exp="12/28" primary />
            <PaymentRow brand="Mastercard" last4="8821" exp="06/27" />
          </div>
        </Card>

        <Card className="rounded-2xl border-border p-6 shadow-none">
          <h2 className="text-base font-semibold text-foreground">Billing Settings</h2>
          <div className="mt-4 space-y-4">
            <ToggleRow label="Auto Renewal" checked={autoRenew} onChange={setAutoRenew} />
            <ToggleRow label="Email Invoice" checked={emailInvoice} onChange={setEmailInvoice} />
            <ToggleRow label="Usage Alerts" checked={usageAlerts} onChange={setUsageAlerts} />
            <ToggleRow label="Overage Notifications" checked={overage} onChange={setOverage} />
          </div>
        </Card>
      </section>

      {/* Invoices */}
      <section className="mt-12">
        <Card className="rounded-2xl border-border p-6 shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Invoices</h2>
            <span className="text-xs text-muted-foreground">{invoices.length} total</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-foreground">{inv.id}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="text-foreground">{inv.amount}</TableCell>
                  <TableCell>
                    <Badge className="rounded-full bg-[color:var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-[color:var(--accent-soft)]">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => toast(`${inv.id}.pdf — demo only`)}
                    >
                      <Download className="mr-1 h-4 w-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </motion.div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PaymentRow({
  brand,
  last4,
  exp,
  primary,
}: {
  brand: string;
  last4: string;
  exp: string;
  primary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-12 items-center justify-center rounded-md border border-border bg-secondary">
          <CreditCard className="h-4 w-4 text-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {brand} ending {last4}
            {primary && (
              <Badge className="rounded-full bg-secondary px-2 py-0 text-[10px] font-medium text-muted-foreground hover:bg-secondary">
                Default
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Expires {exp}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full"
          onClick={() => toast("Edit — demo only")}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => toast("Removed — demo only")}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function AddPaymentDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Add Payment Method
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>Securely add a new card to your billing profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cc-name">Cardholder name</Label>
            <Input id="cc-name" placeholder="Alex Chen" className="mt-1.5 h-10" />
          </div>
          <div>
            <Label htmlFor="cc-number">Card number</Label>
            <Input id="cc-number" placeholder="1234 5678 9012 3456" className="mt-1.5 h-10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cc-exp">Expiry</Label>
              <Input id="cc-exp" placeholder="MM / YY" className="mt-1.5 h-10" />
            </div>
            <div>
              <Label htmlFor="cc-cvc">CVC</Label>
              <Input id="cc-cvc" placeholder="123" className="mt-1.5 h-10" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="h-10 rounded-full px-5"
            onClick={() => {
              setOpen(false);
              toast.success("Card added — demo only");
            }}
          >
            Add card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
