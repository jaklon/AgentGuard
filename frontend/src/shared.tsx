import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { useState, type ReactNode } from "react";
export const T = {
  bg: "#0a0e1a",
  panel: "#0f1623",
  card: "#131d2e",
  card2: "#1a2640",
  border: "rgba(255,255,255,.07)",
  border2: "rgba(255,255,255,.12)",
  text: "#eef2f8",
  muted: "#8899b0",
  dim: "#4a5e78",
  blue: "#6366f1",
  allow: "#10b981",
  warn: "#f59e0b",
  block: "#f43f5e",
  mono: "'JetBrains Mono', monospace",
};
export const spring = { type: "spring" as const, stiffness: 380, damping: 30 };
export const springGentle = {
  type: "spring" as const,
  stiffness: 200,
  damping: 28,
};
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28 },
};
export const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
export const statusMeta = {
  ALLOW: { color: T.allow, bg: "#10b98118" },
  WARN: { color: T.warn, bg: "#f59e0b18" },
  BLOCK: { color: T.block, bg: "#f43f5e18" },
};
export const short = (s: string) =>
  s.length > 13 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.8 7.5-9.5V6L12 3Z" />
        <path d="m8.6 12 2.1 2.1 4.7-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    warning: (
      <>
        <path d="M10.3 3.8 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p[name] || p.check}
    </svg>
  );
}
export function Pill({
  status,
  dot = true,
  label,
}: {
  status: string;
  dot?: boolean;
  label?: string;
}) {
  const m = statusMeta[status as keyof typeof statusMeta] || {
    color: T.blue,
    bg: "#6366f118",
  };
  return (
    <motion.span
      initial={{ scale: 0.86, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring}
      style={{
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.color}33`,
      }}
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[.12em]"
    >
      {dot && (
        <motion.i
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: m.color }}
        />
      )}
      {label ?? status}
    </motion.span>
  );
}
type BtnProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "approve" | "amber" | "ghost";
  children: ReactNode;
};
export function MBtn({
  variant = "primary",
  children,
  className = "",
  ...props
}: BtnProps) {
  const styles = {
    primary: "bg-indigo-500 text-white",
    secondary: "bg-white/[.04] text-slate-200 border border-white/10",
    danger: "bg-rose-500/12 text-rose-400 border border-rose-500/25",
    approve: "bg-emerald-500 text-slate-950",
    amber: "bg-amber-500 text-slate-950",
    ghost: "bg-transparent text-slate-400",
  };
  return (
    <motion.button
      whileHover={props.disabled ? {} : { y: -1 }}
      whileTap={props.disabled ? {} : { scale: 0.98 }}
      transition={spring}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
export function Card({
  children,
  className = "",
  glow = false,
  ...p
}: HTMLMotionProps<"section"> & { children: ReactNode; glow?: boolean }) {
  return (
    <motion.section
      style={{
        background: T.card,
        border: `1px solid ${glow ? "#6366f144" : T.border}`,
      }}
      className={`rounded-xl soft ${className}`}
      {...p}
    >
      {children}
    </motion.section>
  );
}
export function CardHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-indigo-400">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-medium text-slate-400">
      {children}
    </label>
  );
}
export function Mono({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`mono ${className}`}>{children}</span>;
}
export function Divider() {
  return <div className="my-5 h-px bg-white/[.07]" />;
}
export function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setC(true);
        setTimeout(() => setC(false), 1400);
      }}
      className={`rounded-lg p-1.5 transition-colors ${c ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-white hover:bg-white/5"}`}
      aria-label="Copy"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={String(c)}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="block"
        >
          {" "}
          <Icon name={c ? "check" : "copy"} size={15} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
export function ScoreRing({
  score,
  size = 130,
}: {
  score: number;
  size?: number;
}) {
  const color = score < 40 ? T.allow : score <= 70 ? T.warn : T.block;
  const r = 45,
    c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 110 110" className="-rotate-90">
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="white"
          strokeOpacity=".06"
          strokeWidth="8"
        />
        <motion.circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ ...springGentle, delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.b
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl"
        >
          {score}
        </motion.b>
        <span className="text-[10px] text-slate-500">/100 RISK</span>
      </div>
    </div>
  );
}
export const Row = ({
  label,
  value,
  copy,
}: {
  label: string;
  value: ReactNode;
  copy?: string;
}) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[.055] last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <div className="flex items-center min-w-0 text-right text-sm font-medium">
      {value}
      {copy && <CopyBtn text={copy} />}
    </div>
  </div>
);
export function Spinner() {
  return <span className="spinner" />;
}
