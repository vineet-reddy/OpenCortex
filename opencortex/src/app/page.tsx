"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import type { TabId } from "@/components/Navigation";
import IdeasFeed from "@/components/IdeasFeed";
import PapersFeed from "@/components/PapersFeed";
import Spotlight from "@/components/Spotlight";
import AgentConnect from "@/components/AgentConnect";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("ideas");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "ideas" && <IdeasFeed />}
        {activeTab === "papers" && <PapersFeed />}
        {activeTab === "spotlight" && <Spotlight />}
        {activeTab === "connect" && <AgentConnect />}
      </main>
    </div>
  );
}
