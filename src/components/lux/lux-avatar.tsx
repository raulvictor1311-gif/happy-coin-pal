import { useMemo } from "react";
import { LUX_POSES, type LuxEmotion } from "@/lib/lux";
import luxHello from "@/assets/lux-hello.png";
import luxThinking from "@/assets/lux-thinking.png";
import luxCelebrating from "@/assets/lux-celebrating.png";

const ART: Record<"hello" | "thinking" | "celebrating", string> = {
  hello: luxHello,
  thinking: luxThinking,
  celebrating: luxCelebrating,
};

const AURA: Record<"primary" | "success" | "warning", string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
};

export type LuxAvatarProps = {
  emotion?: LuxEmotion;
  /** Tamanho em px do lado do avatar. */
  size?: number;
  /** Mostra partículas holográficas ao redor. */
  particles?: boolean;
  className?: string;
};

/**
 * Avatar animado do Lux. Microanimações via CSS (transform/opacity apenas),
 * respeitando `prefers-reduced-motion` pelo utilitário global.
 */
export function LuxAvatar({
  emotion = "feliz",
  size = 64,
  particles = true,
  className = "",
}: LuxAvatarProps) {
  const pose = LUX_POSES[emotion] ?? LUX_POSES.feliz;
  const aura = AURA[pose.aura];
  // Animação mais rápida quanto maior a energia da emoção.
  const duration = useMemo(() => `${(4.2 - pose.energy * 2.2).toFixed(2)}s`, [pose.energy]);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full lux-pulse"
        style={{
          background: `radial-gradient(circle at 50% 55%, color-mix(in oklab, ${aura} 28%, transparent), transparent 68%)`,
          animationDuration: duration,
        }}
      />
      {particles && (
        <>
          <span
            aria-hidden
            className="absolute right-[6%] top-[8%] h-1.5 w-1.5 rounded-full lux-particle"
            style={{ backgroundColor: aura, animationDuration: duration }}
          />
          <span
            aria-hidden
            className="absolute left-[4%] top-[42%] h-1 w-1 rounded-full lux-particle"
            style={{ backgroundColor: aura, animationDelay: "0.7s", animationDuration: duration }}
          />
        </>
      )}
      <img
        src={ART[pose.art]}
        alt={pose.alt}
        loading="lazy"
        width={size}
        height={size}
        draggable={false}
        className="relative h-full w-full object-contain lux-float select-none"
        style={{ animationDuration: duration }}
      />
    </span>
  );
}
