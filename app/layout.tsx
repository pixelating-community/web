import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import ServiceWorkerRegister from "@/app/ServiceWorkerRegister";
import "@/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  robots: "noindex",
  title: "👾",
  description: "👾",
  manifest: "/manifest.webmanifest",
  icons:
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👾</text></svg>",
  appleWebApp: {
    capable: true,
    title: "👾",
    statusBarStyle: "black-translucent",
  },
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
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
