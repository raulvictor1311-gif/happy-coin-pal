import type { ReactNode } from "react";
import { LuxAvatar } from "@/components/lux/lux-avatar";
import type { LuxEmotion } from "@/lib/lux";

/** Lux falando com o usuário: avatar + balão de fala. */
export function LuxBubble({
  emotion = "feliz",
  size = 56,
  children,
  className = "",
}: {
  emotion?: LuxEmotion;
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <LuxAvatar emotion={emotion} size={size} />
      <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-card-elevated border border-border px-4 py-3 text-sm text-foreground leading-snug animate-in fade-in slide-in-from-left-1 duration-300">
        {children}
      </div>
    </div>
  );
}
