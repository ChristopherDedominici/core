#!/usr/bin/env node

// TODO: remove

// node scripts/patch-hardhat-downloader.js

/**
 * Patches the Hardhat v3 solc compiler downloader to gracefully handle
 * missing native binaries (e.g. solc 0.4.24 on linux-aarch64).
 *
 * Problem: On linux-aarch64 (ARM64), older solc versions like 0.4.24 don't
 * have native binaries. Hardhat's downloader calls `#getCompilerBuild(version)`
 * which throws when the version isn't in the native binary list, crashing the
 * entire build instead of falling back to WASM.
 *
 * Fix: Wrap `#getCompilerBuild()` calls in try/catch in 3 methods:
 *   - isCompilerDownloaded() → return false (not downloaded)
 *   - downloadCompiler()     → return false (can't download)
 *   - getCompiler()          → return undefined (no compiler)
 *
 * This lets the build system gracefully skip the native compiler and use WASM.
 *
 * Usage: node scripts/patch-hardhat-downloader.js
 * Run after: yarn install, yarn add, or any operation that reinstalls hardhat.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(
  import.meta.dirname,
  "..",
  "node_modules/hardhat/dist/src/internal/builtin-plugins/solidity/build-system/compiler/downloader.js",
);

const original = readFileSync(FILE, "utf8");

// ── Patch 1: isCompilerDownloaded ──────────────────────────────────────
// Original:
//   async isCompilerDownloaded(version) {
//       const build = await this.#getCompilerBuild(version);
// Patched:
//   async isCompilerDownloaded(version) {
//       let build;
//       try {
//           build = await this.#getCompilerBuild(version);
//       } catch {
//           return false;
//       }
const patch1 = {
  from: `async isCompilerDownloaded(version) {
        const build = await this.#getCompilerBuild(version);`,
  to: `async isCompilerDownloaded(version) {
        let build;
        try {
            build = await this.#getCompilerBuild(version);
        } catch {
            return false;
        }`,
};

// ── Patch 2: downloadCompiler ──────────────────────────────────────────
// Original:
//           const build = await this.#getCompilerBuild(version);
//           let downloadPath;
// Patched:
//           let build;
//           try {
//               build = await this.#getCompilerBuild(version);
//           } catch {
//               return false;
//           }
//           let downloadPath;
const patch2 = {
  from: `            const build = await this.#getCompilerBuild(version);\n            let downloadPath`,
  to: `            let build;\n            try {\n                build = await this.#getCompilerBuild(version);\n            } catch {\n                return false;\n            }\n            let downloadPath`,
};

// ── Patch 3: getCompiler ───────────────────────────────────────────────
// Original:
//   async getCompiler(version) {
//       const build = await this.#getCompilerBuild(version);
// Patched:
//   async getCompiler(version) {
//       let build;
//       try {
//           build = await this.#getCompilerBuild(version);
//       } catch {
//           return undefined;
//       }
const patch3 = {
  from: `async getCompiler(version) {
        const build = await this.#getCompilerBuild(version);`,
  to: `async getCompiler(version) {
        let build;
        try {
            build = await this.#getCompilerBuild(version);
        } catch {
            return undefined;
        }`,
};

const patches = [patch1, patch2, patch3];

let patched = original;
let applied = 0;
let skipped = 0;

for (const { from, to } of patches) {
  if (patched.includes(to)) {
    skipped++;
    continue;
  }
  if (!patched.includes(from)) {
    console.error("❌ Could not find expected code block to patch:");
    console.error(from.slice(0, 80) + "...");
    process.exit(1);
  }
  patched = patched.replace(from, to);
  applied++;
}

if (applied === 0) {
  console.log("✅ All patches already applied — nothing to do.");
  process.exit(0);
}

writeFileSync(FILE, patched, "utf8");
console.log(`✅ Patched hardhat downloader: ${applied} applied, ${skipped} already present.`);
