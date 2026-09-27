"use client";

import { TripData } from "../../data/mockTripsData";
import { TripHeader } from "./TripHeader";
import { ItineraryAccordion } from "./ItineraryAccordion";
import { ServicesAndPolicy } from "./ServicesAndPolicy";
import { BookingSidebar } from "./BookingSidebar";

export const TripDetailClient = ({ trip }: { trip: TripData }) => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen pb-20">
      <TripHeader trip={trip} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Content Column */}
          <div className="flex-1 lg:max-w-[700px] xl:max-w-[800px]">
            <ItineraryAccordion trip={trip} />
            <ServicesAndPolicy trip={trip} />
          </div>

          {/* Sidebar Column */}
          <div className="lg:w-[380px] shrink-0">
            <BookingSidebar trip={trip} />
          </div>
        </div>
      </div>
    </div>
  );
};
