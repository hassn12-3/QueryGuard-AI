import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataMind — Multi-Agent Text-to-SQL & Analytics",
  description:
    "Production-ready agentic AI system for natural language data analysis. Ask questions in plain English, get instant SQL queries, interactive charts, and executive insights powered by LangGraph.",
  keywords: [
    "text to sql",
    "AI analytics",
    "LangGraph",
    "natural language query",
    "data analysis",
    "business intelligence",
  ],
  authors: [{ name: "DataMind" }],
  openGraph: {
    title: "DataMind — Multi-Agent Text-to-SQL",
    description: "Ask data questions in plain English. Get instant insights.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="mesh-bg h-full w-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
