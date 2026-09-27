import { mockRoutesData } from "@/features/routes/data/mockRoutesData";
import { RouteDetailClient } from "@/features/routes/components/RouteDetail/RouteDetailClient";
import { notFound } from "next/navigation";
import { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const route = mockRoutesData.find((r) => r.id === resolvedParams.id);
  
  if (!route) {
    return {
      title: "Không tìm thấy cung đường",
    };
  }

  return {
    title: `${route.name} - Chi tiết cung đường Trekking System`,
    description: route.description,
  };
}

export default async function RouteDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const route = mockRoutesData.find((r) => r.id === resolvedParams.id);

  if (!route) {
    notFound();
  }

  return <RouteDetailClient route={route} />;
}
