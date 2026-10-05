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

import ApiCatalog from "../../api/api-catalog.ts";
import ApiServer from "../../api/api-server.ts";
import ApiDeclarationCheck from "../../checks/api-declaration-check.ts";
import BuildLayout from "../../packages/build-layout.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ApiDeclarationCheckTests {
  private static readonly TIMEOUT: number = 60_000;
  private static readonly IMPLEMENTATION: Readonly<Record<string, string>> = {
    "models/shapes.ts": [
      "export abstract class Shape<TUnit extends string = string> {",
      "  private readonly id: number;",
      "  protected readonly unit: TUnit;",
      "  public label?: string;",
      "",
      "  public constructor(unit: TUnit, id: number = 0) {",
      "    this.id = id;",
      "    this.unit = unit;",
      "  }",
      "",
      "  public static describe(shape: Shape): string {",
      "    return `${shape.unit}${shape.id}`;",
      "  }",
      "",
      "  public measure(scale: number): number;",
      "  public measure(scale: number, round: boolean): number;",
      "  public measure(scale: number, round?: boolean): number {",
      "    return round === true ? Math.round(scale) : scale;",
      "  }",
      "",
      "  public abstract area(): number;",
      "}",
      "",
      "export function scale<TValue extends number>(value: TValue, factor = 1): number {",
      "  return value * factor;",
      "}",
      "",
      "export class Marker {",
      "  public get size(): number {",
      "    return 1;",
      "  }",
      "}",
      "",
      "export class Registry {",
      "  private readonly names: readonly string[];",
      "",
      "  private constructor(names: readonly string[]) {",
      "    this.names = names;",
      "  }",
      "",
      "  public static create(): Registry {",
      "    return new Registry([]);",
      "  }",
      "",
      "  public get count(): number {",
      "    return this.names.length;",
      "  }",
      "}",
      "",
      "export function isShape(value: unknown): value is Shape {",
      "  return value instanceof Shape;",
      "}",
      "",
      "export const unitNames: readonly string[] = [\"cm\"];",
      "",
      "export interface IMeasured {",
      "  readonly size: number;",
      "  weight?: number;",
      "  measure(scale: number): number;",
      "}",
      "",
      "export type Pair<T = number> = readonly [T, T];",
      "",
      "export enum Mode {",
      "  Fast = \"Fast\",",
      "  Slow = \"Slow\"",
      "}",
      ""
    ].join("\n"),
    "api/index.ts": "export { isShape, Marker, Mode, Registry, scale, Shape, unitNames } from \"../models/shapes.js\";\nexport type { IMeasured, Pair } from \"../models/shapes.js\";\n"
  };
  private static readonly DECLARATIONS: string = [
    "export declare abstract class Shape<TUnit extends string = string> {",
    "  protected readonly unit: TUnit;",
    "  public label?: string;",
    "  public constructor(unit: TUnit, id?: number);",
    "  public static describe(shape: Shape): string;",
    "  public measure(scale: number): number;",
    "  public measure(scale: number, round: boolean): number;",
    "  public abstract area(): number;",
    "}",
    "export declare function scale<TValue extends number>(value: TValue, factor?: number): number;",
    "export declare const unitNames: readonly string[];",
    "export declare class Marker {",
    "  public get size(): number;",
    "}",
    "export declare class Registry {",
    "  private constructor();",
    "  public static create(): Registry;",
    "  public get count(): number;",
    "}",
    "export declare function isShape(value: unknown): value is Shape;",
    "export interface IMeasured {",
    "  readonly size: number;",
    "  weight?: number;",
    "  measure(scale: number): number;",
    "}",
    "export type Pair<T = number> = readonly [T, T];",
    "export declare enum Mode {",
    "  Fast = \"Fast\",",
    "  Slow = \"Slow\"",
    "}",
    ""
  ].join("\n");

  public static register(): void {
    test("a tree without packages passes and says there is nothing to compare", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const output = new TextOutputFixture();
      const check = ApiDeclarationCheckTests.createCheck(fixture);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No packages under src/; there are no API declarations to compare.\n");
      assert.equal(check.title, "API declarations");
    });

    test("declarations that match the implementation pass", async t => {
      const output = await ApiDeclarationCheckTests.runAsync(t, ApiDeclarationCheckTests.DECLARATIONS, true);

      assert.equal(output, "src/foundation/shapes: matches its declarations\n");
    });

    const drifts: readonly (readonly [string, string, string, string])[] = [
      ["a missing export", "export declare const unitNames: readonly string[];\n", "", "unitNames: missing from the declarations; the implementation has variable : readonly string[]"],
      ["an extra export", "export interface IMeasured {", "export declare function extra(): void;\nexport interface IMeasured {",
        "extra: declared but not implemented; the declarations have function"],
      ["a constructor parameter type", "id?: number);", "id?: string);", "Shape.constructor(0): the implementation has abstract new (unit: TUnit, id?: number): Shape<TUnit>; the declarations have abstract new (unit: TUnit, id?: string): Shape<TUnit>"],
      ["a parameter type", "factor?: number): number;", "factor?: string): number;", "scale(0): the implementation has <TValue extends number>(value: TValue, factor?: number): number; the declarations have <TValue extends number>(value: TValue, factor?: string): number"],
      ["an optional property", "public label?: string;", "public label: string;", "Shape#label: the implementation has property optional : string | undefined; the declarations have property : string"],
      ["a generic constraint", "Shape<TUnit extends string = string>", "Shape<TUnit extends number = number>",
        "Shape: the implementation has class abstract <TUnit extends string = string>; the declarations have class abstract <TUnit extends number = number>"],
      ["a missing overload", "  public measure(scale: number, round: boolean): number;\n", "",
        "Shape#measure(1): missing from the declarations; the implementation has (scale: number, round: boolean): number"],
      ["a visibility", "protected readonly unit: TUnit;", "public readonly unit: TUnit;",
        "Shape#unit: the implementation has property protected readonly : TUnit; the declarations have property readonly : TUnit"],
      ["a return type", "public abstract area(): number;", "public abstract area(): string;", "Shape#area(0): the implementation has (): number; the declarations have (): string"],
      ["a readonly property", "  readonly size: number;", "  size: number;", "IMeasured#size: the implementation has property readonly : number; the declarations have property : number"],
      ["an enum value", "Slow = \"Slow\"", "Slow = \"slow\"", "Mode.Slow: the implementation has member = \"Slow\"; the declarations have member = \"slow\""],
      ["a type parameter default", "Pair<T = number>", "Pair<T = string>", "Pair: the implementation has type <T = number> = readonly [T, T]; the declarations have type <T = string> = readonly [T, T]"],
      ["a type predicate", "value is Shape;", "value is Marker;", "isShape(0): the implementation has (value: unknown): value is Shape; the declarations have (value: unknown): value is Marker"],
      ["a parameter name", "(value: TValue, factor?: number)", "(amount: TValue, factor?: number)", "scale(0): the implementation has <TValue extends number>(value: TValue"],
      ["an accessor", "public get size(): number;", "public readonly size: number;", "Marker#size: the implementation has get : number; the declarations have property readonly : number"],
      ["a private constructor", "  private constructor();\n", "", "Registry.constructor(0): the implementation has private new (); the declarations have new ()"],
      ["a protected constructor", "public constructor(unit: TUnit, id?: number);", "protected constructor(unit: TUnit, id?: number);",
        "Shape.constructor(0): the implementation has abstract new (unit: TUnit, id?: number): Shape<TUnit>; the declarations have protected abstract new"],
      ["a static method", "public static describe(shape: Shape): string;", "public describe(shape: Shape): string;", "Shape.describe: missing from the declarations"]
    ];
    for (const [kind, from, to, expected] of drifts)
      test(`declarations with ${kind} that drifted fail and name the difference`, async t => {
        assert.ok(ApiDeclarationCheckTests.DECLARATIONS.includes(from), kind);
        const output = await ApiDeclarationCheckTests.runAsync(t, ApiDeclarationCheckTests.DECLARATIONS.replace(from, to), false);

        assert.ok(output.startsWith("src/foundation/shapes:\n"), output);
        assert.ok(output.includes(expected), output);
      });

    test("declarations that do not compile fail with the compiler's errors", async t => {
      const output = await ApiDeclarationCheckTests.runAsync(t, `import type { Missing } from "@noldova/teamrun-foundation-missing";\n${ApiDeclarationCheckTests.DECLARATIONS}`, false);

      assert.ok(output.includes("  TS2307: Cannot find module '@noldova/teamrun-foundation-missing'"), output);
    });

    test("a package without installed declarations fails and asks for a build", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePackageAsync("shapes", ApiDeclarationCheckTests.IMPLEMENTATION, null);
      const output = new TextOutputFixture();

      assert.equal(await ApiDeclarationCheckTests.createCheck(fixture).runAsync(output), false);
      assert.ok(output.text.includes("; build the packages first\n"), output.text);
    });

    test("an Angular part's declarations in its source that match its implementation pass, and a drift fails", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePartAsync("src/shell/shapes", ApiDeclarationCheckTests.IMPLEMENTATION, ApiDeclarationCheckTests.DECLARATIONS);
      const output = new TextOutputFixture();

      assert.equal(await ApiDeclarationCheckTests.createCheck(fixture, ["src/shell/shapes"]).runAsync(output), true, output.text);
      assert.equal(output.text, "src/shell/shapes: matches its declarations\n");

      await fixture.writeFilesAsync({ "src/shell/shapes/src/api/index.d.ts": ApiDeclarationCheckTests.DECLARATIONS.replace("factor?: number): number;", "factor?: string): number;") });
      const drifted = new TextOutputFixture();

      assert.equal(await ApiDeclarationCheckTests.createCheck(fixture, ["src/shell/shapes"]).runAsync(drifted), false);
      assert.ok(drifted.text.startsWith("src/shell/shapes:\n  scale(0): the implementation has"), drifted.text);
    });

    test("an Angular part without declarations fails and names the missing file", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePartAsync("src/shell/shapes", ApiDeclarationCheckTests.IMPLEMENTATION, null);
      const output = new TextOutputFixture();

      assert.equal(await ApiDeclarationCheckTests.createCheck(fixture, ["src/shell/shapes"]).runAsync(output), false);
      assert.equal(output.text, `src/shell/shapes:\n  no declarations at ${path.join(fixture.directory, "src/shell/shapes/src/api/index.d.ts")}\n`);
    });

    test("a server that cannot start fails the package with the reason", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePackageAsync("shapes", ApiDeclarationCheckTests.IMPLEMENTATION, ApiDeclarationCheckTests.DECLARATIONS);
      const output = new TextOutputFixture();
      const check = new ApiDeclarationCheck(fixture.directory, ApiDeclarationCheckTests.createCatalog(fixture, []), [process.execPath, "-e", "process.exit(3)", "--"],
        ApiDeclarationCheckTests.TIMEOUT);

      assert.equal(await check.runAsync(output), false);
      assert.ok(output.text.includes("The TypeScript API server could not open"), output.text);
    });
  }

  private static createCatalog(fixture: ApiPackageFixture, parts: readonly string[]): ApiCatalog {
    return new ApiCatalog(fixture.directory, new PackageCatalog(fixture.directory), new BuildLayout(fixture.directory), parts);
  }

  private static createCheck(fixture: ApiPackageFixture, parts: readonly string[] = []): ApiDeclarationCheck {
    return new ApiDeclarationCheck(fixture.directory, ApiDeclarationCheckTests.createCatalog(fixture, parts), [ApiServer.locateCompiler()], ApiDeclarationCheckTests.TIMEOUT);
  }

  private static async runAsync(context: { after: (callback: () => Promise<void>) => void }, declarations: string, expected: boolean): Promise<string> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    await fixture.writePackageAsync("shapes", ApiDeclarationCheckTests.IMPLEMENTATION, declarations);
    const output = new TextOutputFixture();

    assert.equal(await ApiDeclarationCheckTests.createCheck(fixture).runAsync(output), expected, output.text);
    return output.text;
  }
}

ApiDeclarationCheckTests.register();
