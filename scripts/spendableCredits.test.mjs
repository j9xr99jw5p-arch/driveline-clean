import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateCredits } from "../src/lib/credits.ts";

const sql = readFileSync(new URL("../supabase/migrations/037_spendable_credit_grants.sql", import.meta.url), "utf8");

assert.match(sql, /create or replace function public\.ensure_starting_credits/i);
assert.match(sql, /create or replace function public\.grant_spendable_credits/i);
assert.match(sql, /create or replace function public\.reserve_credits/i);
assert.match(sql, /create or replace function public\.refund_credits/i);
assert.match(sql, /p_amount integer default 12/i);
assert.match(sql, /grant execute on function public\.grant_spendable_credits[\s\S]*to service_role/i);
assert.match(sql, /grant execute on function public\.reserve_credits[\s\S]*to service_role/i);
assert.match(sql, /revoke all on function public\.grant_spendable_credits[\s\S]*from public, anon, authenticated/i);

assert.equal(calculateCredits({ photoCount: 2, modTags: ["wrap", "stance"] }), 6);

console.log("spendable credit SQL tests passed");
