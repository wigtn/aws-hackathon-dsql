// OpenSlot correctness gate. Fires many stampedes across seeds/configs against a
// running server and FAILS (exit 1) if oversold is ever > 0 or granted > capacity.
// Usage:  PORT=3100 npm run start &   then   node scripts/verify.mjs
const BASE = `http://localhost:${process.env.PORT || 3000}`;

const post = async (path, body) =>
  (await fetch(BASE + path, { method: "POST", body: JSON.stringify(body) })).json();

let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failures++;
};

const configs = [
  { capacity: 1, buyers: 800 },
  { capacity: 1, buyers: 2000 },
  { capacity: 10, buyers: 500 },
  { capacity: 50, buyers: 1200 },
  { capacity: 100, buyers: 2000 },
];

console.log("— stampede invariants (oversold must be 0) —");
for (const cfg of configs) {
  for (const seed of [1, 42, 99, 7777]) {
    const { result: r } = await post("/api/demo/run", { ...cfg, seed });
    ok(
      r.oversold === 0 && r.granted <= cfg.capacity,
      `cap=${cfg.capacity} buyers=${cfg.buyers} seed=${seed} → granted=${r.granted} oversold=${r.oversold} oc000=${r.oc000_total}`,
    );
  }
}

console.log("— determinism (same seed → same result) —");
const a = await post("/api/demo/run", { capacity: 20, buyers: 600, seed: 555 });
const b = await post("/api/demo/run", { capacity: 20, buyers: 600, seed: 555 });
ok(
  a.result.oc000_total === b.result.oc000_total && a.result.granted === b.result.granted,
  `oc000 ${a.result.oc000_total}==${b.result.oc000_total}, granted ${a.result.granted}==${b.result.granted}`,
);

console.log("— ownership predicate (IDOR) —");
const attack = await post("/api/claim", {
  action: "confirm",
  eventId: "ev-kpop-world",
  buyerId: "attacker",
  seatNo: 1,
});
ok(attack.ok === false, "attacker cannot confirm a seat it doesn't own");

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
