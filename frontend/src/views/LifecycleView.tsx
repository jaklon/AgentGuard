import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Card,
  Icon,
  MBtn,
  Mono,
  Pill,
  Row,
  Spinner,
  T,
  fadeUp,
  spring,
} from "../shared";
export default function LifecycleView() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setProgress((p) => Math.min(100, p + 2)), 200);
    return () => clearInterval(id);
  }, []);
  const confirmed = progress >= 100;
  const replay = () => setProgress(0);
  return (
    <motion.div {...fadeUp}>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">
          Transaction lifecycle
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          From approval to finality
        </h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative min-h-[500px] overflow-hidden p-5">
          <div className="blur-[3px] opacity-40">
            <h3 className="text-lg font-semibold">Transaction preview</h3>
            <Row label="To" value={<Mono>0x3A9…c76A</Mono>} />
            <Row label="Amount" value="0.01 BOT" />
            <div className="mt-6 h-32 rounded-xl bg-white/5" />
          </div>
          <div className="absolute inset-0 grid place-items-center bg-[#f1efe8e8] p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm text-center">
              <div className="relative mx-auto h-24 w-24">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="absolute inset-1 rounded-full border-2 border-transparent border-t-indigo-400 border-l-indigo-400"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-4 rounded-full border-2 border-transparent border-b-cyan-400 border-r-cyan-400"
                />
                <div className="absolute inset-0 grid place-items-center text-indigo-400">
                  <Icon name="wallet" size={25} />
                </div>
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                Awaiting MetaMask Approval…
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Review and approve the request in your wallet.
              </p>
              <div className="my-5 rounded-xl border border-white/[.08] bg-white/[.035] p-4 text-left">
                <Row label="Recipient" value={<Mono>0x3A9…c76A</Mono>} />
                <Row label="Amount" value="0.01 BOT" />
                <Row label="Network" value="BOT Testnet" />
                <Row label="Guard" value={<Pill status="ALLOW" />} />
              </div>
              <MBtn variant="secondary">Cancel request</MBtn>
            </div>
          </div>
        </Card>
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500">Network status</span>
              <div className="mt-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={String(confirmed)}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={spring}
                  >
                    <Pill status={confirmed ? "CONFIRMED" : "BROADCASTING"} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <button
              onClick={replay}
              className="text-xs text-slate-400 hover:text-white"
            >
              ↺ Replay
            </button>
          </div>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              animate={{
                width: `${progress}%`,
                backgroundColor: confirmed ? T.allow : T.blue,
              }}
              className="h-full rounded-full"
            />
          </div>
          <div className="mt-7 flex justify-between">
            {["Submitted", "Propagated", "Included", "Finalized"].map(
              (x, i) => {
                const reached = progress >= i * 33;
                return (
                  <div key={x} className="flex flex-col items-center gap-2">
                    <motion.div
                      animate={{
                        scale: reached ? 1 : 0.75,
                        backgroundColor: reached
                          ? confirmed && i === 3
                            ? T.allow
                            : T.blue
                          : "#26344a",
                      }}
                      transition={spring}
                      className="grid h-8 w-8 place-items-center rounded-full text-xs"
                    >
                      {reached ? <Icon name="check" size={14} /> : i + 1}
                    </motion.div>
                    <span
                      className={`text-[10px] ${reached ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {x}
                    </span>
                  </div>
                );
              },
            )}
          </div>
          <div className="mt-8 rounded-xl bg-[#0a101c] p-4">
            <Row
              label="Tx hash"
              value={
                <span className="flex items-center gap-2">
                  <Mono>0x8f2a…91c4</Mono>
                  {confirmed ? <Icon name="check" size={15} /> : <Spinner />}
                </span>
              }
            />
          </div>
          <div className="my-5 grid grid-cols-2 gap-3">
            {[
              ["Block", confirmed ? "1,942,816" : "Pending"],
              ["Gas", "21,438"],
              ["Network", "BOT Testnet"],
              ["Time", confirmed ? "9.8s" : "—"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-white/[.035] p-3">
                <p className="text-[11px] text-slate-500">{a}</p>
                <p className="mt-1 text-sm font-semibold">{b}</p>
              </div>
            ))}
          </div>
          <MBtn variant={confirmed ? "approve" : "primary"} className="w-full">
            {confirmed ? (
              <>
                <Icon name="check" />
                View confirmed receipt
              </>
            ) : (
              <>
                <Spinner />
                Broadcasting transaction
              </>
            )}
          </MBtn>
        </Card>
      </div>
    </motion.div>
  );
}
