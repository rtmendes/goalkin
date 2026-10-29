import type { Metadata, Viewport } from "next";
import { Inter, Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GoalKin", template: "%s · GoalKin" },
  description: "Your goal, on your calendar, with someone in your corner, in the tone you choose.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F3EC" },
    { media: "(prefers-color-scheme: dark)", color: "#14213D" },
  ],
};

// Applies the saved theme before paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem("gk-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 rounded bg-surface px-3 py-2">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
