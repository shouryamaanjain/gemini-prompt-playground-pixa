import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Annotation Dashboard",
  description: "Audio segment annotation and Gemini comparison",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white min-h-screen antialiased">{children}</body>
    </html>
  );
}
