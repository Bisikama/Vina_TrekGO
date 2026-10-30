import { Redirect, type Href, useLocalSearchParams } from "expo-router";


export default function RentalSettlementRedirectScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const href = id
    ? {
        pathname: "/rental-orders/[id]",
        params: { id },
      }
    : "/(tabs)/rental";

  return <Redirect href={href as Href} />;
}
