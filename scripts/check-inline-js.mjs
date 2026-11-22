import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim().length > 0);

if (inlineScripts.length === 0) {
  throw new Error("No inline application script found in index.html");
}

for (let index = 0; index < inlineScripts.length; index += 1) {
  // Parse only. The application is not executed by this check.
  new Function(inlineScripts[index]);
}

if (!html.includes('id="player-nav"') || !html.includes('id="host-nav"')) {
  throw new Error("Expected five-section player and Host navigation shells");
}

console.log("B-Will inline JavaScript syntax check passed.");
