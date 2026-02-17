import type { Metadata } from "next";
import { GeistPixelCircle, GeistPixelGrid, GeistPixelSquare, GeistPixelTriangle } from "geist/font/pixel";
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
   <html lang="en" className={GeistPixelTriangle.variable}>
      <body
      >
        {children}
      </body>
    </html>
  );
}
