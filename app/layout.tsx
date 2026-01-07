import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import { TRPCProvider } from "@trpc/client";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CO-NOTION",
  description: "CO-NOTION is a platform for creating and managing your docs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div className="text-sm font-semibold">CO-NOTION</div>
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>
          <main>
            {/* <TRPCProvider> */}
              {children}
              {/* </TRPCProvider> */}
            </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
