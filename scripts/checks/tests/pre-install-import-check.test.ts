/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { PreInstallImportCheck } from "../pre-install-import-check.ts";

const folders: string[] = [];
const REPOSITORY = path.resolve(import.meta.dirname, "..", "..", "..");

const rootWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "pre-install-"));
  folders.push(root);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return root;
};

const runIn = async (root: string, entryPoints: readonly string[] = ["scripts/entry.ts"]): Promise<{ passed: boolean; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const passed = await new PreInstallImportCheck(root, entryPoints).runAsync(output);
  return { passed, text };
};

describe("PreInstallImportCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("checks set-version, which a release runs before npm ci, and the root install, which the build runs before it", () => {
    assert.deepEqual(PreInstallImportCheck.ENTRY_POINTS, ["scripts/set-version.ts", "scripts/installs/root-install.ts"]);
  });

  it("passes on this repository, whose pre-install scripts load only Node's own modules", async () => {
    const { passed, text } = await runIn(REPOSITORY, PreInstallImportCheck.ENTRY_POINTS);

    assert.deepEqual([passed, text], [true, "scripts/set-version.ts and scripts/installs/root-install.ts, which run before npm ci, and the 2 files they import load only Node's own modules.\n"]);
  });

  it("follows static, re-exported and dynamic imports of its own files, each once, through a cycle", async () => {
    const root = rootWith({
      "scripts/entry.ts": "import path from \"node:path\";\nimport { a } from \"./parts/a.ts\";\nexport { b } from \"./parts/b.ts\";\nconst c = await import(\"./parts/c.ts\");\n",
      "scripts/parts/a.ts": "import type { Writable } from \"node:stream\";\nimport { b } from \"./b.ts\";\n",
      "scripts/parts/b.ts": "import { a } from \"./a.ts\";\n",
      "scripts/parts/c.ts": "import \"node:fs\";\n"
    });

    const { passed, text } = await runIn(root);

    assert.deepEqual([passed, text], [true, "scripts/entry.ts, which run before npm ci, and the 3 files they import load only Node's own modules.\n"]);
  });

  const imports = new Map<string, string>([
    ["a side-effect import", "import \"@noldova/context.core\";"],
    ["a named import", "import { x } from \"some-package\";"],
    ["a dynamic import", "const x = await import(\"some-package\");"],
    ["a bare Node module", "import fs from \"fs\";"]
  ]);
  for (const [form, line] of imports) {
    it(`fails, naming the file and the module, on ${form} of anything but a node: module in a file the entry point imports`, async () => {
      const root = rootWith({
        "scripts/entry.ts": "import { a } from \"./parts/a.ts\";\n",
        "scripts/parts/a.ts": `${line}\n`
      });
      const specifier = /["']([^"']+)["']/.exec(line)?.[1];

      const { passed, text } = await runIn(root);

      assert.deepEqual([passed, text], [false, `scripts/parts/a.ts imports ${specifier}, but scripts/entry.ts runs before npm ci installs any package, so it and every file it imports load only Node's own modules, named with node:, and their own files.\n`]);
    });
  }

  it("names every package import of every entry point", async () => {
    const root = rootWith({
      "scripts/entry.ts": "import \"one\";\nimport \"two\";\n",
      "scripts/other.ts": "import \"three\";\n"
    });

    const { passed, text } = await runIn(root, ["scripts/entry.ts", "scripts/other.ts"]);

    assert.deepEqual([passed, text.split("\n").filter(t => t !== "").map(t => t.split(",")[0])], [false, ["scripts/entry.ts imports one", "scripts/entry.ts imports two", "scripts/other.ts imports three"]]);
  });

  it("fails, naming the file and its entry point, when a file it imports can't be read", async () => {
    const root = rootWith({ "scripts/entry.ts": "import { a } from \"./missing.ts\";\n" });

    const { passed, text } = await runIn(root);

    assert.equal(passed, false);
    assert.match(text, /^scripts\/missing\.ts, which scripts\/entry\.ts loads, can't be read: /);
  });
});
