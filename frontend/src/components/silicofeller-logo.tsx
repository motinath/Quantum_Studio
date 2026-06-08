import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export function SilicofellerLogo({ className, iconClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Image 2 - Silicofeller logo (first) */}
      <img
        src="/logo-removebg-preview.png"
        alt="Silicofeller"
        className={cn("h-10 w-auto object-contain", iconClassName)}
      />

      {/* Divider */}
      <div className="h-8 w-px bg-gray-400" />

      {/* Image 1 - NVIDIA Inception Program (second) */}
      <img
        src="/nvidia-inception-program-badge-rgb-1c-blk-for-screen.png"
        alt="NVIDIA Inception Program"
        className="h-10 w-auto object-contain"
      />
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <img
        src="/logo-removebg-preview.png"
        alt="Silicofeller"
        className="h-7 w-auto object-contain"
      />
    </div>
  );
}
