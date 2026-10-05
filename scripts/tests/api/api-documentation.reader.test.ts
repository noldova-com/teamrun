/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiDocumentationReader from "../../api/api-documentation.reader.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import ApiSessionFixture from "../fixtures/api-session.fixture.ts";

class ApiDocumentationReaderTests {
  private static readonly DOCUMENTED: string = [
    "export { shared } from \"./other.js\";",
    "/**",
    " * A shape, measured by {@link Shape#area} and built by {@linkcode Shape.create}.",
    " */",
    "export declare class Shape {",
    "  private hidden: number;",
    "  protected unit: string;",
    "  /**",
    "   * The area.",
    "   */",
    "  public readonly area: number;",
    "  /**",
    "   * Builds a shape.",
    "   *",
    "   * @param side The side.",
    "   */",
    "  public constructor(side: number);",
    "  /**",
    "   * The size.",
    "   */",
    "  public get size(): number;",
    "  public set size(value: number);",
    "  /**",
    "   * Creates a shape.",
    "   *",
    "   * @param side The side.",
    "   * @returns The shape.",
    "   */",
    "  public static create(side: number): Shape;",
    "  /**",
    "   * Grows by one.",
    "   */",
    "  public grow(): void;",
    "  /**",
    "   * Grows by a step.",
    "   *",
    "   * @param step The step.",
    "   * @returns When the shape has grown.",
    "   */",
    "  public grow(this: Shape, step: number): Promise<void>;",
    "  /**",
    "   * @throws RangeError always.",
    "   */",
    "  public fail(): never;",
    "  /**",
    "   * Checks a value.",
    "   *",
    "   * @param value The value.",
    "   * @throws RangeError when it is no shape.",
    "   */",
    "  public check(value: unknown): asserts value is Shape;",
    "  /**",
    "   * Tests a value.",
    "   *",
    "   * @param value The value.",
    "   * @returns Whether it is a shape.",
    "   */",
    "  public isShape(value: unknown): value is Shape;",
    "}",
    "/**",
    " * Kinds.",
    " */",
    "export declare enum Kind {",
    "  /**",
    "   * The first kind.",
    "   */",
    "  First = 0",
    "}",
    "/**",
    " * A contract.",
    " */",
    "export interface IContract<T> {",
    "  /**",
    "   * Calls.",
    "   *",
    "   * @param value The value.",
    "   * @returns The result.",
    "   */",
    "  (value: T): T;",
    "  /**",
    "   * Runs.",
    "   *",
    "   * @param item The item.",
    "   */",
    "  run(item: T): void;",
    "}",
    "/**",
    " * Tools.",
    " */",
    "export declare namespace Tools {",
    "  /**",
    "   * A meter.",
    "   */",
    "  const meter: string;",
    "}",
    ""
  ].join("\n");

  public static register(): void {
    test("documented declarations have no problems, and private, foreign and type parameter symbols are skipped", async t => {
      const problems = await ApiDocumentationReaderTests.readAsync(t, ApiDocumentationReaderTests.DOCUMENTED, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, []);
    });

    test("a public and protected API also needs its protected members documented", async t => {
      const problems = await ApiDocumentationReaderTests.readAsync(t, ApiDocumentationReaderTests.DOCUMENTED, ApiVisibility.PUBLIC_AND_PROTECTED);

      assert.deepEqual(problems, ["Shape#unit has no JSDoc"]);
    });

    test("missing JSDoc, even under a license header, parameters and results, empty tags, single lines, hyphens and unresolved links are refused", async t => {
      const declarations = [
        "/**",
        " * @license",
        " * Copyright.",
        " */",
        "export declare class Shape {",
        "  public readonly bare: number;",
        "  /** One line. */",
        "  public readonly short: number;",
        "  public constructor(side: number);",
        "  /**",
        "   * Grows.",
        "   *",
        "   * @param step - The step.",
        "   * @param extra The extra.",
        "   * @throws",
        "   */",
        "  public grow(step: number, rate: number): number;",
        "  public grow(): void;",
        "  /**",
        "   * Stops, see {@link Missing}.",
        "   *",
        "   * @returns",
        "   */",
        "  public stop(): void;",
        "}",
        ""
      ].join("\n");

      const problems = await ApiDocumentationReaderTests.readAsync(t, declarations, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, [
        "Shape has no JSDoc",
        "Shape#bare has no JSDoc",
        "Shape#short has a single-line JSDoc",
        "Shape.constructor has no JSDoc",
        "Shape#grow overload 1 has no @param for rate",
        "Shape#grow overload 1 has a @param for extra, which is not a parameter",
        "Shape#grow overload 1 has no @returns",
        "Shape#grow overload 1 has a hyphen after @param step",
        "Shape#grow overload 1 has an empty @throws",
        "Shape#grow overload 2 has no JSDoc",
        "Shape#stop has a @returns, but no result",
        "Shape#stop has an empty @returns",
        "Shape#stop has a link that does not resolve: {@link Missing}"
      ]);
    });

    test("a file outside the project is refused", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());

      await ApiSessionFixture.useAsync(fixture, { "index.d.ts": ApiDocumentationReaderTests.DOCUMENTED, "other.d.ts": "export {};\n" }, async (project, locate) => {
        await assert.rejects(new ApiDocumentationReader(project, ApiVisibility.PUBLIC).readAsync(locate("missing.d.ts")),
          new ApiException(`${locate("missing.d.ts")} is not an ES module of the project.`));
      });
    });
  }

  private static async readAsync(t: { after: (callback: () => Promise<void>) => void }, declarations: string, visibility: ApiVisibility): Promise<readonly string[]> {
    const fixture = await ApiPackageFixture.createAsync();
    t.after(() => fixture.disposeAsync());
    const files = { "other.d.ts": "export declare function shared(): void;\n", "index.d.ts": declarations };
    return await ApiSessionFixture.useAsync(fixture, files, (project, locate) => new ApiDocumentationReader(project, visibility).readAsync(locate("index.d.ts")));
  }
}

ApiDocumentationReaderTests.register();
