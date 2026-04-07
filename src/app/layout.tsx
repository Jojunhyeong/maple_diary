import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { SessionProvider } from "@/shared/ui/SessionProvider";

export const metadata: Metadata = {
  title: "Maple Diary",
  description: "메이플스토리 재획 수익 추적 대시보드",
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full antialiased bg-app">
        <SessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
