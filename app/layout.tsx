import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "Flatmate — shared living, sorted",
    description: "Share duties, split expenses, and keep your home running without awkward reminders.",
    openGraph: { title: "Flatmate — shared living, sorted", description: "A calmer way to share duties and expenses.", images: [imageUrl] },
    twitter: { card: "summary_large_image", title: "Flatmate — shared living, sorted", description: "A calmer way to share duties and expenses.", images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
