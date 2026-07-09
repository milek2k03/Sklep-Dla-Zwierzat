import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { storeBrandName } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL || "https://www.pawlypetshop.pl",
);
const siteDescription =
  "Sklep z praktycznymi akcesoriami dla psów i kotów do domu, spaceru, auta i podróży.";
const siteOgImage = {
  url: "/images/pawly-hero.jpg",
  width: 1774,
  height: 887,
  alt: `${storeBrandName} - akcesoria dla psów i kotów`,
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: `${storeBrandName} - akcesoria dla psów i kotów`,
  description: siteDescription,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${storeBrandName} - akcesoria dla psów i kotów`,
    description: siteDescription,
    url: "/",
    siteName: storeBrandName,
    locale: "pl_PL",
    type: "website",
    images: [siteOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${storeBrandName} - akcesoria dla psów i kotów`,
    description: siteDescription,
    images: [siteOgImage.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Providers />
      </body>
    </html>
  );
}
