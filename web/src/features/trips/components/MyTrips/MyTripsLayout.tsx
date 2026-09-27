import React from 'react';
import { MyTripsHeader } from './MyTripsHeader';
import { TripCardUpcoming } from './TripCardUpcoming';

import { TripCardCompleted } from './TripCardCompleted';

export const MyTripsLayout = () => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <MyTripsHeader />
        
        <div className="mt-8 space-y-6">
          <TripCardUpcoming />
          
          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 border-b border-gray-200 pb-2">Hành trình đã đi</h2>
          <TripCardCompleted />
        </div>
      </div>
    </div>
  );
};
