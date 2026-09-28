#!/usr/bin/env node
// Preflight script for free-forever-router
// Checks and auto-fixes common deployment issues

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const REQUIRED_SECRETS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "OPENROUTER_API_KEY",
  "HUGGINGFACE_TOKEN",
];

const CHECKS = [];
let passed = 0;
let failed = 0;
let fixed = 0;

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function pass(msg) {
  passed++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  failed++;
  console.log(`  ❌ ${msg}`);
}

function fix(msg) {
  fixed++;
  console.log(`  🔧 ${msg}`);
}

function fileExists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function readFile(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}

function writeFile(p, content) {
  fs.writeFileSync(path.join(ROOT, p), content);
}

// Check 1: package.json valid
check("package.json valid", () => {
  if (!fileExists("package.json")) {
    fail("package.json missing");
    return;
  }
  try {
    JSON.parse(readFile("package.json"));
    pass("package.json is valid JSON");
  } catch {
    fail("package.json is invalid JSON");
  }
});

// Check 2: wrangler.toml valid and has AI binding
check("wrangler.toml valid", () => {
  if (!fileExists("wrangler.toml")) {
    fail("wrangler.toml missing");
    return;
  }
  const content = readFile("wrangler.toml");
  if (!content.includes("name =")) {
    fail("wrangler.toml missing worker name");
  } else {
    pass("wrangler.toml has worker name");
  }
  if (!content.includes("[ai]")) {
    fail("wrangler.toml missing [ai] binding");
    writeFile("wrangler.toml", content.trim() + "\n\n[ai]\nbinding = \"AI\"\n");
    fix("Added [ai] binding to wrangler.toml");
  } else {
    pass("wrangler.toml has [ai] binding");
  }
  if (!content.includes("compatibility_date")) {
    fail("wrangler.toml missing compatibility_date");
  } else {
    pass("wrangler.toml has compatibility_date");
  }
});

// Check 3: Worker source exists and has no obvious syntax issues
check("Worker source valid", () => {
  if (!fileExists("src/index.js")) {
    fail("src/index.js missing");
    return;
  }
  const content = readFile("src/index.js");
  if (!content.includes("export default")) {
    fail("src/index.js missing export default");
  } else {
    pass("src/index.js has export default");
  }
  if (!content.includes("env.AI")) {
    fail("src/index.js does not use env.AI - router needs AI binding");
  } else {
    pass("src/index.js uses env.AI");
  }
});

// Check 4: GitHub workflow file exists
check("GitHub Actions workflow", () => {
  if (!fileExists(".github/workflows/deploy.yml")) {
    fail(".github/workflows/deploy.yml missing - deployment will not run");
    console.log("    To fix: manually create .github/workflows/deploy.yml in GitHub UI");
    console.log("    (GitHub token lacks workflow scope to push Actions files)");
  } else {
    pass(".github/workflows/deploy.yml exists");
    const wf = readFile(".github/workflows/deploy.yml");
    if (!wf.includes("CLOUDFLARE_API_TOKEN")) {
      fail("Workflow missing CLOUDFLARE_API_TOKEN reference");
    } else {
      pass("Workflow references CLOUDFLARE_API_TOKEN");
    }
  }
});

// Check 5: Git remote configured
check("Git remote", () => {
  try {
    const remote = execSync("git remote get-url origin", { cwd: ROOT, encoding: "utf8" }).trim();
    if (remote.includes("github.com")) {
      pass(`Git remote origin: ${remote}`);
    } else {
      fail(`Git remote origin is not GitHub: ${remote}`);
    }
  } catch {
    fail("Git remote origin not set");
  }
});

// Check 6: No uncommitted critical changes
check("Git working tree", () => {
  try {
    const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" }).trim();
    if (status) {
      fail("Uncommitted changes detected:\n" + status.split("\n").map(l => "      " + l).join("\n"));
      console.log("    To fix: git add . && git commit -m '...' && git push");
    } else {
      pass("No uncommitted changes");
    }
  } catch {
    fail("Could not check git status");
  }
});

// Check 7: .gitignore excludes secrets
check(".gitignore", () => {
  if (!fileExists(".gitignore")) {
    fail(".gitignore missing");
    writeFile(".gitignore", "node_modules/\n.wrangler/\n.dev.vars\n.env\n*.log\n");
    fix("Created .gitignore");
    return;
  }
  const content = readFile(".gitignore");
  if (!content.includes(".wrangler/")) {
    writeFile(".gitignore", content.trim() + "\n.wrangler/\n");
    fix("Added .wrangler/ to .gitignore");
  } else {
    pass(".gitignore excludes .wrangler/");
  }
  if (!content.includes(".dev.vars")) {
    writeFile(".gitignore", content.trim() + "\n.dev.vars\n");
    fix("Added .dev.vars to .gitignore");
  } else {
    pass(".gitignore excludes .dev.vars");
  }
});

// Check 8: Local env tokens exist
check("Local env tokens", () => {
  const envDir = path.join(process.env.HOME || "", ".config/opencode/env");
  if (!fs.existsSync(envDir)) {
    fail(`Env directory missing: ${envDir}`);
    return;
  }
  const files = fs.readdirSync(envDir);
  let foundCount = 0;
  for (const secret of REQUIRED_SECRETS) {
    let found = false;
    for (const file of files) {
      const content = fs.readFileSync(path.join(envDir, file), "utf8");
      if (content.includes(`${secret}=`)) {
        found = true;
        foundCount++;
        break;
      }
    }
    if (found) {
      pass(`Local env has ${secret}`);
    } else {
      fail(`Local env missing ${secret}`);
    }
  }
});

// Check 9: GitHub secrets set (requires gh CLI)
check("GitHub secrets", () => {
  try {
    const repo = execSync("gh repo view --json nameWithOwner -q .nameWithOwner", { cwd: ROOT, encoding: "utf8" }).trim();
    const secrets = execSync(`gh secret list --repo ${repo} --json name -q '.[].name'`, { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const secret of REQUIRED_SECRETS) {
      if (secrets.includes(secret)) {
        pass(`GitHub secret ${secret} set`);
      } else {
        fail(`GitHub secret ${secret} missing`);
        console.log(`    To fix: gh secret set ${secret}`);
      }
    }
  } catch (err) {
    fail(`Could not check GitHub secrets: ${err.message}`);
  }
});

// Check 10: Worker name valid
check("Worker name", () => {
  try {
    const wrangler = readFile("wrangler.toml");
    const match = wrangler.match(/name\s*=\s*"([^"]+)"/);
    if (match) {
      const name = match[1];
      if (/^[a-z0-9-]+$/.test(name)) {
        pass(`Worker name valid: ${name}`);
      } else {
        fail(`Worker name invalid: ${name} (only lowercase letters, numbers, hyphens)`);
      }
    } else {
      fail("Could not parse worker name");
    }
  } catch {
    fail("Could not check worker name");
  }
});

async function main() {
  console.log("\n🚀 Free Forever Router - Preflight Checks\n");

  for (const { name, fn } of CHECKS) {
    console.log(`▶ ${name}`);
    try {
      fn();
    } catch (err) {
      fail(`Exception in ${name}: ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed, ${fixed} auto-fixed`);

  if (failed > 0) {
    console.log("\n❌ Preflight FAILED. Fix the issues above before deploying.");
    process.exit(1);
  }

  console.log("\n✅ Preflight PASSED — deployment cleared.");
}

main();
