import assert from "node:assert/strict";
import { parseBuildNoteSections } from "../lib/buildNotes.ts";

const dump = `Suspension - King Shocks 2.5 with adjusters - SPC Upper Control Arms - Icon Vehicle Dynamics RXT Leaf Pack - DuroBumps front and rear bump stops Wheels & Tires - Toyo Open Country R/T Pro 305/70R17 - Relations Race Wheels RR5-S, 17 inch, -12 offset Fitment - Aggressive trimming required - Body mount chop required - Upper control arms adjusted forward slightly for tire clearance Recovery / Overland - MaxTrax traction boards - UpTop Overland bed rack - Overland Vehicle Systems RTT - Prinsu roof rack Armor / Exterior - Icon Vehicle Dynamics front bumper - Cali Raised LED rock sliders - TRD Pro style grille - TRD Pro front skid - DRT Fabrication lower control arm skids - RCI Offroad transmission skid, transfer case skid, and gas tank skid Lighting / Electrical - Auxbeam 8 gang switch panel - ARB onboard twin air compressor - Diode Dynamics 30 inch bumper light bar - Diode Dynamics fog lights - Baja Designs Squadron Sport ditch lights - Baja Designs S2 Sport chase lights - AlphaRex headlights and taillights - Meso Customs interior lighting - Side mirror sequential turn signals Interior - Meso Customs interior chrome delete - PRP seat covers - Stinger Off-Road head unit - Husky Liners floor mats`;

const sections = parseBuildNoteSections(dump);
const byHeading = Object.fromEntries(sections.map((section) => [section.heading, section.items]));

assert.deepEqual(Object.keys(byHeading), [
  "Suspension",
  "Wheels & Tires",
  "Fitment",
  "Recovery / Overland",
  "Armor / Exterior",
  "Lighting / Electrical",
  "Interior"
]);
assert.equal(byHeading["Wheels & Tires"][1], "Relations Race Wheels RR5-S, 17 inch, -12 offset");
assert.equal(byHeading.Suspension[0], "King Shocks 2.5 with adjusters");
assert.equal(byHeading.Interior.at(-1), "Husky Liners floor mats");
assert.equal(byHeading["Lighting / Electrical"].length, 9);

const structured = parseBuildNoteSections(`Suspension
- King Shocks 2.5
- SPC Upper Control Arms

Interior
- PRP seat covers`);
assert.equal(structured[0].heading, "Suspension");
assert.deepEqual(structured[0].items, ["King Shocks 2.5", "SPC Upper Control Arms"]);
assert.equal(structured[1].heading, "Interior");

console.log("buildNotes tests passed");
