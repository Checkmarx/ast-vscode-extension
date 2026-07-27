/* eslint-env node */
/*
 * Repro: results JSON parse crash in the VS Code extension.
 *
 * Symptom (seen by customer):
 *   - Create Scan:  "Error running command ast-results.createScan:
 *                    Expected ',' or '}' after property value in JSON at position N"
 *   - Load results: "Error reading results: Unexpected NUMBER(997512652051031) in state COMMA"
 *
 * Root cause:
 *   getResultsJson()      (packages/core/src/utils/utils.ts:198)
 *   readResultsFromFile() (packages/core/src/utils/utils.ts:221)
 *   both post-process the results file with a context-free regex:
 *
 *       .replace(/:([0-9]{15,}),/g, ':"$1",')
 *
 *   Intent: quote large integer IDs so they survive as strings.
 *   Bug:    the regex also matches the SAME text inside a string VALUE
 *           (e.g. a code snippet / description), injecting a stray quote
 *           that breaks out of the string and corrupts the JSON.
 *
 * Trigger criteria (guaranteed failure):
 *   any string value that contains  ':' + 15-or-more digits + ','
 *
 * Run:  node bug-repro-results-json.js
 */

// A results payload where a STRING value happens to contain the pattern.
// 997512652051031 is exactly 15 digits (the minimum the regex matches) and is
// itself perfectly safe as a JS number - it never needed quoting at all.
const payload = { results: [{ description: "session:997512652051031,end" }] };
const raw = JSON.stringify(payload);

const BUGGY_REGEX = /:([0-9]{15,}),/g;

console.log("original   :", raw);
const transformed = raw.replace(BUGGY_REGEX, ':"$1",');
console.log("transformed:", transformed, "  <-- stray quote injected inside the string");

let reproduced = false;
try {
  JSON.parse(transformed);
} catch {
  reproduced = true;
}
console.log(
  reproduced
    ? "\nReproduced: JSON.parse threw (regex corrupted the string value)."
    : "\nUnexpected: parse succeeded (repro did not trigger)."
);

// Control: 14 digits does NOT match the regex, so it parses fine.
const safe = JSON.stringify({ results: [{ description: "session:99751265205103,end" }] });
JSON.parse(safe.replace(BUGGY_REGEX, ':"$1",'));
console.log("Control (14 digits) parses fine - confirms the 15-digit threshold.");
