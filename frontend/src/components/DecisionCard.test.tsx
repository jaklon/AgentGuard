import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionCard } from "./DecisionCard";

describe("DecisionCard", () => {
  it("shows a blocked decision and the deterministic reason", () => {
    render(
      <DecisionCard
        result={{
          decision: "BLOCK",
          risk_score: 92,
          reason: "Payment exceeds the configured transaction limit",
          intent: {
            action: "payment",
            recipient: "0x2222222222222222222222222222222222222222",
            amount_bot: "0.05",
            chain_id: 968,
            purpose: "demo",
          },
          warnings: [],
          source: "manual",
          transaction_hash: null,
          evaluated_at: "2026-09-14T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("BLOCK")).toBeInTheDocument();
    expect(screen.getByText(/exceeds the configured transaction limit/i)).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
  });
});
