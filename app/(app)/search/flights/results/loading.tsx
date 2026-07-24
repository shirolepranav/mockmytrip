import { DepartureBoard } from "@/components/departure-board";

/* Streaming loading state: the signature split-flap board (DS §8.1). */
export default function ResultsLoading() {
  return (
    <section className="flex flex-col gap-s4">
      <div className="h-16" aria-hidden />
      <DepartureBoard />
    </section>
  );
}
