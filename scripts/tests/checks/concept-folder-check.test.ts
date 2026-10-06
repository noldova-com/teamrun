/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import ConceptFolderCheck from "../../checks/concept-folder-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ConceptFolderCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RUNTIME: string = "src/shell/runtime/src";
  private static readonly RULE: string = "; CODING-STANDARDS.md sections 5 and 10 put each concept in its category folder, which holds only its kind, and name folders in lowercase kebab-case.";

  public static register(): void {
    test("concepts in their category folders, Angular components and directives, and domain folders in scripts pass, outside test folders and declarations", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runtime = ConceptFolderCheckTests.RUNTIME;
      await repository.writeAsync({
        [`${runtime}/interfaces/i-event-sink.ts`]: "export default interface IEventSink {}\n",
        [`${runtime}/interfaces/process/i-process-ender.ts`]: "export default interface IProcessEnder {}\n",
        [`${runtime}/enums/window-state-kind.ts`]: "export enum WindowStateKind { Bounds = \"Bounds\" }\n",
        [`${runtime}/exceptions/runtime.exception.ts`]: "export class RuntimeException extends Error {}\n",
        [`${runtime}/types/method-name.ts`]: "export type MethodName = string;\n",
        [`${runtime}/services/data-directory/data-directory.ts`]: "export class DataDirectory {}\n",
        [`${runtime}/resources.ts`]: "export class Resources {}\n",
        [`${runtime}/main.ts`]: "const value = 1;\nexport default value;\n",
        [`${runtime}/api/index.d.ts`]: "export declare interface IOutside {}\n",
        "src/foundation/exceptions/src/models/exception-options.ts": "export class ExceptionOptions {}\n",
        "src/shell/ui/src/app/components/menu/menu.component.ts": "export class MenuComponent {}\n",
        "src/shell/ui/src/app/interfaces/i-gallery-scope.ts": "export interface IGalleryScope {}\n",
        "src/shell/ui/src/api/gallery.ts": "export const gallery = 1;\n",
        "src/shell/window/src/app/directives/menu.directive.ts": "export class MenuDirective {}\n",
        "src/vitest.config.mts": "export default {};\n",
        "scripts/checks/interfaces/i-check.ts": "export default interface ICheck {}\n",
        "scripts/repository/github.exception.ts": "export default class GitHubException extends Error {}\n",
        "scripts/workflows/test-kind.ts": "export enum TestKind { Unit = \"Unit\" }\n",
        "scripts/test.ts": "export default class Test {}\n",
        "src/shell/runtime/tests/Helpers/i-sink.ts": "export interface ISink {}\n"
      });
      const output = new TextOutputFixture();

      const check = ConceptFolderCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the folders of 18 production scripts.\n");
      assert.equal(check.title, "Concept folders");
    });

    test("folders that are not kebab-case or not a concept category, concepts outside their folders and category folders holding other kinds fail with where they are", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runtime = ConceptFolderCheckTests.RUNTIME;
      await repository.writeAsync({
        "scripts/Tools/run.ts": "export class Run {}\n",
        "scripts/checks/check-source.ts": "export interface ICheckSource {}\n",
        "scripts/checks/interfaces/check-kind.ts": "export enum CheckKind { One = \"One\" }\n",
        [`${runtime}/components/clock.ts`]: "export class Clock {}\n",
        [`${runtime}/enums/empty.ts`]: "export const value = 1;\n",
        [`${runtime}/helpers/clock.ts`]: "export class Clock {}\n",
        [`${runtime}/helpers/other.ts`]: "export class Other {}\n",
        [`${runtime}/interfaces/mixed.ts`]: "export interface IOne {}\nexport class Two {}\nexport default class {}\nexport enum Three { One = \"One\" }\n",
        [`${runtime}/models/failure.exception.ts`]: "export class FailureException extends Error {}\n",
        [`${runtime}/models/i-sink.ts`]: "export interface ISink {}\n",
        [`${runtime}/models/kind.ts`]: "export enum Kind { One = \"One\" }\n",
        [`${runtime}/models/name.ts`]: "export type Name = string;\n",
        "src/shell/ui/src/app/themes/default-theme.ts": "export class DefaultTheme {}\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await ConceptFolderCheckTests.createCheck(repository).runAsync(output), false);
      const rule = ConceptFolderCheckTests.RULE;
      const category = "is not a concept category of its source tree";
      assert.equal(output.text, [
        `scripts/Tools: is not lowercase kebab-case${rule}`,
        `${runtime}/components: ${category}${rule}`,
        `${runtime}/helpers: ${category}${rule}`,
        `src/shell/ui/src/app/themes: ${category}${rule}`,
        `scripts/checks/check-source.ts:1: ICheckSource is an interface outside interfaces/${rule}`,
        `scripts/checks/interfaces/check-kind.ts:1: CheckKind is in interfaces/ but is not an interface${rule}`,
        `${runtime}/enums/empty.ts: is in enums/ but declares no concept${rule}`,
        `${runtime}/interfaces/mixed.ts:2: Two is in interfaces/ but is not an interface${rule}`,
        `${runtime}/interfaces/mixed.ts:3: (anonymous) is in interfaces/ but is not an interface${rule}`,
        `${runtime}/interfaces/mixed.ts:4: Three is an enum outside enums/${rule}`,
        `${runtime}/models/failure.exception.ts:1: FailureException is an exception class outside exceptions/${rule}`,
        `${runtime}/models/i-sink.ts:1: ISink is an interface outside interfaces/${rule}`,
        `${runtime}/models/kind.ts:1: Kind is an enum outside enums/${rule}`,
        `${runtime}/models/name.ts:1: Name is a type alias outside types/${rule}`,
        "Checked the folders of 13 production scripts.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason after the folder findings, and any other error reaches the caller", async t => {
      const repository = await RepositoryFixture.createAsync();
      const files = { "scripts/Shapes/pair.ts": "export default class Pair {}\n" };
      t.after(() => repository.disposeAsync());
      await repository.writeAsync(files);
      const output = new TextOutputFixture();
      const listed = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], ConceptFolderCheckTests.TIMEOUT);

      assert.equal(await new ConceptFolderCheck(listed, stopping).runAsync(output), false);
      assert.match(output.text, /^scripts\/Shapes: is not lowercase kebab-case; .+\nThe TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the folders of 1 production scripts\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ ...files, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(ConceptFolderCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): ConceptFolderCheck {
    const directory = repository.directory;
    return new ConceptFolderCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], ConceptFolderCheckTests.TIMEOUT));
  }
}

ConceptFolderCheckTests.register();
