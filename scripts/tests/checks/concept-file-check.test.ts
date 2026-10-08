/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import ConceptFileCheck from "../../checks/concept-file-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ConceptFileCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RUNTIME: string = "src/shell/runtime/src";
  private static readonly MANIFEST: string = "{ \"scripts\": { \"build\": \"node scripts/build.ts --all\", \"count\": 3 } }\n";
  private static readonly RULE: string = "; CODING-STANDARDS.md sections 5 and 10 give each implementation file one named concept and name the file for it.";

  public static register(): void {
    test("one concept per file named for it passes, with product names, role words, interfaces and the files package.json runs, outside test folders and declarations", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runtime = ConceptFileCheckTests.RUNTIME;
      await repository.writeAsync({
        "package.json": ConceptFileCheckTests.MANIFEST,
        "scripts/build.ts": "export default class BuildCommand {}\n",
        "scripts/repository/github-api.ts": "export default class GitHubApi {}\n",
        "scripts/toolchain/typescript-compiler.ts": "export default class TypeScriptCompiler {}\n",
        "scripts/desktop/teamrun-window.ts": "export default class TeamRunWindow {}\n",
        [`${runtime}/interfaces/i-event-sink.ts`]: "export default interface IEventSink {}\n",
        [`${runtime}/services/settings/settings.service.ts`]: "import path from \"node:path\";\n\nexport default class SettingsService {}\n",
        [`${runtime}/exceptions/exception.ts`]: "export default class Exception extends Error {}\n",
        [`${runtime}/enums/window-state-kind.ts`]: "export enum WindowStateKind { Bounds = \"Bounds\" }\n",
        [`${runtime}/types/method-name.ts`]: "export type MethodName = string;\n",
        [`${runtime}/models/http-address.ts`]: "declare global { interface Window {} }\nfunction parse(): void {}\nexport default class HTTPAddress {}\n",
        [`${runtime}/main.ts`]: "const value = 1;\nexport default value;\n",
        [`${runtime}/api/index.d.ts`]: "export declare class One {}\nexport declare class Two {}\n",
        "src/shell/desktop/src/preload.cts": "export class Preload {}\n",
        "src/shell/ui/src/app/components/menu/menu.component.ts": "export class MenuComponent {}\n",
        "src/shell/ui/src/app/directives/menu-trigger.directive.ts": "export class MenuTriggerDirective {}\n",
        "src/shell/runtime/tests/models/pair.test.ts": "class One {}\nclass Two {}\n",
        "src/shell/desktop/tests/e2e/fixtures/pair.ts": "class One {}\nclass Two {}\n",
        "docs/pair.ts": "class One {}\nclass Two {}\n"
      });
      const output = new TextOutputFixture();

      const check = ConceptFileCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the concepts and file names of 13 production scripts.\n");
      assert.equal(check.title, "Concept files");
    });

    test("a file with several concepts or a nameless class, and a concept in a file not named for it, fail with where they are", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runtime = ConceptFileCheckTests.RUNTIME;
      await repository.writeAsync({
        "package.json": ConceptFileCheckTests.MANIFEST,
        "scripts/tools/launcher.ts": "export default class LaunchCommand {}\n",
        "scripts/api/api-symbol.walker.ts": "export default class ApiSymbolWalker {}\n",
        "scripts/repository/git-hub-api.ts": "export default class GitHubApi {}\n",
        "scripts/shapes/pair.ts": "class Pair {}\ninterface IPair {}\n",
        "scripts/shapes/many.ts": "export default class {}\nenum Many { One = \"One\" }\ntype Count = number;\n",
        "scripts/shapes/nameless.ts": "import path from \"node:path\";\n\nexport default class {}\n",
        [`${runtime}/interfaces/event-sink.ts`]: "export default interface IEventSink {}\n",
        [`${runtime}/services/settings/settings-service.ts`]: "export default class SettingsService {}\n",
        "src/shell/desktop/src/preload.cts": "export class PreloadBridge {}\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await ConceptFileCheckTests.createCheck(repository).runAsync(output), false);
      const rule = ConceptFileCheckTests.RULE;
      assert.equal(output.text, [
        `scripts/api/api-symbol.walker.ts:1: ApiSymbolWalker is not in its file api-symbol-walker.ts${rule}`,
        `scripts/repository/git-hub-api.ts:1: GitHubApi is not in its file github-api.ts${rule}`,
        `scripts/shapes/many.ts: declares 3 concepts, (anonymous), Many, Count${rule}`,
        `scripts/shapes/nameless.ts:3: declares a class without a name to name the file for${rule}`,
        `scripts/shapes/pair.ts: declares 2 concepts, Pair, IPair${rule}`,
        `scripts/tools/launcher.ts:1: LaunchCommand is not in its file launch-command.ts${rule}`,
        `src/shell/desktop/src/preload.cts:1: PreloadBridge is not in its file preload-bridge.cts${rule}`,
        `${runtime}/interfaces/event-sink.ts:1: IEventSink is not in its file i-event-sink.ts${rule}`,
        `${runtime}/services/settings/settings-service.ts:1: SettingsService is not in its file settings.service.ts${rule}`,
        "Checked the concepts and file names of 9 production scripts.",
        ""
      ].join("\n"));
    });

    test("a package.json that is missing, not a JSON object or with scripts that are not an object fails the check before it reads any script, and one without scripts exempts no file", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "scripts/shapes/pair.ts": "class Pair {}\ninterface IPair {}\n" });
      const rule = ConceptFileCheckTests.RULE;
      const expected = `package.json: is not a JSON object whose scripts, if any, are an object, which name the files that keep their own names${rule}\n`;

      for (const manifest of [null, "not JSON", "null", "[]", "{ \"scripts\": null }", "{ \"scripts\": \"build\" }", "{ \"scripts\": [] }"]) {
        if (manifest === null)
          await rm(path.join(repository.directory, "package.json"), { force: true });
        else
          await repository.writeAsync({ "package.json": manifest });
        const output = new TextOutputFixture();

        assert.equal(await ConceptFileCheckTests.createCheck(repository).runAsync(output), false, String(manifest));
        assert.equal(output.text, expected, String(manifest));
      }
      await repository.writeAsync({ "package.json": "{}\n" });
      const output = new TextOutputFixture();

      assert.equal(await ConceptFileCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, `scripts/shapes/pair.ts: declares 2 concepts, Pair, IPair${rule}\nChecked the concepts and file names of 1 production scripts.\n`);
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const repository = await RepositoryFixture.createAsync();
      const files = { "package.json": ConceptFileCheckTests.MANIFEST, "scripts/shapes/pair.ts": "export default class Pair {}\n" };
      t.after(() => repository.disposeAsync());
      await repository.writeAsync(files);
      const output = new TextOutputFixture();
      const listed = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], ConceptFileCheckTests.TIMEOUT);

      assert.equal(await new ConceptFileCheck(repository.directory, listed, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the concepts and file names of 1 production scripts\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ ...files, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(ConceptFileCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): ConceptFileCheck {
    const directory = repository.directory;
    return new ConceptFileCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], ConceptFileCheckTests.TIMEOUT));
  }
}

ConceptFileCheckTests.register();
