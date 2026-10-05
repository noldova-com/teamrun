/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TypeStripException from "../../structure/type-strip.exception.ts";
import TypeStripper from "../../structure/type-stripper.ts";

class TypeStripperTests {
  public static register(): void {
    test("types are erased in place, so an interface's arrow is gone and a constructor stays", () => {
      const stripped = new TypeStripper().strip("src/a.ts", "export interface IClock {\n  tick: () => void;\n}\nexport class Clock {\n  public constructor(name: string) {\n  }\n}\n");

      assert.equal(stripped.includes("=>"), false);
      assert.equal(stripped.includes("constructor(name"), true);
      assert.equal(stripped.split("\n").length, 8);
    });

    test("an enum, which Node.js does not strip, is returned as it was written", () => {
      const text = "export enum Side {\n  Left = \"Left\",\n  Right = \"Right\"\n}\n";

      assert.equal(new TypeStripper().strip("src/side.ts", text), text);
    });

    test("other syntax Node.js does not strip, and invalid TypeScript, fail with the file and the cause", () => {
      const stripper = new TypeStripper();

      for (const text of ["export class Clock {\n  public constructor(private name: string) {\n  }\n}\n", "let x: = ;\n"])
        assert.throws(() => stripper.strip("src/clock.ts", text), (error: unknown) =>
          error instanceof TypeStripException && error.message === "src/clock.ts: module.stripTypeScriptTypes could not strip its types." && error.cause instanceof Error);
    });

    test("a failure without an error code, or that is not an error object, also fails", () => {
      for (const failure of [new Error("refused"), "refused"]) {
        const stripper = new TypeStripper({
          stripTypeScriptTypes: () => {
            throw failure;
          }
        });

        assert.throws(() => stripper.strip("src/a.ts", "const a = 1;\n"), (error: unknown) => error instanceof TypeStripException && error.cause === failure);
      }
    });

    test("a Node.js without the strip API fails instead of passing every file", () => {
      assert.throws(() => new TypeStripper({}).strip("src/a.ts", "const a = 1;\n"), {
        name: "TypeStripException",
        message: "src/a.ts: this Node.js has no module.stripTypeScriptTypes, so the test mirror check cannot tell which files have function bodies; TESTING.md section 5 names the API and what to do when Node.js changes it."
      });
    });
  }
}

TypeStripperTests.register();
