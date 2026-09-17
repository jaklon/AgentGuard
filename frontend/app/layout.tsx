import type { Metadata } from "next";
import "../src/index.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "AgentGuard — Human control for AI payments",
  description:
    "A safety checkpoint between AI agents and blockchain payments on BOT Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
