"use client";

import { listDocuments } from "@aqshara/api";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { UploadBanner } from "./_components/upload-banner";
import { ActivityFeed } from "./_components/activity-feed";
import { SubscriptionBanner } from "./_components/subscription-banner";

export default function HomePage() {
  const { getToken, isLoaded } = useAuth();

  const documentsQuery = useQuery({
    queryKey: ["documents", "home"],
    enabled: isLoaded,
    queryFn: () => listDocuments({ page: 1, limit: 20 }, getToken),
  });

  const documents = documentsQuery.data?.data ?? [];

  // Generate mock activity feed based on documents
  const activities = documents.slice(0, 10).map((doc) => ({
    id: doc.id,
    date: doc.created_at,
    document: doc,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col md:flex-row gap-10 md:gap-8 px-6 py-8 md:py-12 min-h-[calc(100vh-60px)] pb-8">
      {/* Left Column */}
      <div className="w-full md:w-[340px] shrink-0 flex flex-col gap-6 md:sticky md:top-[92px] md:self-start">
        <UploadBanner />
        <SubscriptionBanner />
      </div>

      {/* Right Column */}
      <ActivityFeed 
        activities={activities} 
        isLoading={documentsQuery.isLoading} 
      />
    </div>
  );
}
