"use client";

import { RouteData } from "../../data/mockRoutesData";
import { RouteHeader } from "./RouteHeader";
import { RouteTerrainAndMap } from "./RouteTerrainAndMap";
import { RouteCheckpoints } from "./RouteCheckpoints";
import { UpcomingTripsSidebar } from "./UpcomingTripsSidebar";

export const RouteDetailClient = ({ route }: { route: RouteData }) => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen pb-20">
      <RouteHeader route={route} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Content Column */}
          <div className="flex-1 lg:max-w-[700px] xl:max-w-[800px]">
            <RouteTerrainAndMap route={route} />
            <RouteCheckpoints route={route} />
          </div>

          {/* Sidebar Column */}
          <div className="lg:w-[320px] xl:w-[380px] shrink-0">
            <UpcomingTripsSidebar route={route} />
          </div>
        </div>
      </div>
    </div>
  );
};
