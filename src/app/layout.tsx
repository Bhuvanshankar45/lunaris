import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lunaris — Zero-Knowledge Real-Time Messaging & Calling Sanctuary",
  description:
    "Production-quality, privacy-first messaging and calling application inspired by WhatsApp and Google Meet. Provable Signal-compatible Double Ratchet E2EE with forward secrecy, 10-minute temporary transit relay queue, and zero cloud backups.",
  keywords: [
    "privacy",
    "end-to-end encryption",
    "double ratchet",
    "zero-knowledge",
    "secure calling",
    "WebRTC",
    "meet",
    "lunaris",
  ],
  authors: [{ name: "Lunaris Privacy Team" }],
  openGraph: {
    title: "Lunaris — Zero-Knowledge Real-Time Messaging & Calling Sanctuary",
    description: "End-to-end encrypted messaging, media, and Google Meet-style group video calling.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#E0E0D5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
