import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { QuantumHero } from "@/components/auth/quantum-hero";

export const Route = createFileRoute("/_auth/session-timeout")({
  head: () => ({
    meta: [
      { title: "Session Expired — Silicofeller" },
      {
        name: "description",
        content: "Your session has expired due to inactivity. Please sign in again to continue.",
      },
    ],
  }),
  component: SessionTimeoutPage,
});

function SessionTimeoutPage() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-8 px-6 pb-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:px-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:block"
      >
        <QuantumHero
          eyebrow="Quantum chip design platform"
          headline="Keep Your Designs Secure"
          description="We prioritize the confidentiality and safety of your intellectual quantum properties. Your session is protected."
        />
      </motion.section>

      <section className="flex items-center justify-center py-6 lg:py-12">
        <div className="w-full max-w-[440px] space-y-5">
          <AuthCard
            title="Session Expired"
            subtitle="You have been signed out due to inactivity."
            footer={
              <Link to="/sign-in" className="font-medium text-accent hover:text-accent/80">
                Back to sign in
              </Link>
            }
          >
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-950 mb-2">Inactivity Timeout</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[320px] mb-8">
                Your session was automatically logged out for security after 10 minutes of idle time.
                Any unsaved actions might require re-entry.
              </p>

              <Button
                asChild
                className="h-11 w-full rounded-full text-sm font-semibold gap-1.5 shadow-md shadow-accent/15"
              >
                <Link to="/sign-in">
                  Sign In Again <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </AuthCard>
        </div>
      </section>
    </div>
  );
}
