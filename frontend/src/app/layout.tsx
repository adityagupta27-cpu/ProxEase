import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import Topbar from "@/components/Topbar"
import Footer from "@/components/Footer"

export const metadata: Metadata = {
  title: "ProxEase - Smart Substitution & Proxy Management Portal",
  description: "Automated substitute teacher assignment system using OR-Tools CP-SAT",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full dark antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground h-screen flex overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-0">
            <div className="max-w-7xl mx-auto w-full animate-fade-in flex flex-col min-h-full">
              <div className="flex-1 pb-8">
                {children}
              </div>
              <Footer />
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
