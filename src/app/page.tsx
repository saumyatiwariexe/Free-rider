import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import FeaturesDetail from '@/components/ui/features-detail';
import LandingHero from '@/components/ui/landing-hero';

export default async function LandingPage() {
  const { userId } = await auth();

  // If already logged in, direct to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="flex flex-col relative w-full overflow-hidden">
      {/* 
        LandingHero has min-h-screen, giving it full viewport height automatically 
        and replacing the previous Nexum-styled hero with Free-Rider themes 
      */}
      <LandingHero />
      
      {/* Existing features detail remains scrollable below the hero fold */}
      <FeaturesDetail />
    </main>
  );
}
