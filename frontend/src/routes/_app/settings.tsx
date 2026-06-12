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
  HelpCircle,
  Pencil,
  X,
  Unlock
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Silicofeller" }] }),
  component: SettingsPage,
});

const COUNTRIES = [
  { code: "+91", flag: "🇮🇳", label: "India (+91)" },
  { code: "+1", flag: "🇺🇸", label: "United States (+1)" },
  { code: "+44", flag: "🇬🇧", label: "United Kingdom (+44)" },
  { code: "+61", flag: "🇦🇺", label: "Australia (+61)" },
  { code: "+81", flag: "🇯🇵", label: "Japan (+81)" },
  { code: "+49", flag: "🇩🇪", label: "Germany (+49)" },
];

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // 1. CREDENTIALS SECTION (Inline editing states)
  const [name, setName] = useState(user?.name ?? "Yaswanth Naga");
  const [tempName, setTempName] = useState(name);
  const [isEditingName, setIsEditingName] = useState(false);

  const [email, setEmail] = useState(user?.email ?? "yaswanth@silicofeller.com");
  const [tempEmail, setTempEmail] = useState(email);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("9876543210");
  const [tempCountryCode, setTempCountryCode] = useState(countryCode);
  const [tempPhoneNumber, setTempPhoneNumber] = useState(phoneNumber);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Password Update Flow states
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"idle" | "verify" | "new">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifyingCurrentPass, setIsVerifyingCurrentPass] = useState(false);
  const [isSavingNewPass, setIsSavingNewPass] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(email);
  const [sendingReset, setSendingReset] = useState(false);

  // 2. PAYMENTS / SUBSCRIPTION STATES
  const [subscriptionPlan, setSubscriptionPlan] = useState<"hobbyist" | "pro" | "enterprise">("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);

  // 3. ADVANCED SETTINGS STATES
  const [developerMode, setDeveloperMode] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState("5");
  const [isClearingCache, setIsClearingCache] = useState(false);

  // 4. FEEDBACK STATES
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Name inline operations
  const startEditName = () => {
    setTempName(name);
    setIsEditingName(true);
  };
  const saveName = () => {
    if (!tempName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setName(tempName);
    setIsEditingName(false);
    toast.success("Name updated successfully!");
  };

  // Email inline operations
  const startEditEmail = () => {
    setTempEmail(email);
    setIsEditingEmail(true);
  };
  const saveEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(tempEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setEmail(tempEmail);
    setIsEditingEmail(false);
    if (tempEmail.toLowerCase() !== email.toLowerCase()) {
      setEmailVerified(false);
      setIsVerifyingEmail(false);
    }
    toast.success("Email address updated!");
  };

  // Trigger email verification
  const handleSendVerification = () => {
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

  // Phone inline operations
  const startEditPhone = () => {
    setTempCountryCode(countryCode);
    setTempPhoneNumber(phoneNumber);
    setIsEditingPhone(true);
  };
  const savePhone = () => {
    if (!tempPhoneNumber.trim() || !/^\d{7,15}$/.test(tempPhoneNumber.trim())) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setCountryCode(tempCountryCode);
    setPhoneNumber(tempPhoneNumber);
    setIsEditingPhone(false);
    toast.success("Contact number updated successfully!");
  };

  // Password progressive change operations
  const startEditPassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStep("verify");
    setIsEditingPassword(true);
  };

  const handleVerifyCurrentPassword = () => {
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    setIsVerifyingCurrentPass(true);
    setTimeout(() => {
      setIsVerifyingCurrentPass(false);
      setPasswordStep("new");
      toast.success("Password verified! Enter your new password below.");
    }, 1000);
  };

  const handleSaveNewPassword = () => {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsSavingNewPass(true);
    setTimeout(() => {
      setIsSavingNewPass(false);
      setPasswordStep("idle");
      setIsEditingPassword(false);
      toast.success("Password changed successfully!");
    }, 1200);
  };

  // Forgot password flow
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
    }, 1200);
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

  // Clear cache action
  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      setIsClearingCache(false);
      toast.success("Simulation cache cleared! 24.8 MB freed.");
    }, 1200);
  };

  // Feedback action
  const handleSubmitFeedback = () => {
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    if (!feedbackText.trim()) {
      toast.error("Please write a comment.");
      return;
    }
    setSubmittingFeedback(true);
    setTimeout(() => {
      setSubmittingFeedback(false);
      setRating(0);
      setFeedbackText("");
      toast.success("Thank you for your feedback!");
    }, 1200);
  };

  // Sign out handler
  const handleSignOut = () => {
    signOut();
    navigate({ to: "/" });
    toast.success("Signed out successfully");
  };

  const activeCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  const tempActiveCountry = COUNTRIES.find((c) => c.code === tempCountryCode) || COUNTRIES[0];

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

        {/* 1. EDIT CREDENTIALS SECTION (With inline editing) */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <User className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-slate-900">Edit Credentials</h2>
          </div>

          <div className="space-y-5">
            {/* Field: Full Name */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-50">
              <div className="sm:w-1/3">
                <Label htmlFor="name-input" className="text-xs font-bold text-slate-500">Full Name</Label>
              </div>
              <div className="flex-1 flex items-center justify-between gap-3">
                {isEditingName ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      id="name-input"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="h-8 rounded-lg text-sm border-slate-200 focus-visible:ring-accent max-w-sm"
                      autoFocus
                    />
                    <Button onClick={saveName} size="sm" className="h-8 rounded-lg bg-accent text-white px-3 hover:opacity-90">
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditingName(false)} size="sm" className="h-8 rounded-lg text-slate-400 p-2">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-800">{name}</span>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      onClick={startEditName}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-slate-50 transition-colors"
                      title="Edit Name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {/* Field: Email */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-50">
              <div className="sm:w-1/3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-input" className="text-xs font-bold text-slate-500">Email Address</Label>
                  {emailVerified ? (
                    <span className="inline-flex items-center text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-between gap-3">
                {isEditingEmail ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      id="email-input"
                      type="email"
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                      className="h-8 rounded-lg text-sm border-slate-200 focus-visible:ring-accent max-w-sm"
                      autoFocus
                    />
                    <Button onClick={saveEmail} size="sm" className="h-8 rounded-lg bg-accent text-white px-3 hover:opacity-90">
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditingEmail(false)} size="sm" className="h-8 rounded-lg text-slate-400 p-2">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-medium text-slate-800">{email}</span>
                    <div className="flex items-center gap-2">
                      {!emailVerified && !isVerifyingEmail && (
                        <button
                          onClick={handleSendVerification}
                          className="text-[10px] font-bold text-accent hover:underline mr-1"
                        >
                          Verify Email
                        </button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        onClick={startEditEmail}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-slate-50 transition-colors"
                        title="Edit Email"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Email code verification details */}
            <AnimatePresence>
              {isVerifyingEmail && !emailVerified && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Enter Verification Code</p>
                      <p className="text-[10px] text-slate-400">Use demo code: 1234</p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        maxLength={4}
                        className="w-16 text-center h-8 text-sm rounded-lg border-slate-200"
                      />
                      <Button onClick={handleConfirmVerification} size="sm" className="h-8 rounded-lg bg-accent text-white px-3">
                        Verify
                      </Button>
                      <Button variant="ghost" onClick={() => setIsVerifyingEmail(false)} size="sm" className="h-8 rounded-lg text-slate-400">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Field: Contact Number */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-50">
              <div className="sm:w-1/3">
                <Label htmlFor="phone-input" className="text-xs font-bold text-slate-500">Contact Number</Label>
              </div>
              <div className="flex-1 flex items-center justify-between gap-3">
                {isEditingPhone ? (
                  <div className="flex items-center gap-2 w-full max-w-sm">
                    <Select value={tempCountryCode} onValueChange={setTempCountryCode}>
                      <SelectTrigger className="h-8 w-24 rounded-lg text-xs border-slate-200 bg-white">
                        <SelectValue>
                          <span className="mr-1">{tempActiveCountry.flag}</span>
                          <span>{tempActiveCountry.code}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-700">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">
                            <span className="mr-2">{c.flag}</span> {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone-input"
                      value={tempPhoneNumber}
                      onChange={(e) => setTempPhoneNumber(e.target.value)}
                      className="h-8 rounded-lg text-sm border-slate-200 focus-visible:ring-accent flex-1"
                      autoFocus
                    />
                    <Button onClick={savePhone} size="sm" className="h-8 rounded-lg bg-accent text-white px-3 hover:opacity-90">
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditingPhone(false)} size="sm" className="h-8 rounded-lg text-slate-400 p-2">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                      <span>{activeCountry.flag}</span>
                      <span className="text-slate-400">{activeCountry.code}</span>
                      <span>{phoneNumber}</span>
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      onClick={startEditPhone}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-slate-50 transition-colors"
                      title="Edit Contact Number"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {/* Field: Password */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-2 border-b border-slate-50">
              <div className="sm:w-1/3 mt-1">
                <Label className="text-xs font-bold text-slate-500">Security Password</Label>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    ••••••••••••
                  </span>
                  {!isEditingPassword && (
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      onClick={startEditPassword}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-slate-50 transition-colors"
                      title="Change Password"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </div>

                {/* Progressive password update view */}
                <AnimatePresence>
                  {isEditingPassword && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border border-slate-100 bg-slate-50/50 rounded-xl p-4 mt-2 space-y-4"
                    >
                      {passwordStep === "verify" && (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="curr-pwd" className="text-xs font-bold text-slate-600">Current Password</Label>
                            <div className="flex gap-2 mt-1">
                              <Input
                                id="curr-pwd"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="h-8 rounded-lg text-sm border-slate-200"
                                placeholder="Enter current password"
                                autoFocus
                              />
                              <Button
                                onClick={handleVerifyCurrentPassword}
                                disabled={isVerifyingCurrentPass}
                                className="h-8 rounded-lg bg-slate-900 text-white text-xs px-3"
                              >
                                {isVerifyingCurrentPass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <button
                              type="button"
                              onClick={() => setShowForgotModal(true)}
                              className="text-accent hover:underline font-bold"
                            >
                              Forgot Password?
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingPassword(false);
                                setPasswordStep("idle");
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {passwordStep === "new" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 max-w-fit">
                            <Unlock className="h-3 w-3" /> Current password verified
                          </div>
                          
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="new-pwd" className="text-xs font-bold text-slate-600">New Password</Label>
                              <Input
                                id="new-pwd"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 h-8 rounded-lg text-sm border-slate-200"
                                placeholder="Min 6 characters"
                                autoFocus
                              />
                            </div>
                            <div>
                              <Label htmlFor="conf-pwd" className="text-xs font-bold text-slate-600">Confirm Password</Label>
                              <Input
                                id="conf-pwd"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 h-8 rounded-lg text-sm border-slate-200"
                                placeholder="Verify password"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setIsEditingPassword(false);
                                setPasswordStep("idle");
                              }}
                              size="sm"
                              className="h-8 text-xs text-slate-500"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSaveNewPassword}
                              disabled={isSavingNewPass}
                              size="sm"
                              className="h-8 rounded-lg bg-accent text-white text-xs px-4"
                            >
                              {isSavingNewPass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Password"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. PAYMENTS & SUBSCRIPTION SECTION (Undisturbed) */}
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

        {/* 3. ADVANCED SETTINGS SECTION (Undisturbed) */}
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

        {/* 4. FEEDBACK SECTION (Undisturbed) */}
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
