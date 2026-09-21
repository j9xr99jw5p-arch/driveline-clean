import assert from "node:assert/strict";
import { calculateCredits } from "../src/lib/credits.ts";

assert.equal(calculateCredits({ photoCount: 0, modTags: [] }), 1, "base cost with no photos");
assert.equal(calculateCredits({ photoCount: 2, modTags: [] }), 3, "base + two photos");
assert.equal(calculateCredits({ photoCount: 2, modTags: ["wrap"] }), 5, "wrap adds 2");
assert.equal(calculateCredits({ photoCount: 2, modTags: ["wrap", "stance"] }), 6, "wrap + stance");
assert.equal(calculateCredits({ photoCount: 2, modTags: ["wrap", "stance", "wheels"] }), 7, "wrap + stance + wheels");
assert.equal(calculateCredits({ photoCount: 2, modTags: ["wrap", "bumper"] }), 6, "unknown tag is an extra mod");
assert.equal(calculateCredits({ photoCount: 5, modTags: [] }), 4, "photo count caps at 3");
assert.equal(calculateCredits({ photoCount: 1, modTags: ["Wrap", "PAINT", "stance"] }), 5, "tags normalize and wrap/paint do not double-count");

console.log("credits tests passed");
