import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  description: "pixelating",
  robots: "noindex",
  icons:
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👾</text></svg>",
};

const rocketRinder = localFont({
  src: [
    {
      path: "../public/RocketRinder-yV5d.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-rr",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={rocketRinder.variable}>
      <body>{children}</body>
    </html>
  );
}
