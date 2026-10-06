/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import ApiDocumentationReader from "../../api/api-documentation.reader.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import ApiSessionFixture from "../fixtures/api-session.fixture.ts";

class ApiDocumentationReaderTests {
  private static readonly FILE: string = "work/index.d.ts";
  private static readonly DOCUMENTED: readonly string[] = [
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
    "   * @returns Nothing, since it throws when the value is no shape.",
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
    "/**",
    " * A size.",
    " */",
    "export type Size<T> = T | number;",
    ""
  ];

  public static register(): void {
    test("documented declarations have no problems, and private, foreign and type parameter symbols are skipped", async t => {
      const problems = await ApiDocumentationReaderTests.readAsync(t, ApiDocumentationReaderTests.DOCUMENTED, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, []);
    });

    test("a public and protected API also needs its protected members documented", async t => {
      const lines = ApiDocumentationReaderTests.DOCUMENTED;

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC_AND_PROTECTED);

      assert.deepEqual(problems, [`${ApiDocumentationReaderTests.locate(lines, "  protected unit: string;")}: Shape#unit has no JSDoc`]);
    });

    test("every kind of member without JSDoc is refused at its line, by a readable name", async t => {
      const lines = [
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
        "  public static create(): Shape;",
        "  public get size(): number;",
        "  public set size(value: number);",
        "}",
        ""
      ];
      const at = (line: string, name: string): string => `${ApiDocumentationReaderTests.locate(lines, line)}: ${name} has no JSDoc`;

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC);

      assert.deepEqual([...problems].sort(), [
        at("export declare function top(): void;", "top"),
        at("export declare const limit: number;", "limit"),
        at("export type Size<T> = T | number;", "Size"),
        at("export declare enum Kind {", "Kind"),
        at("  First = 0", "Kind.First"),
        at("export interface IContract<T> {", "IContract"),
        at("  (value: T): T;", "IContract call signature"),
        at("  new (value: T): IContract<T>;", "IContract construct signature"),
        at("  [key: string]: unknown;", "IContract index signature"),
        at("  run(item: T): void;", "IContract#run"),
        at("export declare namespace Tools {", "Tools"),
        at("  const meter: string;", "Tools.meter"),
        at("export declare class Shape {", "Shape"),
        at("  public static create(): Shape;", "Shape.create"),
        at("  public get size(): number;", "Shape#size")
      ].sort());
    });

    test("a @returns on a constructor, a type predicate without @returns, and a never or asserts result without @throws are refused", async t => {
      const lines = [
        "/**",
        " * Rules.",
        " */",
        "export declare class Rules {",
        "  /**",
        "   * Builds the rules.",
        "   *",
        "   * @returns The rules.",
        "   */",
        "  public constructor();",
        "  /**",
        "   * Tests a value.",
        "   *",
        "   * @param value The value.",
        "   */",
        "  public isRule(value: unknown): value is Rules;",
        "  /**",
        "   * Fails.",
        "   *",
        "   * @returns Nothing.",
        "   */",
        "  public fail(): never;",
        "  /**",
        "   * Checks a value.",
        "   *",
        "   * @param value The value.",
        "   */",
        "  public check(value: unknown): asserts value;",
        "}",
        ""
      ];
      const at = (line: string): string => ApiDocumentationReaderTests.locate(lines, line);

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, [
        `${at("  public constructor();")}: Rules.constructor has a @returns, but no result`,
        `${at("  public isRule(value: unknown): value is Rules;")}: Rules#isRule has no @returns`,
        `${at("  public fail(): never;")}: Rules#fail has no @throws, which its never or asserts result needs`,
        `${at("  public check(value: unknown): asserts value;")}: Rules#check has no @throws, which its never or asserts result needs`
      ]);
    });

    test("missing JSDoc, even under a license header, parameters and results, empty tags, single lines, hyphens and unresolved links are refused", async t => {
      const lines = [
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
      ];
      const at = (line: string): string => ApiDocumentationReaderTests.locate(lines, line);
      const grow = at("  public grow(step: number, rate: number): number;");

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, [
        `${at("export declare class Shape {")}: Shape has no JSDoc`,
        `${at("  public readonly bare: number;")}: Shape#bare has no JSDoc`,
        `${at("  /** One line. */")}: Shape#short has a single-line JSDoc`,
        `${at("  public constructor(side: number);")}: Shape.constructor has no JSDoc`,
        `${grow}: Shape#grow overload 1 has no @param for rate`,
        `${grow}: Shape#grow overload 1 has a @param for extra, which is not a parameter`,
        `${grow}: Shape#grow overload 1 has no @returns`,
        `${at("   * @param step - The step.")}: Shape#grow overload 1 has a hyphen after @param step`,
        `${at("   * @throws")}: Shape#grow overload 1 has an empty @throws`,
        `${at("  public grow(): void;")}: Shape#grow overload 2 has no JSDoc`,
        `${at("  public stop(): void;")}: Shape#stop has a @returns, but no result`,
        `${at("   * @returns")}: Shape#stop has an empty @returns`,
        `${at("   * Stops, see {@link Missing}.")}: Shape#stop has a link that does not resolve: {@link Missing}`
      ]);
    });

    test("a @throws type that resolves passes, and one that does not is refused at its line by name", async t => {
      const lines = [
        "/**",
        " * Shapes.",
        " */",
        "export declare class Shape {",
        "  /**",
        "   * Grows.",
        "   *",
        "   * @throws {RangeError} When it cannot grow.",
        "   * @throws {Shape} When it is itself in the way.",
        "   * @throws Missing when no type is given.",
        "   */",
        "  public grow(): void;",
        "  /**",
        "   * Shrinks.",
        "   *",
        "   * @throws {Missing} When it cannot shrink.",
        "   * @throws {RangeError | Absent} When it is too small.",
        "   */",
        "  public shrink(): void;",
        "}",
        ""
      ];

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, [
        `${ApiDocumentationReaderTests.locate(lines, "   * @throws {Missing} When it cannot shrink.")}: Shape#shrink has a @throws type that does not resolve: Missing`,
        `${ApiDocumentationReaderTests.locate(lines, "   * @throws {RangeError | Absent} When it is too small.")}: Shape#shrink has a @throws type that does not resolve: Absent`
      ]);
    });

    test("a JSDoc without text or tags is refused as empty", async t => {
      const lines = [
        "/**",
        " * Shapes.",
        " */",
        "export declare class Shape {",
        "  /**",
        "   */",
        "  public readonly blank: number;",
        "}",
        ""
      ];

      const problems = await ApiDocumentationReaderTests.readAsync(t, lines, ApiVisibility.PUBLIC);

      assert.deepEqual(problems, [`${ApiDocumentationReaderTests.locate(lines, "  /**")}: Shape#blank has an empty JSDoc`]);
    });

    test("problems are reported at the source the declarations were copied from, relative to the root", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const files = { "index.d.ts": "export declare const bare: number;\n" };
      const source = path.join(fixture.directory, "src", "foundation", "shapes", "src", "api", "index.d.ts");

      const problems = await ApiSessionFixture.useAsync(fixture, files, (project, locate) => new ApiDocumentationReader(project, ApiVisibility.PUBLIC, fixture.directory).readAsync(locate("index.d.ts"), source));

      assert.deepEqual(problems, ["src/foundation/shapes/src/api/index.d.ts:1: bare has no JSDoc"]);
    });

    test("a file outside the project is refused", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const files = { "index.d.ts": ApiDocumentationReaderTests.DOCUMENTED.join("\n"), "other.d.ts": "export {};\n" };

      await ApiSessionFixture.useAsync(fixture, files, async (project, locate) => {
        await assert.rejects(new ApiDocumentationReader(project, ApiVisibility.PUBLIC, fixture.directory).readAsync(locate("missing.d.ts"), locate("missing.d.ts")),
          new ApiException(`${locate("missing.d.ts")} is not an ES module of the project.`));
      });
    });
  }

  private static locate(lines: readonly string[], line: string): string {
    const index = lines.indexOf(line);
    assert.ok(index >= 0 && lines.indexOf(line, index + 1) < 0, `"${line}" is not exactly one line of the declarations.`);
    return `${ApiDocumentationReaderTests.FILE}:${index + 1}`;
  }

  private static async readAsync(t: { after: (callback: () => Promise<void>) => void }, lines: readonly string[], visibility: ApiVisibility): Promise<readonly string[]> {
    const fixture = await ApiPackageFixture.createAsync();
    t.after(() => fixture.disposeAsync());
    const files = { "other.d.ts": "export declare function shared(): void;\n", "index.d.ts": lines.join("\n") };
    return await ApiSessionFixture.useAsync(fixture, files, (project, locate) => new ApiDocumentationReader(project, visibility, fixture.directory).readAsync(locate("index.d.ts"), locate("index.d.ts")));
  }
}

ApiDocumentationReaderTests.register();
