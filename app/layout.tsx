import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ULearn",
  description: "Your AI-powered learning companion",
  icons: {
    icon: [
      {
        url: '/High Res Logo Ulearn Black.svg',
        type: 'image/svg+xml',
      }
    ],
    apple: [
      {
        url: '/High Res Logo Ulearn Black.svg',
        type: 'image/svg+xml',
      }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
