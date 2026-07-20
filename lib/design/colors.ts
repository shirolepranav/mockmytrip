/*
 * Mirror of the design tokens in app/globals.css for renderers that cannot
 * read CSS variables (react-pdf boarding pass, React Email templates).
 * If a hex changes in globals.css it MUST change here too — the
 * check-banned-styles script allowlists only these two files for raw hex.
 */

export const colors = {
  ink: "#122a3a",
  paper: "#f6eedf",
  paper2: "#fbf6ec",
  inkSoft: "#3e5566",
  sunset: "#f4713b",
  sunsetDeep: "#d6521f",
  horizon: "#177e7e",
  horizonDeep: "#0f5c5c",
  sky: "#9cc6d0",
  stampRed: "#c4362e",
  stampViolet: "#6e4a8e",
  gold: "#e8b23a",
  mintOk: "#3b9c6e",
  alert: "#c24a3a",
  line: "#d9c9ae",
} as const;

export type ColorToken = keyof typeof colors;
