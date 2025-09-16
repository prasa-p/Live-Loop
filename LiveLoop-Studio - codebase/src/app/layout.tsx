import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "LiveLoop — Collaborative AI-assisted Live Looping Studio",
  description: "Jam in real time, record loops, get AI suggestions, and export stems to your DAW.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Prevent theme flash */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              const ls = localStorage.getItem('theme');
              const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              const theme = ls === 'light' || ls === 'dark' ? ls : (prefersDark ? 'dark' : 'light');
              if (theme === 'dark') document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            } catch {}
          `}
        </Script>
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "LiveLoop", "version": "0.1.0"}'
        />
        {children}
        <ThemeToggle />
        <VisualEditsMessenger />
      </body>
    </html>
  );
}