/**
 * The partner PIN, proved at every build (npm run test:pin): which PINs are
 * refused and why, that the stored form is a salted hash that only the right
 * PIN opens, the lock schedule, and the secrets behind sessions and PIN links.
 */
import { hashPin, lockMinutesAfter, looksLikeSecret, newSecret, pinProblem, PIN_TRIES, secretHash, triesLeft, verifyPin } from "../src/lib/partner-pin";

let passed = 0;
let failed = 0;
function check(what: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${what}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${what}\x1b[0m${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\nWhich PINs are refused");
  check("a good PIN is accepted", pinProblem("482913", "+2348031234567") === null);
  for (const [pin, why] of [
    ["12345", "five numbers"],
    ["1234567", "seven numbers"],
    ["48291a", "a letter"],
    ["", "nothing"],
    ["111111", "one number six times"],
    ["000000", "zeros"],
    ["123456", "numbers in a row"],
    ["654321", "numbers in a row, down"],
    ["890123", "a run that wraps past 9"],
    ["121212", "a repeated pair"],
    ["357357", "a repeated three"],
  ] as const) {
    check(`refuses ${pin || "an empty PIN"} (${why})`, pinProblem(pin) !== null, String(pinProblem(pin)));
  }
  check("refuses the last six numbers of the partner's own phone", pinProblem("482913", "+2348031482913") !== null);
  check("the same PIN is fine for someone whose phone ends differently", pinProblem("482913", "+2348039999999") === null);
  check("every refusal is a short sentence a person can act on", pinProblem("111111")!.length < 80 && pinProblem("12")!.endsWith("."));

  console.log("\nStored as a salted hash");
  const stored = await hashPin("482913");
  check("the stored form is scrypt$N$r$p$salt$key", /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(stored), stored);
  check("the PIN itself appears nowhere in it", !stored.includes("482913"));
  check("the right PIN opens it", await verifyPin("482913", stored));
  check("a wrong PIN does not", !(await verifyPin("482914", stored)));
  check("a PIN of the wrong shape does not", !(await verifyPin("48291", stored)));
  check("nothing stored opens nothing", !(await verifyPin("482913", null)));
  check("a damaged hash opens nothing", !(await verifyPin("482913", stored.slice(0, -4) + "AAAA")));
  check("a hash in another format opens nothing", !(await verifyPin("482913", "plain$482913")));
  const again = await hashPin("482913");
  check("the same PIN hashes differently each time (its own salt)", again !== stored && (await verifyPin("482913", again)));

  console.log("\nThe lock");
  check(`${PIN_TRIES - 1} wrong tries do not lock`, lockMinutesAfter(PIN_TRIES - 1) === null);
  check(`the ${PIN_TRIES}th wrong try locks for 15 minutes`, lockMinutesAfter(PIN_TRIES) === 15);
  check(`the next ${PIN_TRIES} lock for an hour`, lockMinutesAfter(PIN_TRIES * 2) === 60);
  check("after that, a day each time", lockMinutesAfter(PIN_TRIES * 3) === 1440 && lockMinutesAfter(PIN_TRIES * 7) === 1440);
  check("in between, no lock", lockMinutesAfter(PIN_TRIES + 2) === null);
  check("no tries yet: no lock", lockMinutesAfter(0) === null);
  check("tries left counts down to the lock", triesLeft(0) === PIN_TRIES && triesLeft(3) === 2 && triesLeft(PIN_TRIES) === PIN_TRIES);

  console.log("\nSecrets behind sessions and PIN links");
  const a = newSecret();
  const b = newSecret();
  check("a new secret every time", a !== b);
  check("a secret has the shape a cookie or a link carries", looksLikeSecret(a), a);
  check("anything else is not taken for one", !looksLikeSecret("short") && !looksLikeSecret("a/b+c=") && !looksLikeSecret(null));
  check("what is kept is its sha256, not the secret", secretHash(a).length === 64 && !secretHash(a).includes(a) && secretHash(a) === secretHash(a));

  console.log(`\n${passed} passed, ${failed} failed.${failed ? "" : "  \x1b[32mPIN verified.\x1b[0m"}\n`);
  process.exit(failed ? 1 : 0);
}

void main();
