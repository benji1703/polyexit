import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://polyexit.vercel.app"),
  title: "Polyexit — private prediction markets",
  description: "Private, coin-only prediction markets for teams. No purchases, transfers, or cash value.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Polyexit",
    description: "Private predictions. Zero real money.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Polyexit — private predictions, zero real money" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Polyexit",
    description: "Private predictions. Zero real money.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
