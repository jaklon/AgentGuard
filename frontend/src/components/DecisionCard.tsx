import type { GuardDecision } from "../types";

const styles = {
  ALLOW: "border-mint/40 bg-mint/10 text-mint",
  WARN: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  BLOCK: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

export function DecisionCard({ result }: { result: GuardDecision }) {
  return (
    <section
      aria-live="polite"
      className={"rounded-2xl border p-5 " + styles[result.decision]}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Guard decision</p>
          <h3 className="mt-2 text-3xl font-black">{result.decision}</h3>
        </div>
        <div className="text-right">
          <span className="font-mono text-3xl font-bold">{result.risk_score}</span>
          <span className="block text-xs uppercase tracking-wider opacity-70">risk / 100</span>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/80">{result.reason}</p>
      {result.warnings.map((warning) => (
        <p className="mt-2 text-xs text-white/60" key={warning}>
          · {warning}
        </p>
      ))}
      <p className="mt-4 text-xs uppercase tracking-wider text-white/40">
        Source: {result.source}
      </p>
    </section>
  );
}
