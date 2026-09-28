import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ClientObservability } from './components/client-observability';

const title = "Locações e Recebíveis — Módulo 1";
const description = "Controle operacional de locações, cobranças, recebimentos e despesas.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  const socialImage = new URL("/og-properties-v2.png", `${protocol}://${host}`).toString();

  return {
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      images: [{ url: socialImage, width: 1664, height: 944, alt: "Imóveis em Locações e Recebíveis" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><ClientObservability />{children}</body></html>;
}
