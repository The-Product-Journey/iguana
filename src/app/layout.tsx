import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Root metadata is platform-generic. Per-tenant title/description should
// be set in the tenant's own page metadata; the root metadata only ships
// when a visitor lands on `/` itself, which (for now) redirects to the
// first active reunion (see src/app/page.tsx).
export const metadata: Metadata = {
  title: "Reunion",
  description: "A platform for organizing reunions.",
  icons: {
    icon: "/favicon.ico",
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
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-gray-50 text-gray-900`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
