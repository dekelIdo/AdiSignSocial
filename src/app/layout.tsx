import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-assistant",
});

export const metadata: Metadata = {
  title: "חתימה שקטה למסמכים",
  description: "חתימה נעימה ופשוטה על מסמכי PDF.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" data-scroll-behavior="smooth">
      <body className={assistant.variable}>{children}</body>
    </html>
  );
}
