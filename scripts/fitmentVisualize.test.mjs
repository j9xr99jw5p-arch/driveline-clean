import assert from "node:assert/strict";
import { buildImageEditPrompt, splitRequestedChanges } from "../lib/fitmentVisualize.ts";

assert.deepEqual(
  splitRequestedChanges("wrap a mustang red and lower it"),
  ["wrap a mustang red", "lower it"]
);

const prompt = buildImageEditPrompt(
  {
    year: 2024,
    make: "Ford",
    model: "Mustang",
    trim: "Not specified",
    cab: "Not specified",
    bed: "Not specified",
    tireSize: "265/35R19",
    wheelDiameter: 19,
    wheelWidth: 9,
    wheelOffset: 35,
    liftHeight: 0,
    useCase: "mixed",
    rearLoad: "normal",
    plannedChanges: "wrap a mustang red and lower it"
  },
  { index: 2, count: 2 }
);

assert.match(prompt, /1\. wrap a mustang red/);
assert.match(prompt, /2\. lower it/);
assert.match(prompt, /photo 2 of 2/);
assert.match(prompt, /Applying only one requested change is a failed edit/);
assert.match(prompt, /Change nothing else/);
assert.match(prompt, /LOCKED/);
assert.match(prompt, /Leave them exactly as photographed/);
assert.doesNotMatch(prompt, /stock ride height/);
assert.doesNotMatch(prompt, /Exact setup to match/);

console.log("fitmentVisualize tests passed");
