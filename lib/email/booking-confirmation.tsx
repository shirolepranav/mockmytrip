import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { colors } from "@/lib/design/colors";
import type { BoardingPassData } from "@/lib/boarding-pass-view";
import { formatDateInTz, formatTimeInTz } from "@/lib/format";

/*
 * Booking confirmation email (Phase 5 task 6, TECH_SPEC §7). The simulation
 * disclaimer opens the DESCRIPTION-equivalent content top AND bottom —
 * golden rule #2 — so it's visible whether someone skims or reads through.
 */

const SIMULATION_DISCLAIMER =
  "This is a SIMULATION — no travel is booked, nothing was charged, and no real airline is involved.";

export function BookingConfirmationEmail({ data }: { data: BoardingPassData }) {
  return (
    <Html>
      <Head />
      <Preview>{SIMULATION_DISCLAIMER}</Preview>
      <Body
        style={{
          backgroundColor: colors.paper,
          fontFamily: "Helvetica, Arial, sans-serif",
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: colors.paper2,
            border: `1px solid ${colors.line}`,
            borderRadius: 14,
            padding: 24,
            maxWidth: 480,
          }}
        >
          <Section
            style={{
              backgroundColor: colors.stampRed,
              borderRadius: 8,
              padding: "8px 14px",
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color: colors.paper2,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                margin: 0,
                textAlign: "center" as const,
              }}
            >
              SIMULATION — {SIMULATION_DISCLAIMER}
            </Text>
          </Section>

          <Heading style={{ color: colors.ink, fontSize: 22, margin: "0 0 4px" }}>
            Your (pretend) trip to {data.destCity} is booked ✈
          </Heading>
          <Text style={{ color: colors.inkSoft, fontSize: 14, margin: "0 0 16px" }}>
            {data.airlineName} {data.airlineCode}
            {data.flightNumber} · {data.originIata} → {data.destIata}
          </Text>

          <Section
            style={{
              backgroundColor: colors.paper,
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ margin: "0 0 6px", fontSize: 13, color: colors.inkSoft }}>
              PNR (fake): <strong style={{ color: colors.ink }}>{data.pnr}</strong>
            </Text>
            <Text style={{ margin: "0 0 6px", fontSize: 13, color: colors.inkSoft }}>
              Departs {formatDateInTz(data.departUtcMs, data.originTz)} at{" "}
              {formatTimeInTz(data.departUtcMs, data.originTz)}
            </Text>
            {data.seat ? (
              <Text style={{ margin: 0, fontSize: 13, color: colors.inkSoft }}>
                Seat {data.seat} · Gate {data.gate ?? "—"}
              </Text>
            ) : null}
          </Section>

          <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
            Your boarding pass PDF is attached — and always available in the
            app, simulation watermark and all.
          </Text>

          <Hr style={{ borderColor: colors.line, margin: "20px 0" }} />

          <Text
            style={{
              color: colors.ink,
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center" as const,
            }}
          >
            SIMULATION — {SIMULATION_DISCLAIMER}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BookingConfirmationEmail;
