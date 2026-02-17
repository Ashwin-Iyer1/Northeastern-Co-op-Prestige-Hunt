import type { Metadata } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "NUWorks Prestige",
  description: "Company prestige rankings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
   <html lang="en" className={GeistPixelSquare.variable}>
      <body
      >
        {children}
      </body>
    </html>
  );
}
