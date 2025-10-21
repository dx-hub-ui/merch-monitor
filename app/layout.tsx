import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Merch Watcher",
  description: "Monitor Merch on Demand products, momentum, and trends in real time."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
