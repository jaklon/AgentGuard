"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import DashboardView from "./views/LiveDashboardView";
import ErrorsView from "./views/ErrorsView";
import LifecycleView from "./views/LifecycleView";
import PolicyView from "./views/LivePolicyView";
import RiskView from "./views/RiskView";
import BoardView from "./views/BoardView";
import Onboarding from "./components/Onboarding";
import {
  Card,
  CardHeader,
  CopyBtn,
  Divider,
  Icon,
  Label,
  MBtn,
  Mono,
  Pill,
  Row,
  Spinner,
  T,
  fadeUp,
  spring,
  stagger,
} from "./shared";
type Tab =
  | "Guard"
  | "Manual"
  | "Receipt"
  | "Errors"
  | "Lifecycle"
  | "Policy"
  | "Risk"
  | "Board"
  | "Architecture"
  | "UI Kit";
const navGroups: { label: string; items: Tab[] }[] = [
  { label: "Payments", items: ["Guard"] },
  { label: "Security", items: ["Policy", "Risk", "Lifecycle", "Errors"] },
  { label: "About the project", items: ["Architecture", "Board", "UI Kit"] },
];
const mobileMain: Tab[] = ["Guard"];
const mobileMore: Tab[] = [
  "Policy",
  "Risk",
  "Lifecycle",
  "Errors",
  "Architecture",
  "Board",
  "UI Kit",
];
const navLabel: Record<Tab, string> = {
  Guard: "Check Payment",
  Manual: "Manual Payment",
  Receipt: "Receipt",
  Errors: "Help",
  Lifecycle: "Transaction Status",
  Policy: "Safety Policy",
  Risk: "Risk Breakdown",
  Board: "Team Board",
  Architecture: "How It Works",
  "UI Kit": "UI Guide",
};
export default function App() {
  const [tab, setTab] = useState<Tab>("Guard"),
    [open, setOpen] = useState(false),
    [guide, setGuide] = useState(false);
  useEffect(() => {
    setGuide(localStorage.getItem("agentguard-guide-seen") !== "1");
  }, []);

  const View: Record<Tab, ReactNode> = {
    Guard: <DashboardView />,
    Manual: <Manual />,
    Receipt: <Receipt />,
    Errors: <ErrorsView />,
    Lifecycle: <LifecycleView />,
    Policy: <PolicyView />,
    Risk: <RiskView />,
    Board: <BoardView />,
    Architecture: <Architecture />,
    "UI Kit": <UIKit />,
  };
  return (
    <div className="dashboard-shell min-h-screen lg:pl-[260px]">
      <Onboarding
        open={guide}
        onClose={() => {
          localStorage.setItem("agentguard-guide-seen", "1");
          setGuide(false);
        }}
      />
      <aside className="dashboard-sidebar fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col lg:flex">
        <button
          onClick={() => setTab("Guard")}
          className="dashboard-brand flex h-[84px] items-center gap-3 px-6 text-left"
        >
          <span className="dashboard-brand-mark grid h-10 w-10 place-items-center rounded-full">
            <Icon name="shield" size={20} />
          </span>
          <span>
            <b className="block text-sm tracking-tight">AgentGuard</b>
            <span className="text-[9px] uppercase tracking-[.12em] text-slate-600">
              Human approval
            </span>
          </span>
        </button>
        <nav className="dashboard-index flex-1 overflow-y-auto px-4 py-7">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem
                    key={item}
                    label={navLabel[item]}
                    active={tab === item}
                    onClick={() => setTab(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="dashboard-sidebar-foot p-5">
          <div className="mb-3 flex items-center justify-between text-[10px]">
            <span className="text-slate-600">Demo network</span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-300">
              <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              BOT Testnet
            </span>
          </div>
          <button
            onClick={() => setGuide(true)}
            className="w-full rounded-lg border border-white/[.07] px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[.03] hover:text-white"
          >
            ? Open guide
          </button>
        </div>
      </aside>

      <header className="dashboard-header sticky top-0 z-30 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 md:px-7">
          <button
            onClick={() => setTab("Guard")}
            className="flex items-center gap-2 lg:hidden"
          >
            <span className="dashboard-brand-mark grid h-8 w-8 place-items-center rounded-full">
              <Icon name="shield" size={17} />
            </span>
            <b className="text-sm">AgentGuard</b>
          </button>
          <div className="hidden lg:block">
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-600">
              AgentGuard workspace
            </p>
            <h1 className="text-sm font-semibold">{navLabel[tab]}</h1>
          </div>
          <button
            onClick={() => setTab("Guard")}
            className="dashboard-wallet ml-auto flex items-center gap-3 rounded-full px-4 py-2 text-left"
          >
            <span
              className={`h-2 w-2 rounded-full bg-slate-600`}
            />
            <span>
              <b className="block text-[11px] font-semibold">
                Connect in Check Payment
              </b>
              <Mono className="block text-[9px] text-slate-600">BOT Testnet · 968</Mono>
            </span>
          </button>
        </div>
      </header>

      <main className="dashboard-main page-pad mx-auto max-w-[1320px] px-4 py-8 pb-28 md:px-10 lg:pb-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {View[tab]}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="dashboard-footer mx-auto hidden max-w-[1320px] justify-between px-10 py-8 text-[10px] lg:flex">
        <span>AgentGuard · BOT Testnet</span>
        <span>Wallet signatures stay in MetaMask</span>
      </footer>
      <nav className="dashboard-mobile-nav fixed inset-x-0 bottom-0 z-50 px-2 py-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {mobileMain.map((item) => (
            <MobileNav
              key={item}
              label={navLabel[item]}
              active={tab === item}
              onClick={() => setTab(item)}
            />
          ))}
          <MobileNav
            label="Menu"
            active={mobileMore.includes(tab)}
            onClick={() => setOpen(true)}
          />
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 p-4 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
              className="dashboard-mobile-sheet absolute inset-x-3 bottom-3 rounded-2xl p-3"
            >
              <div className="mb-2 flex items-center justify-between px-2 py-2">
                <b className="text-sm">More</b>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-500"
                >
                  <Icon name="x" size={17} />
                </button>
              </div>
              {mobileMore.map((item) => (
                <NavItem
                  key={item}
                  label={navLabel[item]}
                  active={tab === item}
                  onClick={() => {
                    setTab(item);
                    setOpen(false);
                  }}
                />
              ))}
              <button
                onClick={() => {
                  setGuide(true);
                  setOpen(false);
                }}
                className="mt-2 w-full rounded-lg border border-white/[.07] px-3 py-3 text-left text-xs text-slate-400"
              >
                ? Open quick guide
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function NavItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      animate={{
        color: active ? "#101110" : "#77786f",
        backgroundColor: active ? "rgba(80,70,229,.11)" : "rgba(0,0,0,0)",
      }}
      className="dashboard-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#5046e5]" : "bg-black/20"}`}
      />
      {label}
    </motion.button>
  );
}
function MobileNav({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2 py-2 text-[10px] font-semibold ${active ? "bg-[#5046e5] text-white" : "text-[#66675f]"}`}
    >
      <span
        className={`mx-auto mb-1 block h-1 w-4 rounded-full ${active ? "bg-[#b9f54a]" : "bg-transparent"}`}
      />
      {label}
    </button>
  );
}
function Head({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="editorial-head mb-9">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#5046e5]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] md:text-6xl">
        {title}
      </h1>
      {desc && <p className="mt-2 text-sm text-slate-400">{desc}</p>}
    </div>
  );
}
function Manual() {
  const [address, setAddress] = useState(""),
    [amount, setAmount] = useState(""),
    [blurred, setBlurred] = useState(false),
    [sending, setSending] = useState(false),
    [done, setDone] = useState(false);
  const validA = /^0x[0-9a-fA-F]{40}$/.test(address),
    num = Number(amount),
    validN = num > 0 && num <= 0.02;
  const send = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setDone(true);
    }, 1500);
  };
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-[560px]">
      <Head
        eyebrow="Alternative flow"
        title="Pay without an AI instruction"
        desc="Enter the recipient and amount directly. Safety rules still apply."
      />
      <div className="mb-4 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
        <Icon name="warning" />
        <span>
          Use this form when AI instruction analysis is not available.
        </span>
      </div>
      <Card className="p-6">
        <div>
          <Label>Recipient address</Label>
          <motion.div
            animate={{
              borderColor: blurred
                ? validA
                  ? T.allow
                  : T.block
                : "rgba(255,255,255,.09)",
            }}
            className="flex rounded-xl border bg-[#0a101c]"
          >
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => setBlurred(true)}
              className="min-w-0 flex-1 bg-transparent p-3 text-sm outline-none mono"
              placeholder="0x…"
            />
            {blurred && (
              <span
                className={`grid w-11 place-items-center ${validA ? "text-emerald-400" : "text-rose-400"}`}
              >
                <Icon name={validA ? "check" : "x"} />
              </span>
            )}
          </motion.div>
          {blurred && !validA && (
            <motion.p
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs text-rose-400"
            >
              The address is incomplete. Enter a 42-character 0x address.
            </motion.p>
          )}
        </div>
        <div className="mt-5">
          <Label>Amount to send</Label>
          <div className="relative">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              className="input mono"
              placeholder="0.00"
            />
            <span className="absolute right-3 top-3 text-xs text-slate-500">
              BOT
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              animate={{
                width: `${Math.min(100, ((num || 0) / 0.02) * 100)}%`,
                backgroundColor: num > 0.02 ? T.block : T.blue,
              }}
              className="h-full rounded-full"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-600">
            <span>0 BOT</span>
            <span>0.02 BOT limit</span>
          </div>
        </div>
        <div className="mt-5">
          <Label>Memo (optional)</Label>
          <input className="input" placeholder="What is this payment for?" />
        </div>
        <div className="my-5 rounded-xl bg-indigo-500/[.07] p-3 text-center text-xs text-indigo-200">
          Per-transaction limit 0.02 BOT · Daily remaining 0.07 BOT
        </div>
        <MBtn
          onClick={send}
          disabled={!validA || !validN || sending || done}
          variant={done ? "approve" : "primary"}
          className="w-full py-3"
        >
          {sending ? (
            <>
              <Spinner />
              Waiting for demo approval…
            </>
          ) : done ? (
            <>
              <Icon name="check" />
              Demo payment approved
            </>
          ) : (
            "Review and continue"
          )}
        </MBtn>
      </Card>
    </motion.div>
  );
}
const hash =
  "0x8f2a7a4c19b82d9e116dc51b830031be39ab503b6f152e06bb41d7dff08291c4";
function Receipt() {
  const rows = [
    ["Transaction ID", <Mono>0x8f2a…91c4</Mono>, hash],
    [
      "Contract address",
      <Mono>0xA918…e4D2</Mono>,
      "0xA9188fCe9073D09984C4450243Ee42f2A81be4D2",
    ],
    ["Network fee", <Mono>21,438 gas</Mono>],
    ["Block number", <Mono>#1,942,816</Mono>],
    ["Guard decision", <Pill status="ALLOW" label="SAFE" />],
    ["Network event", <Mono>PaymentExecuted</Mono>],
    ["Amount", <b className="text-emerald-400">0.01 BOT</b>],
    ["Recipient", <Mono>0x3A9F…c76A</Mono>],
  ] as [string, ReactNode, string?][];
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-[560px]">
      <Card className="overflow-hidden p-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: 0.1 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"
          >
            <Icon name="check" size={30} />
          </motion.div>
          <h1 className="mt-4 text-2xl font-semibold">Payment confirmed</h1>
          <p className="mt-2 text-sm text-slate-400">
            Simulation completed on BOT Chain Testnet in 9.8 seconds.
          </p>
        </div>
        <Divider />
        <motion.div variants={stagger} initial="initial" animate="animate">
          {rows.map(([l, v, c]) => (
            <motion.div
              key={l}
              variants={{
                initial: { opacity: 0, x: -8 },
                animate: { opacity: 1, x: 0 },
              }}
            >
              <Row label={l} value={v} copy={c} />
            </motion.div>
          ))}
        </motion.div>
        <MBtn variant="approve" className="mt-5 w-full py-3">
          View on BOT Chain Explorer <Icon name="arrow" />
        </MBtn>
      </Card>
    </motion.div>
  );
}
function Architecture() {
  const layers = [
    [
      "L1 · USER",
      "Local demo user",
      "Simulated intent and approval flow",
      "#6366f1",
    ],
    [
      "L2 · FRONTEND",
      "Next.js · React",
      "Local interface and policy simulation",
      "#3b82f6",
    ],
    [
      "L3 · BACKEND",
      "FastAPI + Guard Engine + SQLite",
      "Intent parsing, validation & audit",
      "#8b5cf6",
    ],
    [
      "L4 · BLOCKCHAIN",
      "BOT Chain + Solidity Contract",
      "Policy enforcement & settlement",
      "#10b981",
    ],
    [
      "L5 · INFRA",
      "Oracle Cloud VM + Docker + Caddy",
      "Runtime, TLS & observability",
      "#f59e0b",
    ],
  ];
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-3xl">
      <Head
        eyebrow="System map"
        title="Architecture"
        desc="Reference architecture from the implementation plan. This prototype simulates every external layer locally."
      />
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="space-y-0"
      >
        {layers.map(([l, n, d, c], i) => (
          <div key={l}>
            <motion.div
              variants={{
                initial: { opacity: 0, x: -20 },
                animate: { opacity: 1, x: 0 },
              }}
            >
              <Card className="flex items-center gap-5 p-5">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold"
                  style={{ background: `${c}15`, color: c }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <span
                    className="text-[10px] font-bold tracking-[.16em]"
                    style={{ color: c }}
                  >
                    {l}
                  </span>
                  <h2 className="mt-1 font-semibold">{n}</h2>
                  <p className="mt-1 text-xs text-slate-500">{d}</p>
                </div>
                <Pill status={i === 3 ? "CHAIN 968" : "LAYER"} dot={false} />
              </Card>
            </motion.div>
            {i < 4 && (
              <div className="flex h-12 flex-col items-center justify-center text-[9px] text-slate-600">
                <span>↓</span>
                <span>{i === 1 ? "REST API" : "JSON-RPC · EVENTS"}</span>
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
function UIKit() {
  const colors = Object.entries(T)
    .filter(([, v]) => typeof v === "string" && v.startsWith("#"))
    .slice(0, 9);
  return (
    <motion.div {...fadeUp}>
      <Head
        eyebrow="Design foundation"
        title="UI Kit"
        desc="Reusable visual language for every AgentGuard state."
      />
      <Card className="p-6">
        <CardHeader title="Color tokens" />
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9"
        >
          {colors.map(([n, c]) => (
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.8 },
                animate: { opacity: 1, scale: 1 },
              }}
              whileHover={{ y: -4 }}
              key={n}
              className="rounded-xl border border-white/[.07] bg-white/[.025] p-2"
            >
              <div
                className="aspect-square rounded-lg"
                style={{ background: c }}
              />
              <p className="mt-2 text-[10px] font-semibold">{n}</p>
              <p className="mt-1 truncate text-[8px] text-slate-600 mono">
                {c}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </Card>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Status & context" />
          <div className="mt-5 flex flex-wrap gap-3">
            <Pill status="ALLOW" />
            <Pill status="WARN" />
            <Pill status="BLOCK" />
            <Pill status="TESTNET" />
            <Pill status="AI GUARD" />
          </div>
        </Card>
        <Card className="p-6">
          <CardHeader title="Button variants" />
          <div className="mt-5 flex flex-wrap gap-3">
            <MBtn>Primary</MBtn>
            <MBtn variant="secondary">Secondary</MBtn>
            <MBtn variant="danger">Danger</MBtn>
            <MBtn disabled>Disabled</MBtn>
            <MBtn className="px-3 py-1.5 text-xs">Small</MBtn>
            <MBtn variant="approve">Approve</MBtn>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
