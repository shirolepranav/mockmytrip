import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { colors } from "@/lib/design/colors";
import type { ItineraryExportData } from "@/lib/itinerary-export-view";

/*
 * Downloadable itinerary PDF (Phase 7 task 9) — mirrors
 * lib/pdf/boarding-pass-pdf.tsx's structure: a separate react-pdf render
 * tree sharing layout tokens via lib/design/colors.ts, not literal JSX.
 * Usable for a real trip: every item plus POI addresses where sourced, with
 * a footer disclosing that referenced bookings were simulated.
 */

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  sight: "Sight",
  activity: "Activity",
  transit: "Transit",
  rest: "Rest",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper2,
    padding: 36,
    fontFamily: "Helvetica",
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSoft, marginBottom: 18 },
  dayHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.horizonDeep,
    marginTop: 14,
    marginBottom: 6,
  },
  itemRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.ink },
  itemMeta: { fontSize: 9, color: colors.inkSoft },
  itemNote: { fontSize: 9, color: colors.inkSoft, marginTop: 2 },
  empty: { fontSize: 9, color: colors.inkSoft, fontStyle: "italic" },
  footer: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    fontSize: 8,
    color: colors.inkSoft,
  },
});

export function ItineraryDocument({ data }: { data: ItineraryExportData }) {
  return (
    <Document title={`${data.tripTitle} — itinerary (simulation)`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.tripTitle}</Text>
        <Text style={styles.subtitle}>
          {data.destinationCity}
          {data.destinationCountry ? `, ${data.destinationCountry}` : ""}
        </Text>

        {data.itemsByDay.map((items, dayIndex) => (
          <View key={dayIndex}>
            <Text style={styles.dayHeading}>Day {dayIndex + 1}</Text>
            {items.length === 0 ? (
              <Text style={styles.empty}>Nothing planned.</Text>
            ) : (
              items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemTitle}>
                    {item.time ? `${item.time} — ` : ""}
                    {item.title}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {CATEGORY_LABELS[item.category] ?? item.category}
                    {item.address ? ` · ${item.address}` : ""}
                  </Text>
                  {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                </View>
              ))
            )}
          </View>
        ))}

        <Text style={styles.footer}>
          Bookings referenced in this itinerary were part of a Wanderlost
          SIMULATION — nothing here was actually booked. Real-place details
          (names, addresses) are accurate; flights, hotels, and prices are
          not.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderItineraryPdf(data: ItineraryExportData): Promise<Buffer> {
  return renderToBuffer(<ItineraryDocument data={data} />);
}
