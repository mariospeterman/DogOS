#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const files = process.argv.slice(2);
const targets = files.length === 0 ? [".env.local", ".env.example"] : files;
const assignmentPattern = /^[A-Za-z_][A-Za-z0-9_]*=/;
let failed = false;

for (const file of targets) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (assignmentPattern.test(line)) continue;
    console.error(
      `${file}:${index + 1}: invalid env line; expected KEY=value or comment`,
    );
    failed = true;
  }
}

if (failed) process.exitCode = 1;
