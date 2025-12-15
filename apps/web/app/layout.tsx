import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/AuthProvider';
import "./globals.css";

export const metadata: Metadata = {
  title: "ORCHESTR'A V2",
  description: "Gestion de projets et RH pour collectivités territoriales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
