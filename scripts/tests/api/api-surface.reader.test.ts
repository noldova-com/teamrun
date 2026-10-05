/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiSurface from "../../api/api-surface.ts";
import ApiSurfaceReader from "../../api/api-surface.reader.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import ApiSessionFixture from "../fixtures/api-session.fixture.ts";

class ApiSurfaceReaderTests {
  public static register(): void {
    test("an API is read export by export, with members, signatures, bases, rest parameters and namespaces", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const declarations = [
        "export declare class Base {",
        "  public constructor(...names: readonly string[]);",
        "}",
        "export declare class Derived extends Base {",
        "  private secret;",
        "}",
        "export declare namespace Units {",
        "  const meter: string;",
        "}",
        ""
      ].join("\n");

      const surface = await ApiSessionFixture.useAsync(fixture, { "index.d.ts": declarations }, (project, locate) =>
        new ApiSurfaceReader(project, ApiVisibility.PUBLIC_AND_PROTECTED).readAsync(locate("index.d.ts")));

      assert.deepEqual(surface.compare(new ApiSurface(new Map())), [
        "Base.constructor(0): missing from the declarations; the implementation has new (...names: readonly string[]): Base",
        "Base: missing from the declarations; the implementation has class",
        "Derived.constructor(0): missing from the declarations; the implementation has new (...names: readonly string[]): Derived",
        "Derived: missing from the declarations; the implementation has class extends Base",
        "Units.meter: missing from the declarations; the implementation has variable : string",
        "Units: missing from the declarations; the implementation has namespace"
      ]);
    });

    test("a public reading leaves out protected members, which a public and protected reading keeps", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const declarations = [
        "export declare class Chip {",
        "  public readonly label: string;",
        "  protected readonly isActive: boolean;",
        "  protected toggle(): void;",
        "}",
        ""
      ].join("\n");

      const [publicOnly, all] = await ApiSessionFixture.useAsync(fixture, { "index.d.ts": declarations }, (project, locate) => Promise.all([
        new ApiSurfaceReader(project, ApiVisibility.PUBLIC).readAsync(locate("index.d.ts")),
        new ApiSurfaceReader(project, ApiVisibility.PUBLIC_AND_PROTECTED).readAsync(locate("index.d.ts"))
      ]));

      assert.deepEqual(publicOnly.compare(new ApiSurface(new Map())), [
        "Chip#label: missing from the declarations; the implementation has property readonly : string",
        "Chip.constructor(0): missing from the declarations; the implementation has new ()",
        "Chip: missing from the declarations; the implementation has class"
      ]);
      assert.deepEqual(all.compare(publicOnly), [
        "Chip#isActive: missing from the declarations; the implementation has property protected readonly : boolean",
        "Chip#toggle(0): missing from the declarations; the implementation has protected (): void",
        "Chip#toggle: missing from the declarations; the implementation has method protected"
      ]);
    });

    test("a file outside the project or without exports is refused", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());

      await ApiSessionFixture.useAsync(fixture, { "script.ts": "const value: number = 1;\nvalue.toFixed();\n" }, async (project, locate) => {
        const reader = new ApiSurfaceReader(project, ApiVisibility.PUBLIC_AND_PROTECTED);

        await assert.rejects(reader.readAsync(locate("other.ts")), new ApiException(`${locate("other.ts")} is not an ES module of the project.`));
      });
    });
  }
}

ApiSurfaceReaderTests.register();
