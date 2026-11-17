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

import { PackageException } from "../../packages/package.exception.ts";
import { ProcessResult } from "../../processes/process-result.ts";
import { CopyListCheck } from "../copy-list-check.ts";

const folders: string[] = [];

const LICENSE = "license\n";
const README = "readme\n";
const NAME = "@noldova-com/sample";

const repository = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "copy-list-"));
  folders.push(root);
  writeFileSync(path.join(root, "LICENSE"), LICENSE);
  mkdirSync(path.join(root, "src", "Sample"), { recursive: true });
  writeFileSync(path.join(root, "src", "Sample", "README.md"), README);
  return root;
};

const packed = (files: Readonly<Record<string, string>> = { "package/LICENSE": LICENSE, "package/README.md": README }): ReadonlyMap<string, ReadonlyMap<string, Buffer>> =>
  new Map([[NAME, new Map(Object.entries(files).map(([entry, text]) => [entry, Buffer.from(text)]))]]);

const runWith = async (root: string, result: ProcessResult, archives: () => Promise<ReadonlyMap<string, ReadonlyMap<string, Buffer>>> = async () => await Promise.resolve(packed())): Promise<{ passed: boolean; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const passed = await new CopyListCheck(root, async () => await Promise.resolve(result), archives).runAsync(output);
  return { passed, text };
};

const listed = (...lines: readonly string[]): ProcessResult => new ProcessResult(0, [...lines, "end of copies", ""].join("\n"), "");

describe("CopyListCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("passes copies whose sources are in the repository and in their packages' archives byte for byte", async () => {
    const { passed, text } = await runWith(repository(), listed(`LICENSE\t${NAME}\tLICENSE`, `src/Sample/README.md\t${NAME}\tREADME.md`));

    assert.equal(passed, true);
    assert.match(text, /Copies listed and found in their packages' archives: 2\./);
  });

  it("fails a list that holds only its end", async () => {
    const { passed, text } = await runWith(repository(), listed());

    assert.equal(passed, false);
    assert.match(text, /listed no copies/);
  });

  it("fails when the command fails", async () => {
    const { passed, text } = await runWith(repository(), new ProcessResult(2, "", "Usage: npm run build [-- --list-copies]\n"));

    assert.equal(passed, false);
    assert.match(text, /exited with 2:\nUsage/);
  });

  it("fails when the last line isn't the end of the list", async () => {
    const { passed, text } = await runWith(repository(), new ProcessResult(0, `LICENSE\t${NAME}\tLICENSE\n`, ""));

    assert.equal(passed, false);
    assert.match(text, /didn't end with the line "end of copies"/);
  });

  it("fails a line without three fields", async () => {
    const { passed, text } = await runWith(repository(), listed(`LICENSE\t${NAME}`));

    assert.equal(passed, false);
    assert.match(text, /isn't a source, a package name and a path in the package/);
  });

  it("fails a line with an empty field", async () => {
    const { passed, text } = await runWith(repository(), listed("LICENSE\t\tLICENSE"));

    assert.equal(passed, false);
    assert.match(text, /isn't a source, a package name and a path in the package/);
  });

  it("fails a path with backslashes, an absolute path and a path that climbs", async () => {
    const { passed, text } = await runWith(repository(), listed(
      `src\\Sample\\README.md\t${NAME}\tREADME.md`,
      `/LICENSE\t${NAME}\tLICENSE`,
      `LICENSE\t${NAME}\t../LICENSE`));

    assert.equal(passed, false);
    assert.equal(text.match(/which isn't a relative path with \/ between folders/g)?.length, 3);
  });

  it("fails a source that isn't in the repository", async () => {
    const { passed, text } = await runWith(repository(), listed(`NOTICE\t${NAME}\tNOTICE`));

    assert.equal(passed, false);
    assert.match(text, /names NOTICE, which isn't in the repository/);
  });

  it("fails a package that isn't one under src/", async () => {
    const { passed, text } = await runWith(repository(), listed("LICENSE\t@noldova-com/other\tLICENSE"));

    assert.equal(passed, false);
    assert.match(text, /names @noldova-com\/other, which isn't a package under src\//);
  });

  it("fails a copy its package's archive lacks", async () => {
    const { passed, text } = await runWith(repository(), listed(`LICENSE\t${NAME}\tLICENSE`), async () => await Promise.resolve(packed({ "package/README.md": README })));

    assert.equal(passed, false);
    assert.match(text, /@noldova-com\/sample's archive lacks LICENSE, the copy of LICENSE\./);
  });

  it("fails a copy whose archived bytes differ from its source by one byte", async () => {
    const { passed, text } = await runWith(repository(), listed(`LICENSE\t${NAME}\tLICENSE`), async () => await Promise.resolve(packed({ "package/LICENSE": "licensf\n" })));

    assert.equal(passed, false);
    assert.match(text, /@noldova-com\/sample's archive holds a LICENSE that differs from LICENSE\./);
  });

  it("fails with the reader's reason when an archive can't be read", async () => {
    const { passed, text } = await runWith(repository(), listed(`LICENSE\t${NAME}\tLICENSE`), async () => await Promise.reject(new PackageException("sample-0.0.1.tgz could not be read as a gzipped archive.")));

    assert.equal(passed, false);
    assert.match(text, /could not be read as a gzipped archive/);
  });
});
