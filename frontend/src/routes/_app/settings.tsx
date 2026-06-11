import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Check,
  LogOut,
  Mail,
  Lock,
  Phone,
  User,
  CreditCard,
  Settings,
  Star,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  KeyRound,
  Trash2,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Silicofeller" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Credentials Section States
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [contactNumber, setContactNumber] = useState("+1 (555) 019-2834");
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Email Verification Flow States
  const [emailVerified, setEmailVerified] = useState(true);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(user?.email ?? "");
  const [sendingReset, setSendingReset] = useState(false);

  // Payments / Subscription States
  const [subscriptionPlan, setSubscriptionPlan] = useState<"hobbyist" | "pro" | "enterprise">("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);

  // Advanced Settings States
  const [developerMode, setDeveloperMode] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState("5");
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Feedback States
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Handle main credentials save (Name, Contact Number)
  const handleSaveCredentials = () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    toast.success("Identity credentials updated successfully!");
  };

  // Handle email modification
  const handleEmailChange = (newVal: string) => {
    setEmail(newVal);
    if (newVal.toLowerCase() === user?.email.toLowerCase()) {
      setEmailVerified(true);
      setIsVerifyingEmail(false);
    } else {
      setEmailVerified(false);
    }
  };

  // Trigger email verification
  const handleSendVerification = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setPendingEmail(email);
    setIsVerifyingEmail(true);
    toast.info(`Verification code sent to ${email}`);
  };

  // Verify email code
  const handleConfirmVerification = () => {
    if (verificationCode === "1234") {
      setEmailVerified(true);
      setIsVerifyingEmail(false);
      setVerificationCode("");
      toast.success("Email verified successfully!");
    } else {
      toast.error("Invalid code. Enter 1234 for demo verification.");
    }
  };

  // Handle password update
  const handleUpdatePassword = () => {
    if (!currentPassword) {
      toast.error("You must provide your current password to set a new one.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    }, 1200);
  };

  // Handle forgot password submission
  const handleSendForgotPassword = () => {
    if (!forgotEmail || !forgotEmail.includes("@")) {
      toast.error("Please provide a valid email address.");
      return;
    }
    setSendingReset(true);
    setTimeout(() => {
      setSendingReset(false);
      setShowForgotModal(false);
      toast.success(`Password reset instructions sent to ${forgotEmail}`);
    }, 1500);
  };

  // Upgrade or Downgrade Subscription
  const handlePlanChange = (plan: "hobbyist" | "pro" | "enterprise") => {
    if (plan === subscriptionPlan) return;
    setIsUpdatingPlan(plan);
    setTimeout(() => {
      setSubscriptionPlan(plan);
      setIsUpdatingPlan(null);
      toast.success(`Plan updated to ${plan.toUpperCase()}!`);
    }, 1200);
  };

  // Clear simulator cache
  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      setIsClearingCache(false);
      toast.success("Simulation cache cleared! 24.8 MB freed.");
    }, 1500);
  };

  // Submit User Feedback
  const handleSubmitFeedback = () => {
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    if (!feedbackText.trim()) {
      toast.error("Please write a short comment about your experience.");
      return;
    }

    setSubmittingFeedback(true);
    setTimeout(() => {
      setSubmittingFeedback(false);
      setRating(0);
      setFeedbackText("");
      toast.success("Thank you for your feedback! We appreciate it.");
    }, 1200);
  };

  // Sign out handler
  const handleSignOut = () => {
    signOut();
    navigate({ to: "/" });
    toast.success("Signed out successfully");
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FB] pb-16 relative">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl px-6 py-8 space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Settings className="h-6 w-6 text-accent animate-spin-slow" />
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your credentials, payments, advanced preferences, and feedback.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full bg-slate-50 text-[10px] font-bold py-1 px-3 border-slate-200 uppercase tracking-wider">
            {user?.role} Mode
          </Badge>
        </div>

        {/* 1. EDIT CREDENTIALS SECTION */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <User className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Edit Credentials</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Name input */}
            <div>
              <Label htmlFor="name" className="text-xs font-bold text-slate-600">Full Name</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 h-9 rounded-xl text-sm border-slate-200 focus-visible:ring-accent"
                />
              </div>
            </div>

            {/* Contact Number input */}
            <div>
              <Label htmlFor="phone" className="text-xs font-bold text-slate-600">Contact Number</Label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="pl-9 h-9 rounded-xl text-sm border-slate-200 focus-visible:ring-accent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            {/* Email input with verification step */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-bold text-slate-600">Email Address</Label>
                <div className="flex items-center gap-1.5">
                  {emailVerified ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-full text-[9px] font-bold px-2">
                      <Check className="h-2.5 w-2.5 mr-0.5 inline" /> Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-full text-[9px] font-bold px-2">
                      Verification Pending
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-sm border-slate-200 focus-visible:ring-accent"
                  />
                </div>
                {!emailVerified && !isVerifyingEmail && (
                  <Button
                    onClick={handleSendVerification}
                    className="h-9 rounded-xl bg-accent text-white text-xs font-bold px-4 hover:bg-accent/95 shadow-sm"
                  >
                    Verify Email
                  </Button>
                )}
              </div>

              {/* Collapsible Verification Code Input */}
              <AnimatePresence>
                {isVerifyingEmail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Enter Verification Code</p>
                        <p className="text-[10px] text-slate-400">We sent a 4-digit code to {pendingEmail} (use demo code: 1234).</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="0000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          maxLength={4}
                          className="w-20 text-center h-8 text-sm rounded-lg border-slate-200 font-mono tracking-widest"
                        />
                        <Button
                          onClick={handleConfirmVerification}
                          size="sm"
                          className="h-8 rounded-lg bg-accent text-white text-xs font-bold px-3"
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setIsVerifyingEmail(false)}
                          size="sm"
                          className="h-8 rounded-lg text-xs text-slate-500"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveCredentials}
              className="h-9 rounded-xl bg-accent text-white text-xs font-bold px-5 hover:bg-accent/95"
            >
              Save Credentials
            </Button>
          </div>

          {/* Password update section */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Change Password</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="curr-pass" className="text-xs font-bold text-slate-600">Current Password</Label>
                <Input
                  id="curr-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 h-9 rounded-xl text-sm border-slate-200"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label htmlFor="new-pass" className="text-xs font-bold text-slate-600">New Password</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 h-9 rounded-xl text-sm border-slate-200"
                  placeholder="At least 6 chars"
                />
              </div>
              <div>
                <Label htmlFor="conf-pass" className="text-xs font-bold text-slate-600">Confirm New Password</Label>
                <Input
                  id="conf-pass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 h-9 rounded-xl text-sm border-slate-200"
                  placeholder="Confirm new pass"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="h-3 w-3" />
                Forgot Password?
              </button>
              <Button
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                className="h-9 rounded-xl bg-slate-900 text-white text-xs font-bold px-5 hover:bg-slate-800"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* 2. PAYMENTS & SUBSCRIPTION SECTION */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-slate-900">Payments & Subscription</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Billing Cycle:</span>
              <button
                onClick={() => setBillingCycle(b => b === "monthly" ? "yearly" : "monthly")}
                className="text-xs font-bold text-accent hover:underline capitalize"
              >
                {billingCycle} (Click to toggle)
              </button>
            </div>
          </div>

          {/* Pricing tiers selector */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Hobbyist Plan */}
            <div
              className={`rounded-2xl border p-4 relative cursor-pointer transition-all ${
                subscriptionPlan === "hobbyist"
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() => handlePlanChange("hobbyist")}
            >
              {subscriptionPlan === "hobbyist" && (
                <Badge className="absolute -top-2.5 right-4 bg-accent text-white text-[8px] font-extrabold uppercase rounded-full">
                  Active Plan
                </Badge>
              )}
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Hobbyist</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">For individuals starting out</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-xl font-black text-slate-900">$0</span>
                <span className="text-[10px] text-slate-400 ml-1">/ month</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-[10px] text-slate-500">
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> 10 Simulation Hours
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Max 8 Qubits
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Community Support
                </li>
              </ul>
              {isUpdatingPlan === "hobbyist" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-5 w-5 text-accent animate-spin" />
                </div>
              )}
            </div>

            {/* Pro Plan */}
            <div
              className={`rounded-2xl border p-4 relative cursor-pointer transition-all ${
                subscriptionPlan === "pro"
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() => handlePlanChange("pro")}
            >
              {subscriptionPlan === "pro" && (
                <Badge className="absolute -top-2.5 right-4 bg-accent text-white text-[8px] font-extrabold uppercase rounded-full">
                  Active Plan
                </Badge>
              )}
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                Pro
                <Sparkles className="h-3 w-3 text-accent fill-accent" />
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Best for professional researchers</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-xl font-black text-slate-900">
                  {billingCycle === "monthly" ? "$49" : "$39"}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">/ month</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-[10px] text-slate-500">
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> 100 Simulation Hours
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Max 64 Qubits
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Priority Cloud QPU Queue
                </li>
              </ul>
              {isUpdatingPlan === "pro" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-5 w-5 text-accent animate-spin" />
                </div>
              )}
            </div>

            {/* Enterprise Plan */}
            <div
              className={`rounded-2xl border p-4 relative cursor-pointer transition-all ${
                subscriptionPlan === "enterprise"
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() => handlePlanChange("enterprise")}
            >
              {subscriptionPlan === "enterprise" && (
                <Badge className="absolute -top-2.5 right-4 bg-accent text-white text-[8px] font-extrabold uppercase rounded-full">
                  Active Plan
                </Badge>
              )}
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Enterprise</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Scale options for large teams</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-xl font-black text-slate-900">
                  {billingCycle === "monthly" ? "$199" : "$159"}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">/ month</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-[10px] text-slate-500">
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Unlimited Compute
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Custom QPU topologies
                </li>
                <li className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" /> Dedicated Account Engineer
                </li>
              </ul>
              {isUpdatingPlan === "enterprise" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-5 w-5 text-accent animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Payment Method details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-12 rounded-md bg-white border border-slate-200 flex items-center justify-center font-display font-black text-[10px] tracking-tight text-blue-900 italic">
                VISA
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Visa ending in 4242</p>
                <p className="text-[10px] text-slate-400">Expiry 12/2028 • Primary Payment Method</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-bold border-slate-200 bg-white text-slate-700">
              Update Billing Card
            </Button>
          </div>
        </Card>

        {/* 3. ADVANCED SETTINGS SECTION (Placed right above feedback) */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Settings className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Advanced Settings</h2>
          </div>

          <div className="space-y-4">
            {/* Auto save configuration */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
              <div>
                <p className="text-xs font-bold text-slate-800">Workspace Auto-Save Interval</p>
                <p className="text-[10px] text-slate-400">Configure how often circuit schematics are auto-saved</p>
              </div>
              <div className="w-[140px]">
                <Select value={autoSaveInterval} onValueChange={setAutoSaveInterval}>
                  <SelectTrigger className="h-8 rounded-lg text-xs border-slate-200">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-700">
                    <SelectItem value="1" className="text-xs">Every 1 min</SelectItem>
                    <SelectItem value="5" className="text-xs">Every 5 mins</SelectItem>
                    <SelectItem value="15" className="text-xs">Every 15 mins</SelectItem>
                    <SelectItem value="0" className="text-xs">Never (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Analytics toggle */}
            <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Telemetry & Analytics</p>
                <p className="text-[10px] text-slate-400">Share anonymous usage data to help us improve design algorithms</p>
              </div>
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={setAnalyticsEnabled}
              />
            </div>

            {/* Developer Mode toggle */}
            <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Developer Mode & Logger</p>
                <p className="text-[10px] text-slate-400">Expose detailed physics logs and debug tooltips in layout designer</p>
              </div>
              <Switch
                checked={developerMode}
                onCheckedChange={setDeveloperMode}
              />
            </div>

            {/* Clear Simulation Cache */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1 border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Clear Simulation Cache</p>
                <p className="text-[10px] text-slate-400">Free local cache occupied by raw statevector and noise simulation logs</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="h-8 rounded-lg text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {isClearingCache ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-slate-400" />
                    Clearing...
                  </>
                ) : (
                  "Clear Cache (24.8 MB)"
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* 4. FEEDBACK SECTION (At the bottom line of the page) */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <MessageSquare className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Provide Feedback</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Rate your experience:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-0.5 text-slate-300 hover:text-amber-400 focus:outline-none transition-colors cursor-pointer"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= (hoveredRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share your suggestions, complaints, or positive thoughts with the Silicofeller engineering team..."
                className="w-full min-h-[70px] max-h-[140px] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-accent resize-y transition-shadow"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmitFeedback}
                disabled={submittingFeedback}
                className="h-8 rounded-lg bg-accent text-white text-xs font-bold px-4 hover:bg-accent/95"
              >
                {submittingFeedback ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 2. LOGOUT BUTTON (Placed at the bottom-right corner of the page) */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={handleSignOut}
          className="rounded-full shadow-lg h-10 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 px-5 flex items-center gap-2 font-bold text-xs"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-bold text-slate-900">Forgot Password?</h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Enter your email address below, and we will dispatch a password recovery link to your inbox.
              </p>
              <div>
                <Label htmlFor="forgot-email" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="mt-1.5 h-9 rounded-xl text-sm border-slate-200"
                  placeholder="you@company.com"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowForgotModal(false)}
                  className="h-8 rounded-lg text-xs text-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendForgotPassword}
                  disabled={sendingReset}
                  className="h-8 rounded-lg bg-slate-900 text-white text-xs font-bold px-4"
                >
                  {sendingReset ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
