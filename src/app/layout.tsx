import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leadscale",
  description: "Shared foundation for real estate lead prioritization.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}