/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import * as typescriptAst from "typescript/unstable/ast";
import * as typescriptGuards from "typescript/unstable/ast/is";
import * as typescriptApi from "typescript/unstable/async";

import ApiProject from "../../api/api-project.ts";
import ApiServer from "../../api/api-server.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class ApiServerTests {
  private static readonly TIMEOUT: number = 30_000;

  public static register(): void {
    test("the pinned TypeScript keeps the API shape and the compiler that the checks use", () => {
      const members: readonly (readonly [object, readonly string[]])[] = [
        [typescriptApi.API.prototype, ["updateSnapshot", "close"]],
        [typescriptApi.Checker.prototype, [
          "getSymbolAtLocation", "getAliasedSymbol", "getTypeOfSymbol", "getDeclaredTypeOfSymbol", "getSignaturesOfType", "getReturnTypeOfSignature",
          "getTypeFromTypeNode", "getTypeAtLocation", "getConstantValue", "typeToString"
        ]],
        [typescriptApi.Program.prototype, ["getSourceFile", "getSyntacticDiagnostics", "getSemanticDiagnostics"]],
        [typescriptApi.Emitter.prototype, ["printNode"]],
        [typescriptApi.NodeHandle.prototype, ["resolve"]],
        [typescriptApi.Symbol.prototype, ["getExports", "getMembers"]]
      ];
      for (const [prototype, methods] of members)
        assert.deepEqual(methods.filter(t => !Object.getOwnPropertyNames(prototype).includes(t)), []);
      for (const accessor of ["isAbstract", "isConstruct"])
        assert.equal(typeof Object.getOwnPropertyDescriptor(typescriptApi.Signature.prototype, accessor)?.get, "function", accessor);
      const guards = ["isClassDeclaration", "isInterfaceDeclaration", "isTypeAliasDeclaration", "isSignatureDeclaration", "isTypePredicateNode"];
      assert.deepEqual(guards.filter(t => !Object.keys(typescriptGuards).includes(t)), []);
      assert.deepEqual(
        [typescriptApi.SignatureKind.Call, typescriptApi.SignatureKind.Construct, typescriptApi.SymbolFlags.Alias, typescriptApi.ModifierFlags.Private,
          typescriptApi.NodeBuilderFlags.NoTruncation, typescriptApi.DiagnosticCategory.Error, typescriptAst.SyntaxKind.ConstructSignature].map(t => typeof t),
        Array(7).fill("number"));
      assert.ok(existsSync(ApiServer.locateCompiler()));
    });

    test("the compiler is tsc.exe on Windows and tsc elsewhere", () => {
      assert.deepEqual(["win32", "linux", "darwin"].map(t => ApiServer.formatCompilerName(t)), ["tsc.exe", "tsc", "tsc"]);
    });

    test("a session opens the project, returns the work's result and closes", async t => {
      const result = await ApiServerTests.useAsync(t, async project => (await project.program.getSourceFile(project.rootFiles[0] ?? "")) !== undefined);

      assert.equal(result, true);
    });

    test("a session that outlives its deadline is stopped", async t => {
      const started = Date.now();

      await assert.rejects(ApiServerTests.useAsync(t, () => new Promise<boolean>(() => undefined), 300),
        new ApiException("The TypeScript API did not finish within 300 ms."));
      assert.ok(Date.now() - started < 10_000);
    });

    test("a failing work's error reaches the caller after the session closes", async t => {
      await assert.rejects(ApiServerTests.useAsync(t, () => Promise.reject(new RangeError("work failed"))), new RangeError("work failed"));
    });

    test("a server needs a command", async () => {
      await assert.rejects(ApiServer.useAsync([], SourceTreeFixture.root, "unused", ApiServerTests.TIMEOUT, () => Promise.resolve(1)),
        new ApiException("The TypeScript API needs a command to start its server."));
    });

    test("a server that stops before accepting a connection fails with its error output", async () => {
      const command = [process.execPath, "-e", "process.stderr.write('not listening'); setTimeout(() => {}, 300)", "--"];

      await assert.rejects(ApiServer.useAsync(command, SourceTreeFixture.root, "unused.json", ApiServerTests.TIMEOUT, () => Promise.resolve(1)),
        (t: unknown) => t instanceof ApiException && /^The TypeScript API server could not open unused\.json; after \d+ ms it had stopped\.\nnot listening$/.test(t.message));
    });

    test("a project file that names no project fails and keeps the cause", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const missing = `${fixture.directory}/missing.json`;

      await assert.rejects(ApiServer.useAsync([ApiServer.locateCompiler()], fixture.directory, missing, ApiServerTests.TIMEOUT, () => Promise.resolve(1)),
        (t: unknown) => t instanceof ApiException && t.message.startsWith(`The TypeScript API server could not open ${missing}; after `) &&
          t.message.endsWith(" ms it was running.") &&
          t.cause instanceof ApiException && t.cause.message === `The TypeScript API found no project in ${missing}.`);
    });
  }

  private static async useAsync<T>(
    context: { after: (callback: () => Promise<void>) => void },
    work: (project: typescriptApi.Project) => Promise<T>,
    timeout: number = ApiServerTests.TIMEOUT): Promise<T> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    await fixture.writePackageAsync("empty", { "api/index.ts": "export const value: number = 1;\n" }, "export declare const value: number;\n");
    const project = new ApiProject(fixture.directory, "server", "empty");
    await project.writeAsync(`${fixture.directory}/src/foundation/empty/src/tsconfig.json`, fixture.directory,
      [`${fixture.directory}/src/foundation/empty/src/api/index.ts`]);
    return await ApiServer.useAsync([ApiServer.locateCompiler()], fixture.directory, project.file, timeout, work);
  }
}

ApiServerTests.register();
