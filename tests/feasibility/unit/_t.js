/* Tiny test helper shared by the unit tests. Run each file with: node tests/unit/<name>.test.js */
"use strict";
var failed = 0, passed = 0;
function ok(name, cond, detail) {
  if (cond) passed++; else failed++;
  console.log((cond ? "ok    " : "FAIL  ") + name + (!cond && detail !== undefined ? "  [" + (typeof detail === "string" ? detail : JSON.stringify(detail)) + "]" : ""));
}
function near(a, b, tol) { return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol; }
function done() {
  console.log("\n" + (failed ? failed + " check(s) failed, " + passed + " passed" : "all " + passed + " checks passed"));
  process.exit(failed ? 1 : 0);
}
module.exports = { ok: ok, near: near, done: done };
