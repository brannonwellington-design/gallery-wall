import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Brand requires Inter Regular 400 only — no other weights loaded.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Listen Labs / Gallery Wall",
  description: "Plan gallery walls to scale.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F4EB" },
    { media: "(prefers-color-scheme: dark)", color: "#130F06" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="h-full m-0 antialiased bg-surface-primary text-content-secondary">
        {children}
      </body>
    </html>
  );
}
