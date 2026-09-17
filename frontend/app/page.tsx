"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function IntroductionPage() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .from("[data-intro-nav]", { y: -18, opacity: 0, duration: 0.6 })
        .from(
          "[data-intro-line]",
          { y: 90, opacity: 0, rotate: 2, duration: 0.9, stagger: 0.1 },
          "-=0.2",
        )
        .from(
          "[data-intro-copy]",
          { y: 24, opacity: 0, duration: 0.65 },
          "-=0.45",
        )
        .from(
          "[data-intro-visual]",
          { scale: 0.86, opacity: 0, duration: 0.9 },
          "-=0.7",
        );

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 48,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
        });
      });

      gsap.to("[data-progress]", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });

      gsap.to("[data-orbit-card='request']", {
        xPercent: 18,
        yPercent: -12,
        rotate: -3,
        scrollTrigger: {
          trigger: "[data-system]",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
      gsap.to("[data-orbit-card='decision']", {
        xPercent: -16,
        yPercent: 14,
        rotate: 3,
        scrollTrigger: {
          trigger: "[data-system]",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, root);
    return () => context.revert();
  }, []);

  return (
    <main ref={root} className="intro-page">
      <div className="intro-progress">
        <span data-progress />
      </div>
      <nav data-intro-nav className="intro-nav">
        <Link href="/" className="intro-brand" aria-label="AgentGuard home">
          <GuardMark />
          <span>AgentGuard</span>
        </Link>
        <div className="intro-nav-right">
          <span className="intro-network">BOT Chain · 968</span>
          <Link href="/login" className="intro-login-link">
            Masuk
          </Link>
        </div>
      </nav>

      <section className="intro-hero">
        <div className="intro-kicker" data-intro-copy>
          Human approval infrastructure
        </div>
        <h1
          className="intro-title"
          aria-label="AI boleh bergerak cepat. Uangmu tidak boleh ikut ceroboh."
        >
          <span className="intro-title-mask">
            <span data-intro-line>AI boleh bergerak cepat.</span>
          </span>
          <span className="intro-title-mask">
            <span data-intro-line>Uangmu tidak boleh</span>
          </span>
          <span className="intro-title-mask intro-title-accent">
            <span data-intro-line>ikut ceroboh.</span>
          </span>
        </h1>
        <div className="intro-hero-bottom">
          <p data-intro-copy>
            AgentGuard berdiri di antara perintah AI dan pembayaran blockchain.
            Ia memeriksa niat, aturan, serta risiko—lalu mengembalikan keputusan
            terakhir kepadamu.
          </p>
          <div data-intro-copy className="intro-actions">
            <Link href="/login" className="intro-cta">
              Coba pengalaman demo <span>↗</span>
            </Link>
            <a href="#how" className="intro-text-link">
              Lihat cara kerjanya ↓
            </a>
          </div>
        </div>
        <div data-intro-visual className="intro-visual" aria-hidden="true">
          <div className="intro-visual-grid" />
          <div className="intro-agent-chip">
            <i /> AI AGENT <b>REQUESTING</b>
          </div>
          <div className="intro-guard-core">
            <GuardMark large />
            <span>CHECK</span>
          </div>
          <div className="intro-human-chip">
            <i /> HUMAN <b>IN CONTROL</b>
          </div>
          <svg
            className="intro-path"
            viewBox="0 0 1000 260"
            preserveAspectRatio="none"
          >
            <path d="M90 130 C300 20 370 235 510 130 S740 50 910 130" />
          </svg>
        </div>
      </section>

      <section className="intro-statement" data-reveal>
        <p className="intro-section-label">01 · THE PROBLEM</p>
        <p className="intro-statement-text">
          AI mampu bertindak dalam milidetik. <em>Kepercayaan tidak.</em>
        </p>
        <div className="intro-statement-aside">
          Satu alamat salah, satu nominal berlebih, atau satu instruksi
          berbahaya cukup untuk mengubah automasi menjadi kerugian.
        </div>
      </section>

      <section id="how" className="intro-flow" data-system>
        <header data-reveal>
          <p className="intro-section-label">02 · THE CHECKPOINT</p>
          <h2>
            Satu lapisan tenang
            <br />
            di antara niat dan uang.
          </h2>
        </header>
        <div className="intro-system-stage">
          <article
            data-orbit-card="request"
            className="intro-system-card intro-request-card"
          >
            <span>PERINTAH AI</span>
            <p>“Kirim 0.01 BOT untuk tagihan server.”</p>
            <small>Natural language input</small>
          </article>
          <div className="intro-system-core">
            <GuardMark large />
            <b>AGENTGUARD</b>
            <span>Policy engine</span>
          </div>
          <article
            data-orbit-card="decision"
            className="intro-system-card intro-decision-card"
          >
            <span>KEPUTUSAN</span>
            <p>
              <i /> AMAN UNTUK DILANJUTKAN
            </p>
            <small>Risk score · 12/100</small>
          </article>
        </div>
        <div className="intro-flow-list">
          {[
            [
              "01",
              "Baca niat",
              "Nominal, penerima, jaringan, dan tujuan dibentuk menjadi data yang jelas.",
            ],
            [
              "02",
              "Uji aturan",
              "Batas transaksi, penggunaan harian, dan penerima terpercaya diperiksa.",
            ],
            [
              "03",
              "Kembalikan kendali",
              "AMAN, PERIKSA, atau DIBLOKIR—manusia tetap menentukan langkah akhir.",
            ],
          ].map(([number, title, copy]) => (
            <article key={number} data-reveal>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="intro-proof">
        <div data-reveal className="intro-proof-heading">
          <p className="intro-section-label">03 · DESIGNED FOR TRUST</p>
          <h2>
            Tidak ada autopilot
            <br />
            untuk uangmu.
          </h2>
        </div>
        <div className="intro-proof-grid">
          <article data-reveal>
            <b>LOCAL</b>
            <h3>Evaluasi deterministik</h3>
            <p>
              Demo memproses aturan langsung di browser. Tidak ada instruksi
              yang dikirim ke server.
            </p>
          </article>
          <article data-reveal>
            <b>VISIBLE</b>
            <h3>Alasan, bukan skor kosong</h3>
            <p>
              Setiap keputusan menyertakan alasan dan pemeriksaan yang dapat
              kamu pahami.
            </p>
          </article>
          <article data-reveal>
            <b>HUMAN</b>
            <h3>Persetujuan tetap milikmu</h3>
            <p>AI mengusulkan. AgentGuard memeriksa. Kamu yang menentukan.</p>
          </article>
        </div>
      </section>

      <section className="intro-final" data-reveal>
        <GuardMark large />
        <p>Built for BOT Chain · Designed around human control</p>
        <h2>
          Biarkan AI bekerja.
          <br />
          <em>Jangan biarkan ia ceroboh.</em>
        </h2>
        <Link href="/login" className="intro-cta intro-cta-light">
          Masuk ke AgentGuard <span>→</span>
        </Link>
      </section>
      <footer className="intro-footer">
        <span>© 2026 AgentGuard</span>
        <span>Frontend-only prototype · No real funds</span>
      </footer>
    </main>
  );
}

function GuardMark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? "guard-mark guard-mark-large" : "guard-mark"}
      viewBox="0 0 32 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 2 29 6.5v10c0 8-5.2 14.4-13 18C8.2 30.9 3 24.5 3 16.5v-10L16 2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m9.5 18 4 4 9-10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
