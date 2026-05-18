import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Tudumm — Web Automation & Data Extraction Platform",
    template: "%s | Tudumm",
  },
  description:
    "The unified platform for web automation, data extraction, and lead intelligence. PhantomBuster + BrightData + Apify in one place.",
  keywords: [
    "web automation",
    "data extraction",
    "lead generation",
    "web scraping",
    "proxy",
    "workflow",
  ],
  authors: [{ name: "Tudumm" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tudumm.io",
    siteName: "Tudumm",
    title: "Tudumm — Web Automation & Data Extraction Platform",
    description:
      "The unified platform for web automation, data extraction, and lead intelligence.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@tudumm",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-slate-950 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
