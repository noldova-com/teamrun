/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ApiDeclarationSession from "../../api/api-declaration-session.ts";
import ApiPackage from "../../api/api-package.ts";
import ApiServer from "../../api/api-server.ts";
import ApiSymbolWalker from "../../api/api-symbol.walker.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";

class ApiDeclarationSessionTests {
  private static readonly TIMEOUT: number = 60_000;
  private static readonly PART: string = "src/shell/counter";
  private static readonly IMPLEMENTATION: Readonly<Record<string, string>> = { "api/index.ts": "export const size: number = 1;\n" };

  public static register(): void {
    test("a package's declarations are read through a server over a project of their own", async t => {
      const fixture = await ApiDeclarationSessionTests.createAsync(t);
      await fixture.writePartAsync(ApiDeclarationSessionTests.PART, ApiDeclarationSessionTests.IMPLEMENTATION, "export declare const size: number;\n");
      const apiPackage = ApiDeclarationSessionTests.locatePart(fixture);
      const session = new ApiDeclarationSession(fixture.directory, [ApiServer.locateCompiler()], ApiDeclarationSessionTests.TIMEOUT);

      const visited = await session.useAsync(apiPackage, "session", async t => {
        const paths: string[] = [];
        await new ApiSymbolWalker(t, ApiVisibility.PUBLIC).walkAsync(apiPackage.declarations, async u => {
          paths.push(u);
        });
        return paths;
      });

      assert.deepEqual(visited, ["size"]);
    });

    test("missing declarations are refused with the package's message, before any server starts", async t => {
      const fixture = await ApiDeclarationSessionTests.createAsync(t);
      await fixture.writePartAsync(ApiDeclarationSessionTests.PART, ApiDeclarationSessionTests.IMPLEMENTATION, null);
      const apiPackage = ApiDeclarationSessionTests.locatePart(fixture);
      const session = new ApiDeclarationSession(fixture.directory, [process.execPath, "-e", "process.exit(3)", "--"], ApiDeclarationSessionTests.TIMEOUT);

      await assert.rejects(session.useAsync(apiPackage, "session", () => Promise.resolve([])), new ApiException(apiPackage.missingDeclarationsMessage));
    });
  }

  private static locatePart(fixture: ApiPackageFixture): ApiPackage {
    return ApiPackage.forPart(fixture.directory, ApiDeclarationSessionTests.PART, path.join(fixture.directory, "src", "tsconfig.json"), {});
  }

  private static async createAsync(context: TestContext): Promise<ApiPackageFixture> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    return fixture;
  }
}

ApiDeclarationSessionTests.register();
