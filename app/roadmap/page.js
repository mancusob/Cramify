import { Suspense } from "react";
import RoadmapClient from "./RoadmapClient";

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <main className="container">
          <section className="panel">
            <p className="muted">Loading roadmap...</p>
          </section>
        </main>
      }
    >
      <RoadmapClient />
    </Suspense>
  );
}
