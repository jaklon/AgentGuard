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
      reason: "AI tidak diizinkan menghentikan seluruh sistem pembayaran.",
      amount,
    };
  if (amount > 0.04)
    return {
      status: "BLOCK",
      score: 91,
      reason: `${amount} BOT jauh melebihi batas 0.02 BOT untuk sekali bayar.`,
      amount,
    };
  if (amount > 0.02)
    return {
      status: "WARN",
      score: 62,
      reason:
        "Nominal ini melewati batas sekali bayar dan perlu kamu periksa ulang.",
      amount,
    };
  return {
    status: "ALLOW",
    score: 12,
    reason: "Permintaan ini mengikuti semua aturan keamanan yang aktif.",
    amount,
  };
}

const address = "0x3A9F4e1248C7D10b4fa87A45D3112B9A9D1c76Ae";
const examples = [
  {
    label: "Pembayaran aman",
    text: "Kirim 0.01 BOT ke 0x3A9… untuk tagihan server",
  },
  {
    label: "Perlu diperiksa",
    text: "Bayar 0.03 BOT ke 0x3A9… untuk pekerjaan desain",
  },
  { label: "Tindakan terlarang", text: "Hentikan semua pembayaran kontrak" },
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
              <span className="h-px w-6 bg-indigo-400" /> Pemeriksaan pembayaran
              AI
            </div>
            <h1 className="guard-title font-semibold leading-[.93] tracking-[-.055em]">
              Periksa sebelum uang bergerak.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
              Cukup tulis permintaannya. AgentGuard langsung memberi tahu apakah
              pembayaran aman, perlu diperiksa, atau harus diblokir.
            </p>
          </div>
          <div className="guard-demo-note py-4 pl-5 text-xs lg:max-w-[300px]">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Mode demo
              aman
            </div>
            <p className="mt-2 leading-5">
              Tidak ada wallet asli dan tidak ada uang sungguhan yang dikirim.
            </p>
          </div>
        </div>
      </section>

      <details className="guard-glossary group mb-8 rounded-2xl p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-300">
          <span className="mr-2 text-indigo-400">?</span>Belum familiar dengan
          istilahnya? Klik untuk penjelasan singkat
        </summary>
        <div className="mt-4 grid gap-3 border-t border-white/[.06] pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "AI agent",
              "Asisten digital yang dapat menyiapkan tugas secara otomatis.",
            ],
            ["Wallet", "Dompet digital tempat aset blockchain disimpan."],
            ["BOT", "Mata uang yang dipakai di jaringan BOT Chain."],
            [
              "Aturan keamanan",
              "Batas yang menentukan pembayaran mana yang aman.",
            ],
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
            eyebrow="Aturan keamananmu"
            title="Batas wallet demo"
            action={<Pill status="ACTIVE" label="AKTIF" />}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Semua permintaan harus lolos aturan ini sebelum dapat kamu setujui.
          </p>
          <Divider />
          <div className="space-y-1">
            <Row label="Maksimal sekali bayar" value={<Mono>0.02 BOT</Mono>} />
            <Row label="Maksimal per hari" value={<Mono>0.10 BOT</Mono>} />
            <Row label="Sudah dipakai hari ini" value={<Mono>0.03 BOT</Mono>} />
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
            30% dari batas harian sudah terpakai
          </p>
          <Divider />
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Penerima terpercaya</span>
            <span className="text-emerald-400">3 diizinkan</span>
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
          <Row label="Aturan berakhir" value="30 Sep 2026" />
        </Card>

        <div className="order-1 lg:order-2">
          <Card className="guard-command-card p-6 md:p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Langkah 1 dari 2
                </p>
                <h2 className="mt-1 font-semibold">
                  Apa yang ingin dibayar oleh AI?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tulis seperti kamu berbicara biasa. Tidak perlu format khusus.
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-slate-600">
                BOT Testnet · 968
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
              placeholder="Contoh: Kirim 0.01 BOT ke 0x3A9… untuk tagihan server"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Coba contoh
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
                  Sedang memeriksa permintaan…
                </>
              ) : (
                <>
                  <Icon name="shield" />
                  Periksa sekarang{" "}
                  <span className="text-white/50">· sekitar 2 detik</span>
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
              Langkah 2 dari 2 · Hasil pemeriksaan
            </p>
            <Pill
              status={result.status}
              label={
                result.status === "ALLOW"
                  ? "AMAN"
                  : result.status === "WARN"
                    ? "PERIKSA"
                    : "DIBLOKIR"
              }
            />
            <h3 className="mt-3 text-xl font-semibold">
              {result.status === "ALLOW"
                ? "Aman untuk dilanjutkan"
                : result.status === "WARN"
                  ? "Periksa ulang sebelum lanjut"
                  : "Pembayaran dihentikan"}
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
              {result.reason}
            </p>
          </div>
          <ScoreRing score={result.score} size={120} />
        </div>
        <details className="my-5 rounded-xl border border-white/[.07] bg-white/[.02] px-4">
          <summary className="cursor-pointer py-3 text-xs font-semibold text-slate-400 hover:text-white">
            Lihat detail yang diperiksa
          </summary>
          <div className="border-t border-white/[.06] pb-4">
            <div className="grid gap-x-8 md:grid-cols-2">
              <Row label="AI ingin melakukan" value={<Mono>TRANSFER</Mono>} />
              <Row
                label="Penerima pembayaran"
                value={
                  <Mono>
                    {address.slice(0, 8)}…{address.slice(-5)}
                  </Mono>
                }
              />
              <Row
                label="Nominal pembayaran"
                value={<Mono>{result.amount.toFixed(3)} BOT</Mono>}
              />
              <Row label="Jaringan yang dipakai" value="BOT Testnet (968)" />
              <Row label="Tujuan pembayaran" value="Tagihan server" />
            </div>
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="mt-4 flex flex-wrap gap-2"
            >
              {[
                "Nominal sudah dicek",
                "Penerima sudah dicek",
                "Kontrak aktif",
                "Batas harian tersedia",
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
              <Icon name="check" /> Pembayaran demo disetujui — tidak ada uang
              asli yang dikirim
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
                  Mensimulasikan persetujuan wallet…
                </>
              ) : (
                <>
                  <Icon name="wallet" />
                  Setujui pembayaran demo
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
                  Mencatat keputusanmu…
                </>
              ) : (
                "Saya memahami risikonya — lanjutkan demo"
              )}
            </MBtn>
          ) : (
            <MBtn key="block" variant="danger" disabled className="w-full py-3">
              Pembayaran diblokir oleh aturan keamananmu
            </MBtn>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
