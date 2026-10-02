/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiExampleReader from "../../api/api-example.reader.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import ApiSessionFixture from "../fixtures/api-session.fixture.ts";

class ApiExampleReaderTests {
  private static readonly EXAMPLE: string = "/**\n * Reads.\n *\n * @example\n * ```ts\n * read();\n * ```\n */\n";

  public static register(): void {
    test("examples are read from the file's own callables, including namespaces and interfaces, and private members are skipped", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const files = {
        "other.d.ts": "export declare function shared(): void;\n",
        "index.d.ts": [
          "export { shared } from \"./other.js\";",
          `${ApiExampleReaderTests.EXAMPLE}export declare function read(): void;`,
          "export declare namespace Tools {",
          `  ${ApiExampleReaderTests.EXAMPLE}  function run(): void;`,
          "}",
          "export interface IReader {",
          "  next(): void;",
          "}",
          "export declare class Reader {",
          "  private hidden(): void;",
          "  public constructor();",
          "}",
          ""
        ].join("\n")
      };

      const found = await ApiSessionFixture.useAsync(fixture, files, (project, locate) => new ApiExampleReader(project).readAsync(locate("index.d.ts")));

      assert.deepEqual(found.examples.map(t => [t.title, t.code]), [["read example 1", "read();\n"], ["Tools.run example 1", "read();\n"]]);
      assert.deepEqual(found.undocumented, ["IReader#next", "Reader.constructor"]);
    });

    test("a file outside the project is refused and a file without exports has no examples", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());

      await ApiSessionFixture.useAsync(fixture, { "script.ts": "const value: number = 1;\nvalue.toFixed();\n" }, async (project, locate) => {
        const reader = new ApiExampleReader(project);

        await assert.rejects(reader.readAsync(locate("other.ts")), new ApiException(`${locate("other.ts")} is not an ES module of the project.`));
        assert.deepEqual((await reader.readAsync(locate("script.ts"))).examples, []);
      });
    });
  }
}

ApiExampleReaderTests.register();
