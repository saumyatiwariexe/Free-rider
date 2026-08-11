import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import Navbar from '@/components/ui/navbar';

export const metadata: Metadata = {
  title: 'Free-Rider Tracker',
  description: 'Automatic contribution tracking for group work — no self-report required.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
