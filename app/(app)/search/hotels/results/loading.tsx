import { PaperPlaneLoader } from "@/components/paper-plane-loader";

/* Streaming loading state: the paper-plane loader (WF §7). */
export default function HotelResultsLoading() {
  return (
    <section className="flex flex-col gap-s4">
      <div className="h-16" aria-hidden />
      <PaperPlaneLoader />
    </section>
  );
}
