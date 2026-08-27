const fs = require('fs');

// This script only applies to self-hosted "standalone" builds. On Vercel,
// output: "standalone" is disabled (see next.config.ts), so .next/standalone
// won't exist — skip gracefully instead of crashing the build.
if (!fs.existsSync('.next/standalone')) {
  console.log('No .next/standalone directory found (not a standalone build) — skipping asset copy.');
  process.exit(0);
}

fs.cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
fs.cpSync('public', '.next/standalone/public', { recursive: true });
