/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import ApiException from "../../api/api.exception.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class SyntaxTreeReaderTests {
  private static readonly TIMEOUT: number = 120_000;

  public static register(): void {
    test("each file's syntax tree is read in the given order from a project that only parses the files", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/one.ts": "import missing from \"./missing.ts\";\nexport default missing;\n",
        "src/two.mjs": "export const a = 1;\nexport const b = 2;\n"
      });
      const reader = new SyntaxTreeReader(repository.directory, [ApiServer.locateCompiler()], SyntaxTreeReaderTests.TIMEOUT);

      const results = await reader.readAsync("fixture", ["scripts/one.ts", "src/two.mjs"], (t, u) => [`${t}: ${u.statements.length}`]);

      assert.deepEqual(results, ["scripts/one.ts: 2", "src/two.mjs: 2"]);
      const project = JSON.parse(await readFile(path.join(repository.directory, "_build", "syntax-trees", "fixture", "tsconfig.json"), "utf8"));
      assert.deepEqual(project, {
        compilerOptions: { noEmit: true, allowJs: true, noResolve: true, noLib: true, types: [], rootDir: repository.directory },
        files: [path.join(repository.directory, "scripts/one.ts"), path.join(repository.directory, "src/two.mjs")]
      });
    });

    test("no files start no server, and a file without a syntax tree fails with its name", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "scripts/one.ts": "export {};\n" });
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], SyntaxTreeReaderTests.TIMEOUT);
      const reader = new SyntaxTreeReader(repository.directory, [ApiServer.locateCompiler()], SyntaxTreeReaderTests.TIMEOUT);

      assert.deepEqual(await stopping.readAsync("fixture", [], () => ["read"]), []);
      await assert.rejects(reader.readAsync("fixture", ["scripts/one.ts", "scripts/missing.ts"], () => []),
        new ApiException("The TypeScript API has no syntax tree for scripts/missing.ts."));
    });
  }
}

SyntaxTreeReaderTests.register();
