/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { SpecTransformCheck } from "../spec-transform-check.ts";

const folders: string[] = [];

const SPEC: string = "/work/src/noldova.teamrun.window/tests/app/models/conversation-title.spec.ts";

const SERVED: string = [
  "import { ConversationTitle } from \"./chunk-WIEBH67Q.js\";",
  "import \"./chunk-FT6WSDCH.js\";",
  "import \"./chunk-RSTWSNOR.js\";",
  "// noldova.teamrun.window/tests/app/models/conversation-title.spec.ts",
  "describe(\"ConversationTitle\", () => {",
  "  it(\"names a chat\", () => expect(ConversationTitle).toBeDefined());",
  "});",
  ""
].join("\n");

const checkIn = (folder: string): { check: SpecTransformCheck; lines: string[]; closeAsync: () => Promise<void> } => {
  const check = new SpecTransformCheck(folder);
  const lines: string[] = [];
  const listeners: (() => void | Promise<void>)[] = [];
  check.transformed.configureVitest?.({ vitest: { logger: { log: line => lines.push(line) }, onClose: listener => listeners.push(listener) } });
  return { check, lines, closeAsync: async () => { await Promise.all(listeners.map(t => t())); } };
};

const work = (): string => {
  const folder = mkdtempSync(path.join(tmpdir(), "spec-transform-"));
  folders.push(folder);
  return folder;
};

const digestOf = (code: string): { size: number; sha256: string } => ({ size: Buffer.byteLength(code), sha256: createHash("sha256").update(code).digest("hex") });

const transformAsync = async (check: SpecTransformCheck, id: string, served: string, transformed: string): Promise<null> => {
  check.served.transform(served, id);
  return check.transformed.transform(transformed, id);
};

describe("SpecTransformCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("records each spec file's served and transformed code's size and SHA-256 at the end of the run, when the transforms keep its imports", async () => {
    const folder = path.join(work(), "angular-spec-transforms");
    const { check, lines, closeAsync } = checkIn(folder);
    const transformed = SERVED.replace("import { ConversationTitle } from \"./chunk-WIEBH67Q.js\";", "import { ConversationTitle } from './chunk-WIEBH67Q.js';")
      .replace("import \"./chunk-FT6WSDCH.js\";\n", "");
    const other = "/work/src/noldova.teamrun.window/tests/app/models/file-share.spec.ts";

    const results = await Promise.all([transformAsync(check, `${SPEC}?import`, SERVED, transformed), transformAsync(check, other, "export {};\n", "export {};\n"),
      transformAsync(check, "/work/src/chunk-WIEBH67Q.js", "import \"./a.js\";\n", "import \"./b.js\";\n"), check.transformed.transform("import \"./c.js\";\n", SPEC)]);
    await closeAsync();

    assert.deepEqual(results, [null, null, null, null]);
    assert.deepEqual(JSON.parse(readFileSync(path.join(folder, "record.json"), "utf8")), [
      { file: SPEC, served: digestOf(SERVED), transformed: digestOf(transformed) },
      { file: other, served: digestOf("export {};\n"), transformed: digestOf("export {};\n") }
    ].sort((a, b) => a.file.localeCompare(b.file)));
    assert.deepEqual(lines, ["The spec transform check compared the imports of 2 spec files before and after Vite's transforms."]);
  });

  it("fails a spec file whose transformed code imports a module its served code doesn't, naming both codes' SHA-256 and keeping both", async () => {
    const folder = path.join(work(), "angular-spec-transforms");
    const { check } = checkIn(folder);
    const transformed = SERVED.replace("./chunk-RSTWSNOR.js", "./chunk\u0001RSTWSNOR.js");

    await assert.rejects(transformAsync(check, SPEC, SERVED, transformed), new Error(`Vite's transforms changed the imports of ${SPEC}: after them it imports `
      + `"./chunk\\u0001RSTWSNOR.js", which the code Angular's builder served doesn't. The served code's SHA-256 is ${digestOf(SERVED).sha256} (${digestOf(SERVED).size} bytes), `
      + `and the transformed code's is ${digestOf(transformed).sha256} (${digestOf(transformed).size} bytes); both are in ${folder}.`));
    assert.deepEqual([readFileSync(path.join(folder, "conversation-title.spec.ts.served.js"), "utf8"),
      readFileSync(path.join(folder, "conversation-title.spec.ts.transformed.js"), "utf8")], [SERVED, transformed]);
  });

  it("still fails such a spec file, saying why, when it can't keep its two codes, and says why when it can't keep its record", async () => {
    const blocked = path.join(work(), "angular-spec-transforms");
    writeFileSync(blocked, "a file where the folder goes\n");
    const { check, lines, closeAsync } = checkIn(blocked);
    const transformed = SERVED.replace("./chunk-RSTWSNOR.js", "./chunk\u0001RSTWSNOR.js");

    await assert.rejects(transformAsync(check, SPEC, SERVED, transformed), (error: unknown) => error instanceof Error
      && error.message.endsWith(`and the transformed code's is ${digestOf(transformed).sha256} (${digestOf(transformed).size} bytes).`));
    await closeAsync();

    assert.equal(existsSync(path.join(blocked, "record.json")), false);
    assert.equal(lines.length, 3);
    assert.ok(lines[0]?.startsWith(`The spec transform check couldn't keep the two codes of ${SPEC} in ${blocked}: `), String(lines[0]));
    assert.ok(lines[1]?.startsWith(`The spec transform check couldn't keep its record in ${blocked}: `), String(lines[1]));
    assert.equal(lines[2], "The spec transform check compared the imports of 1 spec files before and after Vite's transforms.");
  });
});
