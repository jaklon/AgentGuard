import { AnimatePresence, motion } from "framer-motion";
import { BrandLogo, Icon, MBtn, spring } from "../shared";

export default function Onboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-[#050810d9] p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={spring}
            onClick={(event) => event.stopPropagation()}
            className="onboarding-panel w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#14191b] text-[#f4efe1] shadow-xl"
          >
            <div className="relative border-b border-white/[.1] p-6 md:p-8">
              <button
                onClick={onClose}
                aria-label="Close guide"
                className="absolute right-4 top-4 rounded-lg p-2 text-[#8f958e] hover:bg-white/5 hover:text-white"
              >
                <Icon name="x" />
              </button>
              <BrandLogo size={54} />
              <h1 className="mt-5 text-2xl font-semibold md:text-3xl">
                What does AgentGuard do?
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#a8aa9f]">
                AgentGuard is{" "}
                <b>a safety checkpoint for payments prepared by AI</b>. Before
                funds move, AgentGuard checks whether the amount, purpose, and
                recipient are safe.
              </p>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [
                    "1",
                    "AI requests a payment",
                    "Example: “Pay 0.01 BOT for the server invoice.”",
                  ],
                  [
                    "2",
                    "AgentGuard checks",
                    "The request is compared against your safety policy.",
                  ],
                  [
                    "3",
                    "You make the decision",
                    "The payment proceeds only after you approve it.",
                  ],
                ].map(([number, title, body]) => (
                  <div
                    key={number}
                    className="rounded-lg border border-white/[.1] bg-white/[.035] p-4"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300">
                      {number}
                    </span>
                    <h2 className="mt-3 text-sm font-semibold">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[.06] p-4 text-xs leading-5 text-emerald-800">
                <b>BOT Testnet is active.</b> The policy engine runs locally and
                wallet approval remains simulated in this frontend build.
              </div>
              <MBtn onClick={onClose} className="mt-5 w-full py-3">
                Got it — open AgentGuard
              </MBtn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
