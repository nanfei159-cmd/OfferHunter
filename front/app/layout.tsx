"use client";

import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import ContentArea from "./components/ContentArea";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>Offer猎手 · 猎聘投递助手</title>
        <meta name="description" content="Offer猎手 · 猎聘岗位筛选、自动打招呼与简历投递" />
        <link
          rel="icon"
          href="/offer-hunter.png"
          type="image/png"
        />
        <link rel="apple-touch-icon" href="/offer-hunter.png" />
      </head>
      <body suppressHydrationWarning className="dark:bg-blacksection">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <div className="flex min-h-screen">
            <Sidebar />
            <ContentArea>
              {children}
            </ContentArea>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
