import Image from "next/image";
import { AirlineMark } from "@/components/airline-mark";
import { formatDateInTz, formatTimeInTz } from "@/lib/format";
import type { BoardingPassData } from "@/lib/boarding-pass-view";

/*
 * On-screen boarding pass (DS §9 BoardingPass component). Shares its DATA
 * shape + lib/design/colors.ts tokens with lib/pdf/boarding-pass-pdf.tsx —
 * not literal JSX, since react-pdf has its own non-DOM primitives.
 */

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-ink-soft uppercase">
        {label}
      </p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

export function BoardingPass({ data }: { data: BoardingPassData }) {
  return (
    <div
      data-testid="boarding-pass"
      className="ticket-surface flex flex-col overflow-hidden shadow-e3 sm:flex-row"
    >
      <div className="flex flex-1 flex-col gap-s4 p-s5">
        <div className="flex items-start justify-between gap-s3">
          <div className="flex items-center gap-s3">
            <AirlineMark logoSeed={data.airlineLogoSeed} hue={data.airlineHue} />
            <div>
              <p className="font-semibold">{data.airlineName}</p>
              <p className="text-sm text-ink-soft">
                {data.airlineCode}
                {data.flightNumber} · {data.cabin}
              </p>
            </div>
          </div>
          <span className="rounded-pill border border-stamp-red px-s2 py-s1 font-mono text-xs font-semibold tracking-widest text-stamp-red uppercase">
            Simulation
          </span>
        </div>

        <div className="flex items-center gap-s4">
          <div>
            <p className="font-display text-3xl">{data.originIata}</p>
            <p className="text-sm text-ink-soft">{data.originCity}</p>
          </div>
          <span aria-hidden className="text-xl text-sunset">
            ✈
          </span>
          <div>
            <p className="font-display text-3xl">{data.destIata}</p>
            <p className="text-sm text-ink-soft">{data.destCity}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-s3 font-mono text-sm sm:grid-cols-4">
          <Detail
            label="Date"
            value={formatDateInTz(data.departUtcMs, data.originTz)}
          />
          <Detail
            label="Boards"
            value={formatTimeInTz(data.departUtcMs, data.originTz)}
          />
          <Detail label="Seat" value={data.seat ?? "—"} />
          <Detail label="Gate" value={data.gate ?? "—"} />
        </div>
      </div>

      <div className="flex flex-row items-center justify-between gap-s3 border-t-2 border-dashed border-line bg-ink p-s4 text-paper sm:w-40 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l-2">
        <Image
          src={data.qrDataUrl}
          alt="Boarding pass QR code (simulated)"
          width={88}
          height={88}
          unoptimized
          className="rounded-sharp bg-paper2 p-s1"
        />
        <div className="text-right sm:text-center">
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            Simulation
          </p>
          <p className="font-mono text-sm">{data.pnr}</p>
        </div>
      </div>
    </div>
  );
}
