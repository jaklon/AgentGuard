"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandLogo } from "../src/shared";
import { MainnetExplorerLink } from "../src/components/MainnetExplorerLink";

const AGENTGUARD_MAINNET_CONTRACT =
  "https://scan.botchain.ai/address/0xae49e0dFae28d43e149b09c4240CbA2F378A1dd6";

export default function IntroductionPage() {
  const root = useRef<HTMLElement>(null);
  const [activeFlow, setActiveFlow] = useState(0);

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
          <a
            className="intro-botchain-nav"
            href={AGENTGUARD_MAINNET_CONTRACT}
            target="_blank"
            rel="noreferrer"
            aria-label="Open AgentGuard on the BOT Chain mainnet explorer"
          >
            <span>BUILT ON</span>
            <img src="/brand/botchain-logo.svg" alt="BOT Chain" />
          </a>
          <span className="intro-network">BOT Chain Mainnet · 677</span>
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
            <MainnetExplorerLink />
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
            className="intro-path intro-path-desktop"
            viewBox="0 0 1000 260"
            preserveAspectRatio="none"
          >
            <path data-flow-path d="M90 130 C300 20 370 235 510 130 S740 50 910 130" />
          </svg>
          <svg
            className="intro-path intro-path-mobile"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path data-flow-path d="M27 22 C27 36 50 35 50 50 S74 64 74 78" />
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
        <div className="intro-flow-index" data-reveal>
          <div className="intro-flow-index-head">
            <span>CHECKPOINT SEQUENCE</span>
            <span>HOVER OR TAP TO INSPECT</span>
          </div>
          {[
            [
              "01",
              "INTENT PARSING",
              "Read the intent",
              "Turn a natural-language request into a clear payment instruction.",
            ],
            [
              "02",
              "POLICY CHECK",
              "Test the policy",
              "Compare the amount, recipient, and daily usage against live limits.",
            ],
            [
              "03",
              "HUMAN CONTROL",
              "Return control",
              "Show the risk and reasoning before the wallet can approve anything.",
            ],
          ].map(([number, label, title, copy], index) => {
            const active = activeFlow === index;
            return (
              <motion.button
                layout
                type="button"
                key={number}
                className={`intro-flow-row ${active ? "is-active" : ""}`}
                onMouseEnter={() => setActiveFlow(index)}
                onFocus={() => setActiveFlow(index)}
                onClick={() => setActiveFlow(index)}
                aria-expanded={active}
                transition={{ layout: { type: "spring", stiffness: 260, damping: 28 } }}
              >
                <span className="intro-flow-number">{number}</span>
                <span className="intro-flow-copy">
                  <span className="intro-flow-label">{label}</span>
                  <strong>{title}</strong>
                  <span className="intro-flow-description">{copy}</span>
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  {active && (
                    <motion.span
                      key={number}
                      className="intro-flow-preview"
                      initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    >
                      <FlowMockup type={index} />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="intro-flow-arrow" aria-hidden="true">→</span>
              </motion.button>
            );
          })}
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
              Policy checks run against live contract settings before your wallet
              opens. Each request follows the same clear rules.
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
        <div className="intro-final-actions">
          <Link href="/login" className="intro-cta intro-cta-light">
            Enter AgentGuard <span>→</span>
          </Link>
          <a
            href={AGENTGUARD_MAINNET_CONTRACT}
            target="_blank"
            rel="noreferrer"
            className="intro-explorer-cta"
          >
            <span className="intro-explorer-brand">
              <small>BUILT ON</small>
              <img src="/brand/botchain-logo.svg" alt="BOT Chain" />
            </span>
            <span className="intro-explorer-copy">
              Open verified contract <b>↗</b>
            </span>
          </a>
        </div>
      </section>
      <footer className="intro-footer">
        <span>© 2026 AgentGuard</span>
        <span>BOT Chain Mainnet · Human approval required · <a href={AGENTGUARD_MAINNET_CONTRACT} target="_blank" rel="noreferrer">Verified contract ↗</a> · <a href="/legal/reown-community-license.txt" target="_blank" rel="noreferrer">Reown notice</a></span>
      </footer>
    </main>
  );
}

function FlowMockup({ type }: { type: number }) {
  if (type === 0) {
    return (
      <span className="intro-flow-mockup mockup-intent" aria-hidden="true">
        <span className="mockup-bar"><BrandLogo size={28} /><b>INTENT / PARSED</b><i>01</i></span>
        <span className="mockup-command">Send <b>0.01 BOT</b> for the server invoice.</span>
        <span className="mockup-data"><i>RECIPIENT</i><b>0x3A9…c76A</b></span>
        <span className="mockup-data"><i>NETWORK</i><b>BOT · 677</b></span>
      </span>
    );
  }
  if (type === 1) {
    return (
      <span className="intro-flow-mockup mockup-policy" aria-hidden="true">
        <span className="mockup-bar"><BrandLogo size={28} /><b>POLICY / LIVE</b><i>02</i></span>
        <span><i /> Amount within 0.02 BOT limit</span>
        <span><i /> Recipient verified</span>
        <span><i /> Daily allowance available</span>
        <small>3 / 3 CHECKS PASSED</small>
      </span>
    );
  }
  return (
    <span className="intro-flow-mockup mockup-decision" aria-hidden="true">
      <span className="mockup-bar"><BrandLogo size={28} /><b>DECISION / READY</b><i>03</i></span>
      <span className="mockup-score"><strong><i /> ALLOW</strong><b>12 / 100 RISK</b></span>
      <span className="mockup-approval">AWAITING HUMAN APPROVAL <i>→</i></span>
    </span>
  );
}
