import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe Chords",
  description: "Guitar chord progressions for the mood you have in mind.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7EBDD" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1714" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The boot script sets data-motion-boot before paint. That attribute is
    // intentionally absent from server HTML, so hydration must accept it.
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "if(typeof matchMedia==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.motionBoot='pending';setTimeout(()=>document.documentElement.removeAttribute('data-motion-boot'),1200)}" }} /></head>
      <body>{children}</body>
    </html>
  );
}
