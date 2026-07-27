import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { colors } from "@/lib/design/colors";
import { MotionProvider } from "@/lib/motion/reduced-motion";
import { ThemeProvider } from "@/components/theme-provider";
import { SwRegister } from "@/components/sw-register";
import { InstallPrompt } from "@/components/install-prompt";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wanderlost.app";
const DESCRIPTION =
  "A travel simulation for the joy of planning. Book pretend flights and hotels, pay $0.00, and savor the anticipation. Nothing is real — that's the point.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Wanderlost — All the thrill. None of the jet lag.",
    template: "%s · Wanderlost",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Wanderlost",
    url: "/",
    title: "Wanderlost — All the thrill. None of the jet lag.",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Wanderlost — All the thrill. None of the jet lag.",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: colors.paper,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="flex min-h-dvh flex-col bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sharp focus:bg-paper2 focus:px-s4 focus:py-s2"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <MotionProvider>
            {children}
            <SwRegister />
            <InstallPrompt />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
