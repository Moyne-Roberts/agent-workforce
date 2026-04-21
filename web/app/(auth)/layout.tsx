import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--v7-bg)] text-[var(--v7-text)]">
      <style>{`
        @keyframes orb-drift-a {
          0%   { transform: translate3d(-20%, -10%, 0) scale(1); }
          33%  { transform: translate3d(10%, 20%, 0) scale(1.15); }
          66%  { transform: translate3d(30%, -15%, 0) scale(0.95); }
          100% { transform: translate3d(-20%, -10%, 0) scale(1); }
        }
        @keyframes orb-drift-b {
          0%   { transform: translate3d(15%, 10%, 0) scale(1); }
          50%  { transform: translate3d(-25%, -20%, 0) scale(1.2); }
          100% { transform: translate3d(15%, 10%, 0) scale(1); }
        }
        @keyframes orb-drift-c {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          25%  { transform: translate3d(25%, -20%, 0) scale(1.1); }
          50%  { transform: translate3d(-15%, 20%, 0) scale(0.9); }
          75%  { transform: translate3d(20%, 15%, 0) scale(1.15); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes conic-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes grid-pan {
          from { background-position: 0 0; }
          to   { background-position: 48px 48px; }
        }
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-100%); opacity: 0; }
          40%  { opacity: 0.7; }
          60%  { opacity: 0.7; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes float-card {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-anim { animation: none !important; }
        }
      `}</style>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Slowly rotating conic gradient — adds a drifting "aurora" base layer */}
        <div
          className="auth-anim absolute left-1/2 top-1/2 h-[180vmax] w-[180vmax] opacity-[0.35]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, var(--v7-teal) 0deg, transparent 60deg, var(--v7-blue) 140deg, transparent 220deg, var(--v7-pink) 300deg, transparent 360deg)",
            filter: "blur(120px)",
            animation: "conic-spin 60s linear infinite",
          }}
        />

        {/* Three drifting glow orbs */}
        <div
          className="auth-anim absolute left-[10%] top-[15%] h-[520px] w-[520px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-teal) 0%, transparent 70%)",
            filter: "blur(80px)",
            opacity: 0.55,
            animation: "orb-drift-a 28s ease-in-out infinite",
          }}
        />
        <div
          className="auth-anim absolute right-[8%] top-[35%] h-[480px] w-[480px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-blue) 0%, transparent 70%)",
            filter: "blur(80px)",
            opacity: 0.55,
            animation: "orb-drift-b 34s ease-in-out infinite",
          }}
        />
        <div
          className="auth-anim absolute left-[30%] bottom-[5%] h-[460px] w-[460px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--v7-pink) 0%, transparent 70%)",
            filter: "blur(80px)",
            opacity: 0.4,
            animation: "orb-drift-c 40s ease-in-out infinite",
          }}
        />

        {/* Panning grid overlay */}
        <div
          className="auth-anim absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--v7-text) 1px, transparent 1px), linear-gradient(90deg, var(--v7-text) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            animation: "grid-pan 14s linear infinite",
          }}
        />

        {/* Diagonal shimmer sweep */}
        <div
          className="auth-anim absolute inset-y-0 -inset-x-1/2 opacity-0"
          style={{
            background:
              "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
            animation: "shimmer-sweep 9s ease-in-out infinite",
            animationDelay: "2s",
          }}
        />

        {/* Radial focus mask — darkens edges, centers attention on the card */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(12,17,23,0.5) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="auth-anim" style={{ animation: "float-card 6s ease-in-out infinite" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
