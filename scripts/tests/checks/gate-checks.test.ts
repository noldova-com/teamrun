/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GateChecks from "../../checks/gate-checks.ts";
import PackageTestCheck from "../../checks/package-test-check.ts";
import AngularReportRunnerFixture from "../fixtures/angular-report-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class GateChecksTests {
  public static register(): void {
    test("the complete gate's checks come in their order, each in its part, and the test checks name their runner", async () => {
      const check = (title: string): string => `${title} | angular-and-checks | none`;

      const checks = await new GateChecks("unused", new AngularReportRunnerFixture("{}"), {}).createAsync(null);

      const placed = checks.map(t => `${t.check.title} | ${t.part} | ${t.runner ?? "none"}`);
      assert.deepEqual(placed, [
        ...["Documents", "License headers", "Comments", "Test waits", "Field order", "Bucket names", "Interface names", "Angular files", "Foundation value checks", "Enum values", "Exception names", "Concept files", "Concept folders", "GitHub configuration", "Module folders", "Shell names no module", "Product identity", "Module imports", "Window imports", "Test mirrors", "Coverage exclusions", "Unique names", "Declared dependencies", "Dependency pins", "Package layout", "Packages"].map(check),
        "Package tests and coverage | packages | package",
        ...["Script types", "API declarations", "API documentation", "API examples"].map(check),
        "Script tests and coverage | scripts | script",
        "Angular tests and coverage | angular-and-checks | angular",
        check("Packaged build leaves out the Gallery")
      ]);
    });

    test("the package tests take the packages a selection names", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitignore": "_build/\n", "package.json": `${JSON.stringify(ProductIdentityFixture.manifest(), null, 2)}\n` });
      const runner = new AngularReportRunnerFixture("{}", [0]);
      const output = new TextOutputFixture();

      const checks = await new GateChecks(repository.directory, runner, {}).createAsync(null, ["@noldova/teamrun-foundation-missing"]);
      const packageTests = checks.map(u => u.check).find(u => u instanceof PackageTestCheck);

      assert.equal(await packageTests?.runAsync(output), false);
      assert.ok(output.text.includes("No package is named @noldova/teamrun-foundation-missing. The packages are none.\n"), output.text);
    });

    test("the documents selection has only the document check", () => {
      const checks = new GateChecks("unused", new AngularReportRunnerFixture("{}"), {}).createDocumentChecks();

      assert.deepEqual(checks.map(t => t.title), ["Documents"]);
    });
  }
}

GateChecksTests.register();
