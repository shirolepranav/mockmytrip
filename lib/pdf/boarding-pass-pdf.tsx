import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { colors } from "@/lib/design/colors";
import type { BoardingPassData } from "@/lib/boarding-pass-view";
import { formatDateInTz, formatTimeInTz } from "@/lib/format";

/*
 * The downloadable boarding pass (Phase 5 task 5). react-pdf has its own
 * non-DOM primitives, so this is a SEPARATE render tree from
 * components/boarding-pass.tsx — the two "share layout tokens" (DS §9) via
 * BoardingPassData + lib/design/colors.ts, not literal shared JSX. The
 * SIMULATION watermark is a real <Text> node (QA 5.6 checks the PDF's text
 * layer), not a rasterized image.
 */

const styles = StyleSheet.create({
  page: { backgroundColor: colors.paper2 },
  card: { flexDirection: "row", height: "100%" },
  main: {
    flex: 1,
    padding: 28,
    position: "relative",
    fontFamily: "Helvetica",
  },
  watermark: {
    position: "absolute",
    top: 90,
    left: 60,
    fontSize: 56,
    fontFamily: "Helvetica-Bold",
    color: colors.line,
    opacity: 0.5,
    transform: "rotate(-18deg)",
  },
  simBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.stampRed,
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  airline: { fontSize: 13, fontFamily: "Helvetica-Bold", color: colors.ink },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
  },
  iata: { fontSize: 30, fontFamily: "Helvetica-Bold", color: colors.ink },
  city: { fontSize: 9, color: colors.inkSoft },
  arrow: { fontSize: 18, color: colors.sunset },
  detailsRow: { flexDirection: "row", gap: 26, marginBottom: 24 },
  detail: {},
  detailLabel: {
    fontSize: 8,
    color: colors.inkSoft,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.ink },
  pnrLine: { fontSize: 8, color: colors.inkSoft, position: "absolute", bottom: 20, left: 28 },
  stub: {
    width: 160,
    padding: 18,
    backgroundColor: colors.ink,
    justifyContent: "space-between",
    borderLeftStyle: "dashed",
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
  },
  stubSim: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    letterSpacing: 1,
  },
  qr: { width: 96, height: 96, alignSelf: "center" },
  stubRoute: { fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.paper },
  stubPnr: { fontSize: 9, color: colors.sky, marginTop: 2 },
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function BoardingPassDocument({ data }: { data: BoardingPassData }) {
  return (
    <Document title={`Wanderlost boarding pass ${data.pnr} (simulation)`}>
      <Page size={[620, 240]} style={styles.page}>
        <View style={styles.card}>
          <View style={styles.main}>
            <Text style={styles.watermark}>SIMULATION</Text>
            <View style={styles.headerRow}>
              <Text style={styles.airline}>
                {data.airlineName} · {data.airlineCode}
                {data.flightNumber}
              </Text>
              <Text style={styles.simBadge}>
                SIMULATION — not a real ticket, nothing was booked
              </Text>
            </View>
            <View style={styles.routeRow}>
              <View>
                <Text style={styles.iata}>{data.originIata}</Text>
                <Text style={styles.city}>{data.originCity}</Text>
              </View>
              <Text style={styles.arrow}>—✈—</Text>
              <View>
                <Text style={styles.iata}>{data.destIata}</Text>
                <Text style={styles.city}>{data.destCity}</Text>
              </View>
            </View>
            <View style={styles.detailsRow}>
              <Detail
                label="Date"
                value={formatDateInTz(data.departUtcMs, data.originTz)}
              />
              <Detail
                label="Boards"
                value={formatTimeInTz(data.departUtcMs, data.originTz)}
              />
              <Detail label="Class" value={data.cabin} />
              <Detail label="Seat" value={data.seat ?? "—"} />
              <Detail label="Gate" value={data.gate ?? "—"} />
            </View>
            <Text style={styles.pnrLine}>
              PNR {data.pnr} — a pretend confirmation code from a travel
              simulation. This is a SIMULATION.
            </Text>
          </View>
          <View style={styles.stub}>
            <Text style={styles.stubSim}>SIMULATION</Text>
            <PdfImage src={data.qrDataUrl} style={styles.qr} />
            <View>
              <Text style={styles.stubRoute}>
                {data.originIata} → {data.destIata}
              </Text>
              <Text style={styles.stubPnr}>{data.pnr}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Render the boarding pass to a PDF buffer (used by the download route + email attachment). */
export async function renderBoardingPassPdf(
  data: BoardingPassData,
): Promise<Buffer> {
  return renderToBuffer(<BoardingPassDocument data={data} />);
}
