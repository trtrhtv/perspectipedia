import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const hebrew = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-hebrew",
  display: "swap",
});

export const metadata: Metadata = {
  title: "perspectipedia — אנציקלופדיה מרובת נקודות מבט",
  description:
    "קראו כל נושא דרך כמה עדשות מבוססות, בכבוד — והשוו ביניהן. לא 'מי צודק', אלא איך כל עולם מבין את זה ועל מה הוא מבסס.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={hebrew.variable}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
