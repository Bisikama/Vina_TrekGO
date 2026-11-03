import React, { createContext, useContext, useMemo, useState } from "react";

import { RentalTripOption } from "@/features/rentals/types";

type RentalSelectionContextValue = {
  selectedTrip: RentalTripOption | null;
  selectTrip: (trip: RentalTripOption | null) => void;
};

const RentalSelectionContext = createContext<
  RentalSelectionContextValue | undefined
>(undefined);

export function RentalSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedTrip, selectTrip] = useState<RentalTripOption | null>(null);
  const value = useMemo(
    () => ({ selectedTrip, selectTrip }),
    [selectedTrip],
  );

  return (
    <RentalSelectionContext.Provider value={value}>
      {children}
    </RentalSelectionContext.Provider>
  );
}

export function useRentalSelection() {
  const context = useContext(RentalSelectionContext);

  if (!context) {
    throw new Error(
      "useRentalSelection must be used within RentalSelectionProvider",
    );
  }

  return context;
}
