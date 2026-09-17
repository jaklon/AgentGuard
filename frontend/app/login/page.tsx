"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { animate, createScope, stagger } from "animejs";

export default function LoginPage() {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const scope = useRef<ReturnType<typeof createScope> | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate(".login-reveal", {
        opacity: [0, 1],
        y: [24, 0],
        delay: stagger(90),
        duration: 700,
        ease: "out(4)",
      });
      animate(".login-orbit-dot", {
        opacity: [0, 1],
        scale: [0.4, 1],
        delay: stagger(120),
        duration: 800,
        ease: "out(3)",
      });
    });
    return () => scope.current?.revert();
  }, []);

  const enter = () => {
    if (loading) return;
    setLoading(true);
    if (button.current)
      animate(button.current, {
        scale: [1, 0.98, 1],
        duration: 420,
        ease: "out(3)",
      });
    setTimeout(() => router.push("/dashboard"), 900);
  };

  return (
    <main ref={root} className="login-page">
      <Link href="/" className="login-back login-reveal">
        ← Kembali ke introduction
      </Link>
      <section className="login-story">
        <div className="login-reveal login-brand">
          <span>AG</span> AgentGuard
        </div>
        <div className="login-reveal login-copy">
          <p className="login-eyebrow">DEMO ACCESS · BOT TESTNET</p>
          <h1>
            Masuk ke ruang
            <br />
            kendali manusia.
          </h1>
          <p>
            Tidak ada akun asli, password, atau wallet yang diperlukan. Ini
            adalah simulasi frontend untuk menunjukkan alur keamanan AgentGuard.
          </p>
        </div>
        <div className="login-reveal login-promise">
          <i /> Tidak ada dana sungguhan yang dikirim
        </div>
      </section>

      <section className="login-panel">
        <div className="login-orbit" aria-hidden="true">
          <span className="login-orbit-dot dot-a" />
          <span className="login-orbit-dot dot-b" />
          <span className="login-orbit-dot dot-c" />
          <div className="login-orbit-core">✓</div>
        </div>
        <div className="login-reveal login-panel-copy">
          <span>SIMULATED IDENTITY</span>
          <h2>Pengguna Demo</h2>
          <p>
            Profil ini hanya ada di browser dan siap dipakai untuk menjelajahi
            seluruh pengalaman.
          </p>
        </div>
        <div className="login-reveal login-profile">
          <div className="login-avatar">RA</div>
          <div>
            <b>Rafly Alif</b>
            <span>0x71C…3A9 · 1.50 BOT</span>
          </div>
          <small>READY</small>
        </div>
        <button
          ref={button}
          onClick={enter}
          disabled={loading}
          className="login-button login-reveal"
        >
          {loading ? (
            <>
              <span className="login-spinner" /> Menyiapkan ruang demo…
            </>
          ) : (
            <>
              Masuk sebagai pengguna demo <span>→</span>
            </>
          )}
        </button>
        <p className="login-disclaimer login-reveal">
          Dengan melanjutkan, kamu masuk ke simulasi lokal. Tidak ada
          autentikasi atau koneksi wallet nyata.
        </p>
      </section>
    </main>
  );
}
