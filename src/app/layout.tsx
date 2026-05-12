import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F4EB" },
    { media: "(prefers-color-scheme: dark)", color: "#130F06" },
  ],
};

// Runs synchronously before React paints, so we never flash light on a
// dark-saved theme. Reads localStorage and stamps data-theme="dark" on
// <html>; absent or "light" → no attribute, default light theme applies.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("gw-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full m-0 antialiased bg-surface-primary text-content-secondary">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
