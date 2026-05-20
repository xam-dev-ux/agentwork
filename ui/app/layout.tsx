import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AgentWork",
  description: "On-chain AI task marketplace on Arc Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>
          <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">AgentWork</h1>
            <span className="text-sm text-gray-500">Arc Testnet</span>
          </header>
          <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
