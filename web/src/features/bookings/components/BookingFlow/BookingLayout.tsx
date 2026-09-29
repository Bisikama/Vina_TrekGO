"use client";

import React, { useState } from 'react';
import { BookingSteps } from './BookingSteps';
import { BookingForm } from './BookingForm';
import { BookingSidebar } from './BookingSidebar';

export const BookingLayout = () => {
  const [equipmentCost, setEquipmentCost] = useState(0);

  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BookingSteps />
        <div className="flex flex-col lg:flex-row gap-8">
          <BookingForm onEquipmentCostChange={setEquipmentCost} />
          <BookingSidebar equipmentCost={equipmentCost} />
        </div>
      </div>
    </div>
  );
};
