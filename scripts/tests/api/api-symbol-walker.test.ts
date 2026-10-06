/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ApiSymbolWalker from "../../api/api-symbol-walker.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import ApiSessionFixture from "../fixtures/api-session.fixture.ts";

class ApiSymbolWalkerTests {
  private static readonly DECLARATIONS: string = [
    "export { shared } from \"./other.js\";",
    "export declare function top(): void;",
    "export declare const limit: number;",
    "export type Size<T> = T | number;",
    "export declare enum Kind {",
    "  First = 0",
    "}",
    "export interface IContract<T> {",
    "  (value: T): T;",
    "  new (value: T): IContract<T>;",
    "  [key: string]: unknown;",
    "  run(item: T): void;",
    "}",
    "export declare namespace Tools {",
    "  const meter: string;",
    "}",
    "export declare class Shape {",
    "  private hidden: number;",
    "  protected unit: string;",
    "  public constructor(side: number);",
    "  public static create(side: number): Shape;",
    "  public get size(): number;",
    "  public set size(value: number);",
    "}",
    ""
  ].join("\n");

  public static register(): void {
    test("a public walk visits every export, type alias included, and member under a readable path, once each, and skips private, protected, foreign and type parameter symbols", async t => {
      const visited = await ApiSymbolWalkerTests.walkAsync(t, ApiVisibility.PUBLIC);

      assert.deepEqual(visited, [
        "IContract",
        "IContract call signature",
        "IContract construct signature",
        "IContract index signature",
        "IContract#run",
        "Kind",
        "Kind.First",
        "Shape",
        "Shape#size: 2 declarations",
        "Shape.constructor",
        "Shape.create",
        "Size",
        "Tools",
        "Tools.meter",
        "limit",
        "top"
      ]);
    });

    test("a public and protected walk also visits protected members", async t => {
      const visited = await ApiSymbolWalkerTests.walkAsync(t, ApiVisibility.PUBLIC_AND_PROTECTED);

      assert.deepEqual(visited.filter(t => t.startsWith("Shape#")), ["Shape#size: 2 declarations", "Shape#unit"]);
    });

    test("a file outside the project is refused", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());

      await ApiSessionFixture.useAsync(fixture, { "index.d.ts": "export {};\n" }, async (project, locate) => {
        await assert.rejects(new ApiSymbolWalker(project, ApiVisibility.PUBLIC).walkAsync(locate("missing.d.ts"), async () => undefined),
          new ApiException(`${locate("missing.d.ts")} is not an ES module of the project.`));
      });
    });
  }

  private static async walkAsync(context: TestContext, visibility: ApiVisibility): Promise<readonly string[]> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    const files = { "other.d.ts": "export declare function shared(): void;\n", "index.d.ts": ApiSymbolWalkerTests.DECLARATIONS };
    return await ApiSessionFixture.useAsync(fixture, files, async (project, locate) => {
      const visited: string[] = [];
      await new ApiSymbolWalker(project, visibility).walkAsync(locate("index.d.ts"), async (path, _symbol, declarations) => {
        visited.push(declarations.length === 1 ? path : `${path}: ${declarations.length} declarations`);
      });
      return visited.sort();
    });
  }
}

ApiSymbolWalkerTests.register();
