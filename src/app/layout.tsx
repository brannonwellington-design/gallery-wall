import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gallery Wall",
  description: "Plan gallery walls to scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full m-0 bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
