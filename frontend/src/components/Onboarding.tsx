import { AnimatePresence, motion } from "framer-motion";
import { Icon, MBtn, spring } from "../shared";

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
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#131d2e] shadow-xl"
          >
            <div className="relative border-b border-white/[.07] p-6 md:p-8">
              <button
                onClick={onClose}
                aria-label="Tutup panduan"
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <Icon name="x" />
              </button>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
                <Icon name="shield" size={25} />
              </div>
              <h1 className="mt-5 text-2xl font-semibold md:text-3xl">
                AgentGuard itu buat apa?
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                AgentGuard adalah{" "}
                <b>satpam untuk pembayaran yang dibuat oleh AI</b>. Sebelum uang
                dikirim, AgentGuard mengecek apakah nominal, tujuan, dan
                penerimanya aman.
              </p>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [
                    "1",
                    "AI meminta bayar",
                    "Contoh: “Bayar 0.01 BOT untuk tagihan server.”",
                  ],
                  [
                    "2",
                    "AgentGuard memeriksa",
                    "Permintaan dibandingkan dengan aturan keamananmu.",
                  ],
                  [
                    "3",
                    "Kamu yang memutuskan",
                    "Pembayaran hanya lanjut setelah kamu setuju.",
                  ],
                ].map(([number, title, body]) => (
                  <div
                    key={number}
                    className="rounded-lg border border-white/[.07] bg-white/[.02] p-4"
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
              <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[.06] p-4 text-xs leading-5 text-emerald-200">
                <b>Tenang, ini hanya demo.</b> Tidak ada wallet asli, uang asli,
                atau transaksi blockchain sungguhan.
              </div>
              <MBtn onClick={onClose} className="mt-5 w-full py-3">
                Mengerti — mulai coba demo
              </MBtn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
