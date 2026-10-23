// Secret check (no dependency). Blocks a commit that adds a .env file, a database backup, or a
// line that looks like a real key, token, password or connection string. Prints where it is,
// never the value.
//   node scripts/check-secrets.mjs           staged changes (the pre-commit hook, .githooks/)
//   node scripts/check-secrets.mjs --all     every tracked file (pnpm check-secrets)
// A false alarm can be committed with `git commit --no-verify` after checking it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** Files that must never be committed. */
const FORBIDDEN_FILES = [
  {
    name: ".env file (secrets)",
    test: (file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example"),
  },
  { name: "database backup", test: (file) => /\.ndjson\.gz(\.enc)?$|(^|\/)backups\//.test(file) },
  { name: "private key file", test: (file) => /\.(pem|key|p12|pfx)$/.test(file) },
];

const PLACEHOLDER = /^(user|username|pass|password|secret|xxx+|<[^>]*>|\*+|\$\{[^}]*\})$/i;

/** Patterns of real secrets. */
const SECRETS = [
  {
    name: "connection string with a password",
    find: (line) =>
      [...line.matchAll(/[a-z][a-z0-9+.-]*:\/\/([^\s:@/"'`]+):([^\s@/"'`]+)@([^\s/"'`]+)/gi)].some(
        ([, user, pass, host]) =>
          !PLACEHOLDER.test(pass) &&
          !PLACEHOLDER.test(user) &&
          !/example|xxx|localhost|127\.0\.0\.1/i.test(host),
      ),
  },
  { name: "Brevo API key", find: (line) => /xkeysib-[a-f0-9]{32,}/i.test(line) },
  { name: "Brevo SMTP key", find: (line) => /xsmtpsib-[a-f0-9]{32,}/i.test(line) },
  { name: "Meta access token", find: (line) => /\bEAA[A-Za-z0-9]{60,}/.test(line) },
  { name: "private key", find: (line) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line) },
  {
    name: "AWS key",
    // AWS's documentation keys end with EXAMPLE (AKIAIOSFODNN7EXAMPLE): the signature tests use them.
    find: (line) =>
      [...line.matchAll(/\bAKIA[0-9A-Z]{16}\b/g)].some(([key]) => !key.endsWith("EXAMPLE")),
  },
  { name: "GitHub token", find: (line) => /\bgh[pousr]_[A-Za-z0-9]{30,}/.test(line) },
  {
    name: "secret value in an env file",
    find: (line, file) =>
      /(^|\/)\.env/.test(file) &&
      /^\s*[A-Z0-9_]*(SECRET|TOKEN|API_KEY|PASSWORD|PASSPHRASE|MONGODB_URI)\s*=\s*\S{8,}/.test(
        line,
      ),
  },
];

const problems = [];
const checkLine = (file, lineNumber, line) => {
  for (const secret of SECRETS) {
    if (secret.find(line, file)) problems.push(`${file}:${lineNumber}  ${secret.name}`);
  }
};

const all = process.argv.includes("--all");
const files = all
  ? git("ls-files").split("\n").filter(Boolean)
  : git("diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n").filter(Boolean);

for (const file of files) {
  for (const rule of FORBIDDEN_FILES) {
    if (rule.test(file)) problems.push(`${file}  ${rule.name}: never commit it`);
  }
}

if (all) {
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary
    text.split("\n").forEach((line, index) => checkLine(file, index + 1, line));
  }
} else {
  // Only the lines added by this commit.
  let file = "";
  let lineNumber = 0;
  for (const line of git("diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR").split(
    "\n",
  )) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    else if (line.startsWith("@@")) lineNumber = Number(/\+(\d+)/.exec(line)?.[1] ?? 0) - 1;
    else if (line.startsWith("+")) checkLine(file, ++lineNumber, line.slice(1));
  }
}

if (problems.length > 0) {
  console.error("Secret check: possible secrets found (values not shown):");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "Move secrets to the ignored .env files (see docs/SECURITY.md). False alarm? Check it, then git commit --no-verify.",
  );
  process.exit(1);
}
if (all) console.log(`Secret check: ${files.length} tracked files, nothing found.`);
