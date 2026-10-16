import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex F1 | Race Intelligence",
  description: "Formula 1 race predictions and historical model analysis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
