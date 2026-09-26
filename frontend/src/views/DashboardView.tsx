import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  Card,
  CardHeader,
  Divider,
  Icon,
  MBtn,
  Mono,
  Pill,
  Row,
  ScoreRing,
  Spinner,
  T,
  fadeUp,
  spring,
  stagger,
} from "../shared";

type Result = {
  status: "ALLOW" | "WARN" | "BLOCK";
  score: number;
  reason: string;
  amount: number;
};

export function evaluate(text: string): Result {
  const amount = parseFloat(text.match(/(\d+\.?\d*)\s*BOT/i)?.[1] || "0.01");
  if (/pause|jeda|hentikan/i.test(text))
    return {
      status: "BLOCK",
      score: 95,
      reason: "AI is not allowed to pause the payment system.",
      amount,
    };
  if (amount > 0.04)
    return {
      status: "BLOCK",
      score: 91,
      reason: `${amount} BOT significantly exceeds the 0.02 BOT per-transaction limit.`,
      amount,
    };
  if (amount > 0.02)
    return {
      status: "WARN",
      score: 62,
      reason:
        "This amount exceeds the per-transaction limit and requires review.",
      amount,
    };
  return {
    status: "ALLOW",
    score: 12,
    reason: "This instruction matches every active safety rule.",
    amount,
  };
}

const address = "0x3A9F4e1248C7D10b4fa87A45D3112B9A9D1c76Ae";
const examples = [
  {
    label: "Safe payment",
    text: "Send 0.01 BOT to 0x3A9… for the server invoice",
  },
  {
    label: "Needs review",
    text: "Pay 0.03 BOT to 0x3A9… for design work",
  },
  { label: "Blocked action", text: "Pause all contract payments" },
];

export default function DashboardView() {
  const [text, setText] = useState(examples[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(evaluate(text));
      setLoading(false);
      setTimeout(
        () =>
          document
            .getElementById("guard-result")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
    }, 1400);
  };

  return (
    <motion.div {...fadeUp} className="guard-home">
      <section className="guard-hero mb-8 pb-9">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-4xl">
            <div className="guard-kicker mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em]">
              <span className="h-px w-6 bg-indigo-400" /> AI payment safety
              check
            </div>
            <h1 className="guard-title font-semibold leading-[.93] tracking-[-.055em]">
              Check before funds move.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
              Write the request in plain language. AgentGuard immediately tells
              you whether the payment is safe, needs review, or must be blocked.
            </p>
          </div>
          <div className="guard-status-note py-4 pl-5 text-xs lg:max-w-[300px]">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Policy checks active
            </div>
            <p className="mt-2 leading-5">
              Requests are evaluated locally before any wallet approval step.
            </p>
          </div>
        </div>
      </section>

      <details className="guard-glossary group mb-8 rounded-2xl p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-300">
          <span className="mr-2 text-indigo-400">?</span>New to these terms?
          Open a quick explanation
        </summary>
        <div className="mt-4 grid gap-3 border-t border-white/[.06] pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "AI agent",
              "A digital assistant that can prepare tasks automatically.",
            ],
            ["Wallet", "A digital account used to hold blockchain assets."],
            ["BOT", "The currency used on the BOT Chain network."],
            ["Safety policy", "Rules that determine which payments are safe."],
          ].map(([term, meaning]) => (
            <div key={term}>
              <p className="text-xs font-semibold text-indigo-300">{term}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{meaning}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="guard-workspace grid gap-7 lg:grid-cols-[300px_1fr]">
        <Card className="guard-policy-card order-2 h-fit p-6 lg:order-1 lg:sticky lg:top-28">
          <CardHeader
            eyebrow="Your safety policy"
            title="Active payment limits"
            action={<Pill status="ACTIVE" label="ACTIVE" />}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Every request must pass these rules before you can approve it.
          </p>
          <Divider />
          <div className="space-y-1">
            <Row label="Per-transaction limit" value={<Mono>0.02 BOT</Mono>} />
            <Row label="Daily limit" value={<Mono>0.10 BOT</Mono>} />
            <Row label="Used today" value={<Mono>0.03 BOT</Mono>} />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "30%" }}
              transition={{ ...spring, delay: 0.3 }}
              className="h-full rounded-full bg-indigo-500"
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            30% of the daily limit has been used
          </p>
          <Divider />
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Trusted recipients</span>
            <span className="text-emerald-400">3 allowed</span>
          </div>
          <div className="mt-3 space-y-2">
            {["0x3A9…c76A", "0x92B…10e4", "0xF71…8b20"].map((item) => (
              <div
                key={item}
                className="rounded-lg bg-white/[.035] px-3 py-2 text-xs text-slate-300 mono"
              >
                {item}
              </div>
            ))}
          </div>
          <Row label="Policy expires" value="30 Sep 2026" />
        </Card>

        <div className="order-1 lg:order-2">
          <Card className="guard-command-card p-6 md:p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Step 1 of 2
                </p>
                <h2 className="mt-1 font-semibold">
                  What does the AI want to pay?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Write naturally. No special format is required.
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-slate-600">
                BOT Chain Mainnet · 677
              </span>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
                  run();
              }}
              className="input guard-command-input min-h-40 resize-none text-base leading-7 md:text-lg"
              placeholder="Example: Send 0.01 BOT to 0x3A9… for the server invoice"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Try an example
              </span>
              {examples.map((example) => (
                <motion.button
                  key={example.label}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setText(example.text)}
                  className="rounded-md border border-white/[.08] bg-white/[.02] px-3 py-1.5 text-xs text-slate-400 hover:border-white/[.14] hover:text-white"
                >
                  {example.label}
                </motion.button>
              ))}
            </div>
            <MBtn
              onClick={run}
              disabled={!text.trim() || loading}
              className="mt-6 w-full py-4"
            >
              {loading ? (
                <>
                  <Spinner />
                  Checking the request…
                </>
              ) : (
                <>
                  <Icon name="shield" />
                  Check now{" "}
                  <span className="text-white/50">· about 2 seconds</span>
                </>
              )}
            </MBtn>
          </Card>
          <AnimatePresence mode="wait">
            {result && <ResultCard result={result} />}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function ResultCard({ result }: { result: Result }) {
  const [signing, setSigning] = useState(false);
  const [complete, setComplete] = useState(false);
  const color =
    result.status === "ALLOW"
      ? T.allow
      : result.status === "WARN"
        ? T.warn
        : T.block;
  const proceed = () => {
    setSigning(true);
    setTimeout(() => {
      setSigning(false);
      setComplete(true);
    }, 1500);
  };

  return (
    <motion.div
      id="guard-result"
      className="scroll-mt-24"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={spring}
    >
      <Card className="relative mt-5 overflow-hidden p-5 md:p-6">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: color }}
        />
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Step 2 of 2 · Guard decision
            </p>
            <Pill
              status={result.status}
              label={
                result.status === "ALLOW"
                  ? "ALLOW"
                  : result.status === "WARN"
                    ? "REVIEW"
                    : "BLOCKED"
              }
            />
            <h3 className="mt-3 text-xl font-semibold">
              {result.status === "ALLOW"
                ? "Safe to proceed"
                : result.status === "WARN"
                  ? "Review before proceeding"
                  : "Payment blocked"}
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
              {result.reason}
            </p>
          </div>
          <ScoreRing score={result.score} size={120} />
        </div>
        <details className="my-5 rounded-xl border border-white/[.07] bg-white/[.02] px-4">
          <summary className="cursor-pointer py-3 text-xs font-semibold text-slate-400 hover:text-white">
            View checked details
          </summary>
          <div className="border-t border-white/[.06] pb-4">
            <div className="grid gap-x-8 md:grid-cols-2">
              <Row label="Requested action" value={<Mono>TRANSFER</Mono>} />
              <Row
                label="Payment recipient"
                value={
                  <Mono>
                    {address.slice(0, 8)}…{address.slice(-5)}
                  </Mono>
                }
              />
              <Row
                label="Payment amount"
                value={<Mono>{result.amount.toFixed(3)} BOT</Mono>}
              />
              <Row label="Network" value="BOT Chain Mainnet (677)" />
              <Row label="Payment purpose" value="Server invoice" />
            </div>
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="mt-4 flex flex-wrap gap-2"
            >
              {[
                "Amount checked",
                "Recipient checked",
                "Contract active",
                "Daily allowance available",
              ].map((item, index) => (
                <motion.span
                  variants={{
                    initial: { scale: 0.7, opacity: 0 },
                    animate: { scale: 1, opacity: 1, transition: spring },
                  }}
                  key={item}
                  className={`rounded-full px-3 py-1.5 text-xs ${result.status === "BLOCK" && index === 0 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}
                >
                  {result.status === "BLOCK" && index === 0 ? "!" : "✓"} {item}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </details>
        <AnimatePresence mode="wait">
          {complete ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300"
            >
              <Icon name="check" /> Approval recorded — the request passed every active rule
            </motion.div>
          ) : result.status === "ALLOW" ? (
            <MBtn
              key="allow"
              onClick={proceed}
              disabled={signing}
              variant="approve"
              className="w-full py-3"
            >
              {signing ? (
                <>
                  <Spinner />
                  Waiting for wallet approval…
                </>
              ) : (
                <>
                  <Icon name="wallet" />
                  Approve payment
                </>
              )}
            </MBtn>
          ) : result.status === "WARN" ? (
            <MBtn
              key="warn"
              onClick={proceed}
              disabled={signing}
              variant="amber"
              className="w-full py-3"
            >
              {signing ? (
                <>
                  <Spinner />
                  Recording your decision…
                </>
              ) : (
                "I understand the risk — continue"
              )}
            </MBtn>
          ) : (
            <MBtn key="block" variant="danger" disabled className="w-full py-3">
              Payment blocked by your safety policy
            </MBtn>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
