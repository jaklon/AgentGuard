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
            Enter
          </Link>
        </div>
      </nav>

      <section className="intro-hero">
        <div className="intro-kicker" data-intro-copy>
          Human approval infrastructure
        </div>
        <h1
          className="intro-title"
          aria-label="AI can move fast. Your money should not move carelessly."
        >
          <span className="intro-title-mask">
            <span data-intro-line>AI can move fast.</span>
          </span>
          <span className="intro-title-mask">
            <span data-intro-line>Your money should not</span>
          </span>
          <span className="intro-title-mask intro-title-accent">
            <span data-intro-line>move carelessly.</span>
          </span>
        </h1>
        <div className="intro-hero-bottom">
          <p data-intro-copy>
            AgentGuard stands between an AI instruction and a blockchain
            payment. It checks intent, policy, and risk—then returns the final
            decision to you.
          </p>
          <div data-intro-copy className="intro-actions">
            <Link href="/login" className="intro-cta">
              Try the live demo <span>↗</span>
            </Link>
            <a href="#how" className="intro-text-link">
              See how it works ↓
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
          AI can act in milliseconds. <em>Trust cannot.</em>
        </p>
        <div className="intro-statement-aside">
          One wrong address, one excessive amount, or one dangerous instruction
          can turn automation into a loss.
        </div>
      </section>

      <section id="how" className="intro-flow" data-system>
        <header data-reveal>
          <p className="intro-section-label">02 · THE CHECKPOINT</p>
          <h2>
            A calm layer
            <br />
            between intent and money.
          </h2>
        </header>
        <div className="intro-system-stage">
          <article
            data-orbit-card="request"
            className="intro-system-card intro-request-card"
          >
            <span>AI INSTRUCTION</span>
            <p>“Send 0.01 BOT for the server invoice.”</p>
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
            <span>DECISION</span>
            <p>
              <i /> SAFE TO PROCEED
            </p>
            <small>Risk score · 12/100</small>
          </article>
        </div>
        <div className="intro-flow-list">
          {[
            [
              "01",
              "Read the intent",
              "Amount, recipient, network, and purpose become clear structured data.",
            ],
            [
              "02",
              "Test the policy",
              "Transaction limits, daily usage, and trusted recipients are checked.",
            ],
            [
              "03",
              "Return control",
              "ALLOW, REVIEW, or BLOCK—the human still makes the final call.",
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
            No autopilot
            <br />
            for your money.
          </h2>
        </div>
        <div className="intro-proof-grid">
          <article data-reveal>
            <b>LOCAL</b>
            <h3>Deterministic evaluation</h3>
            <p>
              The demo evaluates policy directly in the browser. No instruction
              is sent to a server.
            </p>
          </article>
          <article data-reveal>
            <b>VISIBLE</b>
            <h3>Reasons, not just a score</h3>
            <p>
              Every decision includes reasons and checks you can understand.
            </p>
          </article>
          <article data-reveal>
            <b>HUMAN</b>
            <h3>Approval stays yours</h3>
            <p>AI proposes. AgentGuard checks. You decide.</p>
          </article>
        </div>
      </section>

      <section className="intro-final" data-reveal>
        <GuardMark large />
        <p>Built for BOT Chain · Designed around human control</p>
        <h2>
          Let AI do the work.
          <br />
          <em>Do not let it be careless.</em>
        </h2>
        <Link href="/login" className="intro-cta intro-cta-light">
          Enter AgentGuard <span>→</span>
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
