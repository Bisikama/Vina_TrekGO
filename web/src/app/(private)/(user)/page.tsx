import { UserWelcomeHeader } from "@/features/users/components/UserWelcomeHeader";
import { QuickActionCards } from "@/features/users/components/QuickActionCards";
import { UpcomingTripHero } from "@/features/trips/components/UpcomingTripHero";
import { PromoBanner } from "@/features/trips/components/PromoBanner";
import { RecommendedRoutes } from "@/features/trips/components/RecommendedRoutes";
import { PopularTrips } from "@/features/trips/components/PopularTrips";

export default function UserDashboardPage() {
  return (
    <div className="bg-[#FDFDFD] min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* User Stats & Welcome */}
        <UserWelcomeHeader />

        {/* Quick Actions */}
        <QuickActionCards />


        {/* Main Dashboard Layout */}
        <div className="mt-4">
          <UpcomingTripHero />
          
          <PromoBanner />
          
          <RecommendedRoutes />
          
          <PopularTrips />
        </div>
        
      </div>
    </div>
  );
}
