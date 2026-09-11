import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-assistant",
});

export const metadata: Metadata = {
  title: "AdiSignSocial",
  description: "חתימה נעימה על הסכם מול עדי.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch zoom stays available for readers who need it.
  viewportFit: "cover",
  themeColor: "#faf8f5",
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
