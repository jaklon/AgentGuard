"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandLogo } from "../src/shared";

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

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!reduceMotion) {
        gsap.to("[data-flow-path]", {
          strokeDashoffset: -64,
          duration: 2.4,
          ease: "none",
          repeat: -1,
        });
        gsap.to("[data-flow-core]", {
          scale: 1.045,
          duration: 1.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
        gsap.to("[data-orbit-card='request']", {
          y: -14,
          rotate: -2.5,
          duration: 2.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
        gsap.to("[data-orbit-card='decision']", {
          y: 14,
          rotate: 2.5,
          duration: 3.1,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
        gsap.to("[data-system-core]", {
          rotate: 3,
          scale: 1.035,
          duration: 2.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }
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
          <BrandLogo size={42} />
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
              Open AgentGuard <span>↗</span>
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
          <div className="intro-guard-core" data-flow-core>
            <BrandLogo size={64} />
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
            <path data-flow-path d="M90 130 C300 20 370 235 510 130 S740 50 910 130" />
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
          <div className="intro-system-core" data-system-core>
            <BrandLogo size={76} />
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
          ].map(([number, title, copy], index) => (
            <article key={number} data-reveal>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <FlowMockup type={index} />
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
            <div className="intro-proof-visual intro-proof-local" aria-hidden="true">
              <span>policy.evaluate(request)</span>
              <i />
              <i />
              <i />
              <strong>12 / 100</strong>
            </div>
            <h3>Deterministic evaluation</h3>
            <p>
              Policy checks run directly in the browser. Each request follows
              the same clear rules.
            </p>
          </article>
          <article data-reveal>
            <b>VISIBLE</b>
            <div className="intro-proof-visual intro-proof-visible" aria-hidden="true">
              <span><i /> Amount within limit</span>
              <span><i /> Recipient verified</span>
              <span><i /> Daily allowance available</span>
            </div>
            <h3>Reasons, not just a score</h3>
            <p>
              Every decision includes reasons and checks you can understand.
            </p>
          </article>
          <article data-reveal>
            <b>HUMAN</b>
            <div className="intro-proof-visual intro-proof-human" aria-hidden="true">
              <span>AGENTGUARD</span>
              <strong>Ready for your approval</strong>
              <i>APPROVE</i>
            </div>
            <h3>Approval stays yours</h3>
            <p>AI proposes. AgentGuard checks. You decide.</p>
          </article>
        </div>
      </section>

      <section className="intro-final" data-reveal>
        <BrandLogo size={96} />
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
        <span>BOT Chain Testnet · Human approval required</span>
      </footer>
    </main>
  );
}

function FlowMockup({ type }: { type: number }) {
  if (type === 0) {
    return (
      <div className="intro-flow-mockup mockup-intent" aria-hidden="true">
        <span>PAYMENT REQUEST</span>
        <strong>0.01 BOT</strong>
        <i>0x3A9…c76A</i>
        <small>server invoice</small>
      </div>
    );
  }
  if (type === 1) {
    return (
      <div className="intro-flow-mockup mockup-policy" aria-hidden="true">
        <span><i /> Amount within limit</span>
        <span><i /> Recipient verified</span>
        <span><i /> Daily allowance ready</span>
      </div>
    );
  }
  return (
    <div className="intro-flow-mockup mockup-decision" aria-hidden="true">
      <span>GUARD DECISION</span>
      <strong><i /> ALLOW</strong>
      <small>Human approval required</small>
    </div>
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
