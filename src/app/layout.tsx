import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Bricolage Grotesque is the platform's primary UI typeface. Variable
// font with weights 400–800 — request the full range so we can use 800
// for the wordmark fallback, 600–700 for headings, 400–500 for body.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Fraunces, italic, light weight — used for marketing-style page headings
// and the wordmark fallback. Loaded with italic + 300/400 weights only;
// no roman cuts because we never use Fraunces upright.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glad You Made It",
  description: "Reunion sites, made simple.",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <body
          className={`${bricolage.variable} ${fraunces.variable} font-sans antialiased bg-white text-ink`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
