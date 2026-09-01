import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { SessionProvider } from "@/shared/ui/SessionProvider";
import { GA4PageViewTracker } from "@/shared/ui/GA4PageViewTracker";
import { QueryProvider } from "@/shared/ui/QueryProvider";

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
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full antialiased bg-app">
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaId}', { send_page_view: false });
              `}
            </Script>
          </>
        )}
        <QueryProvider>
          <SessionProvider>
            <ThemeProvider>
              {gaId && (
                <Suspense fallback={null}>
                  <GA4PageViewTracker />
                </Suspense>
              )}
              {children}
            </ThemeProvider>
          </SessionProvider>
        </QueryProvider>
        {isDev && (
          <Script
            src="https://unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
