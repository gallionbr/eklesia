import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Eklésia",
  description: "App da Igreja Eklésia: avisos, agenda, células, ofertas, Bíblia e oração.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://eklesia.international"),
  icons: { icon: "/icones/favicon-64.png", apple: "/icones/apple-180.png" },
  appleWebApp: { capable: true, title: "Eklésia", statusBarStyle: "default" },
  openGraph: { title: "Eklésia", description: "Avisos, agenda, células, ofertas, Bíblia e oração.", images: ["/icones/512.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1420" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
