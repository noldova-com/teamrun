/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { PreBundleCheck } from "../pre-bundle-check.ts";

const folders: string[] = [];

const FILES: Readonly<Record<string, string>> = {
  "@angular_core.js": "export const created = 1;\n",
  "chunk-A1.js": "export const shared = 2;\n",
  "chunk-A1.js.map": "{\"version\":3}\n",
  "_metadata.json": "{\"browserHash\":\"b1\"}\n"
};

const cacheFolder = (files: Readonly<Record<string, string>>): { cache: string; deps: string; record: string } => {
  const cache = mkdtempSync(path.join(tmpdir(), "pre-bundle-"));
  folders.push(cache);
  const deps = path.join(cache, "deps");
  mkdirSync(path.join(deps, "nested"), { recursive: true });
  for (const [name, text] of Object.entries(files))
    writeFileSync(path.join(deps, name), text);
  return { cache, deps, record: path.join(cache, "_build", "angular-pre-bundle.json") };
};

const idOf = (folder: string, name: string, version: string): string => `${path.join(folder, name).split(path.sep).join(path.posix.sep)}?v=${version}`;

const logTo = (check: PreBundleCheck): string[] => {
  const lines: string[] = [];
  check.configureVitest({ vitest: { logger: { log: line => lines.push(line) }, onClose: () => undefined } });
  return lines;
};

describe("PreBundleCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("records each pre-bundled file's size and SHA-256 at the first request for one, parses each script once for each version, and says so for each", async () => {
    const { cache, deps, record } = cacheFolder(FILES);
    const parsed: string[] = [];
    const check = new PreBundleCheck((file, code) => {
      parsed.push(`${file}:${code.length}`);
      return [{ severity: "Warning", message: "A warning isn't a parse error" }];
    }, record);
    const lines = logTo(check);
    check.configResolved({ cacheDir: path.join(cache, "other") });
    check.configResolved({ cacheDir: cache });

    const results = await Promise.all([check.transform("", idOf(deps, "@angular_core.js", "b1")), check.transform("", idOf(deps, "chunk-A1.js", "b1"))]);
    await check.transform("", idOf(deps, "chunk-A1.js", "b1"));
    const first = parsed.splice(0);
    await check.transform("", idOf(deps, "@angular_core.js", "b2"));

    assert.deepEqual(results, [null, null]);
    assert.deepEqual(first, ["@angular_core.js", "chunk-A1.js"].map(t => `${t}:${FILES[t]?.length}`));
    assert.deepEqual(parsed, first);
    assert.deepEqual(JSON.parse(readFileSync(record, "utf8")), {
      folder: deps,
      files: Object.keys(FILES).sort().map(t => ({ file: t, size: Buffer.byteLength(FILES[t] ?? ""), sha256: createHash("sha256").update(FILES[t] ?? "").digest("hex") }))
    });
    assert.deepEqual(lines, Array(2).fill(`The pre-bundle check read 4 files in ${deps}, and its 2 scripts parse.`));
  });

  it("fails every request for a pre-bundled file at once, naming a script that doesn't parse and the record", async () => {
    const { cache, deps, record } = cacheFolder({ ...FILES, "chunk-B2.js": "export { a, b wasLastNodeCreated };\n" });
    const check = new PreBundleCheck(file => file === "chunk-B2.js" ? [{ severity: "Advice", message: "Advice isn't a parse error" },
      { severity: "Error", message: "Expected `,` but found `wasLastNodeCreated`" }] : [], record);
    check.configResolved({ cacheDir: cache });
    const refusal = (error: unknown): boolean => error instanceof Error && error.message === `Vite's pre-bundled ${path.join(deps, "chunk-B2.js")} doesn't parse: `
      + `Expected \`,\` but found \`wasLastNodeCreated\`. Each pre-bundled file's size and SHA-256, as the browser's first request for one found them, are in ${record}.`;

    await assert.rejects(check.transform("", idOf(deps, "@angular_core.js", "b1")), refusal);
    await assert.rejects(check.transform("", idOf(deps, "chunk-A1.js", "b1")), refusal);
    assert.equal(existsSync(record), true);
  });

  it("leaves alone every module outside a server's pre-bundle folder, and every module before a server names its cache", async () => {
    const { cache, deps, record } = cacheFolder(FILES);
    const parsed: string[] = [];
    const check = new PreBundleCheck(file => {
      parsed.push(file);
      return [];
    }, record);

    const before = await check.transform("", idOf(deps, "@angular_core.js", "b1"));
    check.configResolved({ cacheDir: cache });
    const outside = await Promise.all([idOf(path.join(deps, "nested"), "chunk-C3.js", "b1"), idOf(cache, "init-testbed.js", "b1"), "\0virtual:builder",
      `${path.join(cache, "deps_temp_1a2b", "chunk-A1.js").split(path.sep).join(path.posix.sep)}`].map(t => check.transform("", t)));

    assert.deepEqual([before, ...outside], [null, null, null, null, null]);
    assert.deepEqual([parsed, existsSync(record)], [[], false]);
  });

  it("lets every request through, saying why, when it can't read the pre-bundle folder", async () => {
    const { cache, record } = cacheFolder(FILES);
    const parsed: string[] = [];
    const check = new PreBundleCheck(file => {
      parsed.push(file);
      return [{ severity: "Error", message: "Unexpected token" }];
    }, record);
    const lines = logTo(check);
    check.configResolved({ cacheDir: path.join(cache, "swapped") });

    const results = await Promise.all([check.transform("", idOf(path.join(cache, "swapped", "deps"), "@angular_core.js", "b1")),
      check.transform("", idOf(path.join(cache, "swapped", "deps"), "chunk-A1.js", "b1"))]);

    assert.deepEqual(results, [null, null]);
    assert.deepEqual([parsed, existsSync(record), lines.length], [[], false, 1]);
    assert.ok(lines[0]?.startsWith(`The pre-bundle check couldn't read ${path.join(cache, "swapped", "deps")}, so it lets its requests through: ENOENT`), String(lines[0]));
  });

  it("still parses each script, and lets requests through when each parses, saying why when it can't keep its record", async () => {
    const { cache, deps } = cacheFolder(FILES);
    const record = path.join(deps, "_metadata.json", "angular-pre-bundle.json");
    const parsed: string[] = [];
    const check = new PreBundleCheck(file => {
      parsed.push(file);
      return [];
    }, record);
    const lines = logTo(check);
    check.configResolved({ cacheDir: cache });

    const result = await check.transform("", idOf(deps, "chunk-A1.js", "b1"));

    assert.deepEqual([result, parsed], [null, ["@angular_core.js", "chunk-A1.js"]]);
    assert.equal(lines.length, 2);
    assert.ok(lines[0]?.startsWith(`The pre-bundle check couldn't keep its record ${record}: `), String(lines[0]));
    assert.equal(lines[1], `The pre-bundle check read 4 files in ${deps}, and its 2 scripts parse.`);
  });
});
