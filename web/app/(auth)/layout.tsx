import type { ReactNode } from "react";
import {
  Bot,
  Sparkles,
  Brain,
  Cpu,
  Zap,
  Network,
  Workflow,
  Cog,
  MessageSquare,
  GitBranch,
  Terminal,
  Atom,
  CircuitBoard,
  Command,
  Layers,
  Radio,
} from "lucide-react";

type FloatIcon = {
  Icon: typeof Bot;
  top: string;
  left: string;
  size: number;
  color: string;
  opacity: number;
  drift: string;
  duration: string;
  delay: string;
  rotate: string;
};

const ICONS: FloatIcon[] = [
  { Icon: Bot, top: "8%", left: "6%", size: 72, color: "var(--v7-teal)", opacity: 0.5, drift: "float-a", duration: "14s", delay: "0s", rotate: "-8deg" },
  { Icon: Sparkles, top: "14%", left: "78%", size: 56, color: "var(--v7-blue)", opacity: 0.55, drift: "float-b", duration: "11s", delay: "1s", rotate: "12deg" },
  { Icon: Brain, top: "30%", left: "12%", size: 88, color: "var(--v7-pink)", opacity: 0.4, drift: "float-c", duration: "18s", delay: "2s", rotate: "6deg" },
  { Icon: Cpu, top: "26%", left: "68%", size: 64, color: "var(--v7-lime)", opacity: 0.5, drift: "float-a", duration: "13s", delay: "3s", rotate: "-14deg" },
  { Icon: Zap, top: "48%", left: "4%", size: 52, color: "var(--v7-amber)", opacity: 0.55, drift: "float-b", duration: "10s", delay: "0.5s", rotate: "-20deg" },
  { Icon: Network, top: "46%", left: "88%", size: 80, color: "var(--v7-teal)", opacity: 0.45, drift: "float-c", duration: "17s", delay: "4s", rotate: "10deg" },
  { Icon: Workflow, top: "62%", left: "18%", size: 68, color: "var(--v7-blue)", opacity: 0.5, drift: "float-a", duration: "15s", delay: "1.5s", rotate: "-6deg" },
  { Icon: Cog, top: "70%", left: "76%", size: 92, color: "var(--v7-pink)", opacity: 0.35, drift: "float-spin", duration: "24s", delay: "0s", rotate: "0deg" },
  { Icon: MessageSquare, top: "82%", left: "38%", size: 56, color: "var(--v7-lime)", opacity: 0.5, drift: "float-b", duration: "12s", delay: "2.5s", rotate: "8deg" },
  { Icon: GitBranch, top: "18%", left: "42%", size: 48, color: "var(--v7-amber)", opacity: 0.5, drift: "float-c", duration: "16s", delay: "3.5s", rotate: "-10deg" },
  { Icon: Terminal, top: "86%", left: "8%", size: 60, color: "var(--v7-teal)", opacity: 0.5, drift: "float-a", duration: "13s", delay: "1s", rotate: "4deg" },
  { Icon: Atom, top: "78%", left: "58%", size: 76, color: "var(--v7-blue)", opacity: 0.45, drift: "float-spin", duration: "20s", delay: "0s", rotate: "0deg" },
  { Icon: CircuitBoard, top: "54%", left: "48%", size: 84, color: "var(--v7-pink)", opacity: 0.3, drift: "float-c", duration: "19s", delay: "5s", rotate: "14deg" },
  { Icon: Command, top: "6%", left: "46%", size: 44, color: "var(--v7-lime)", opacity: 0.55, drift: "float-b", duration: "11s", delay: "4s", rotate: "-4deg" },
  { Icon: Layers, top: "36%", left: "36%", size: 52, color: "var(--v7-amber)", opacity: 0.4, drift: "float-a", duration: "15s", delay: "2s", rotate: "18deg" },
  { Icon: Radio, top: "66%", left: "92%", size: 48, color: "var(--v7-teal)", opacity: 0.5, drift: "float-b", duration: "12s", delay: "3s", rotate: "-16deg" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--v7-bg)] text-[var(--v7-text)]">
      <style>{`
        @keyframes orb-a {
          0%   { transform: translate3d(-10%, -5%, 0) scale(1); }
          50%  { transform: translate3d(20%, 25%, 0) scale(1.25); }
          100% { transform: translate3d(-10%, -5%, 0) scale(1); }
        }
        @keyframes orb-b {
          0%   { transform: translate3d(10%, 15%, 0) scale(1.05); }
          50%  { transform: translate3d(-25%, -20%, 0) scale(1.3); }
          100% { transform: translate3d(10%, 15%, 0) scale(1.05); }
        }
        @keyframes orb-c {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          33%  { transform: translate3d(25%, -25%, 0) scale(1.2); }
          66%  { transform: translate3d(-20%, 20%, 0) scale(0.9); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes conic-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes grid-pan {
          from { background-position: 0 0; }
          to   { background-position: 64px 64px; }
        }
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-120%); opacity: 0; }
          35%  { opacity: 0.9; }
          65%  { opacity: 0.9; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; filter: blur(90px); }
          50%      { opacity: 0.75; filter: blur(110px); }
        }
        @keyframes float-a {
          0%, 100% { transform: translate(0, 0) rotate(var(--rot, 0deg)); }
          25%      { transform: translate(-18px, -22px) rotate(calc(var(--rot, 0deg) + 8deg)); }
          50%      { transform: translate(20px, -14px) rotate(calc(var(--rot, 0deg) - 6deg)); }
          75%      { transform: translate(10px, 18px) rotate(calc(var(--rot, 0deg) + 4deg)); }
        }
        @keyframes float-b {
          0%, 100% { transform: translate(0, 0) rotate(var(--rot, 0deg)); }
          33%      { transform: translate(22px, 14px) rotate(calc(var(--rot, 0deg) - 10deg)); }
          66%      { transform: translate(-16px, 22px) rotate(calc(var(--rot, 0deg) + 12deg)); }
        }
        @keyframes float-c {
          0%, 100% { transform: translate(0, 0) rotate(var(--rot, 0deg)) scale(1); }
          50%      { transform: translate(-24px, -24px) rotate(calc(var(--rot, 0deg) + 14deg)) scale(1.1); }
        }
        @keyframes float-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes icon-pulse {
          0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
          50%      { filter: drop-shadow(0 0 24px currentColor); }
        }
        @keyframes card-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes line-sweep {
          0%   { transform: translateY(-10%); opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(110%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-anim, .auth-icon { animation: none !important; }
        }
      `}</style>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Rotating conic aurora — dialed up to 55% opacity */}
        <div
          className="auth-anim absolute left-1/2 top-1/2 h-[200vmax] w-[200vmax] opacity-[0.55]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, var(--v7-teal) 0deg, transparent 50deg, var(--v7-blue) 130deg, transparent 200deg, var(--v7-pink) 280deg, transparent 350deg)",
            filter: "blur(140px)",
            animation: "conic-spin 45s linear infinite",
          }}
        />

        {/* Three big glow orbs with pulse */}
        <div
          className="auth-anim absolute left-[8%] top-[12%] h-[640px] w-[640px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-teal) 0%, transparent 65%)",
            animation:
              "orb-a 22s ease-in-out infinite, pulse-glow 8s ease-in-out infinite",
          }}
        />
        <div
          className="auth-anim absolute right-[6%] top-[30%] h-[600px] w-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-blue) 0%, transparent 65%)",
            animation:
              "orb-b 26s ease-in-out infinite, pulse-glow 10s ease-in-out infinite",
            animationDelay: "0s, 2s",
          }}
        />
        <div
          className="auth-anim absolute left-[28%] bottom-[4%] h-[580px] w-[580px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-pink) 0%, transparent 65%)",
            animation:
              "orb-c 30s ease-in-out infinite, pulse-glow 12s ease-in-out infinite",
            animationDelay: "0s, 4s",
          }}
        />

        {/* Panning grid */}
        <div
          className="auth-anim absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(var(--v7-text) 1px, transparent 1px), linear-gradient(90deg, var(--v7-text) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            animation: "grid-pan 18s linear infinite",
          }}
        />

        {/* Horizontal scan line */}
        <div
          className="auth-anim absolute inset-x-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--v7-teal) 50%, transparent 100%)",
            boxShadow: "0 0 24px var(--v7-teal)",
            animation: "line-sweep 7s linear infinite",
          }}
        />

        {/* Diagonal shimmer */}
        <div
          className="auth-anim absolute inset-y-0 -inset-x-1/2 opacity-0"
          style={{
            background:
              "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
            animation: "shimmer-sweep 6s ease-in-out infinite",
            animationDelay: "1s",
          }}
        />

        {/* Agent icon field */}
        {ICONS.map((cfg, i) => {
          const { Icon } = cfg;
          return (
            <div
              key={i}
              className="auth-icon absolute"
              style={{
                top: cfg.top,
                left: cfg.left,
                color: cfg.color,
                opacity: cfg.opacity,
                // @ts-expect-error — CSS custom property for keyframe variable
                "--rot": cfg.rotate,
                animation: `${cfg.drift} ${cfg.duration} ease-in-out ${cfg.delay} infinite, icon-pulse ${parseFloat(cfg.duration) * 0.6}s ease-in-out ${cfg.delay} infinite`,
              }}
            >
              <Icon
                size={cfg.size}
                strokeWidth={1.25}
                style={{ transform: `rotate(${cfg.rotate})` }}
              />
            </div>
          );
        })}

        {/* Radial vignette — keeps the card pocket readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 35%, rgba(12,17,23,0.6) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div
          className="auth-anim"
          style={{ animation: "card-float 7s ease-in-out infinite" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
