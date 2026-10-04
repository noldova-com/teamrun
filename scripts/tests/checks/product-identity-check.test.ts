/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProductIdentityCheck from "../../checks/product-identity-check.ts";
import ProductIdentity from "../../packages/product-identity.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ProductIdentityCheckTests {
  private static readonly RULE: string = "; the shell takes the product's identity from its stamped resources.";

  public static register(): void {
    test("shell source that takes the identity from the build's product file passes, and the shell's namespaces, comments, tests and foundation may spell it", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
        "src/shell/desktop/src/resources.ts": [
          "/** Fixture Studio's resources, in org.fixtureworks.studio. */",
          "import \"@fixtureworks/studio-shell-runtime\";",
          "export const name = ProductInfo.current.name;",
          "export const id = ProductInfo.current.applicationId;",
          "export const channel = \"fixture-studio:ready\";",
          "export const scope = \"@fixtureworks/studio-shell-window\";",
          "export const longer = \"org.fixtureworks.studio-tools\";",
          "export const other = \"Fixture Studios\";",
          ""
        ].join("\n"),
        "src/shell/window/src/index.html": "<title></title>\n",
        "src/shell/desktop/tests/resources.test.ts": "assert.equal(name, \"Fixture Studio\");\n",
        "src/foundation/testing/src/resources.ts": "export const heading = \"Fixture Studio Package Test Report\";\n"
      });
      const output = new TextOutputFixture();

      const check = ProductIdentityCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 2 production files of the shell for the product's identity.\n");
      assert.equal(check.title, "Product identity");
    });

    test("each identity value spelled in production shell source fails with its file, line and value", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
        "src/shell/desktop/src/resources.ts": [
          "export const name = \"Fixture Studio\";",
          "export const id = \"org.fixtureworks.studio\";",
          "export const development = \"org.fixtureworks.studio.development\";",
          "export const message = `${count} windows of Fixture Studio are open.`;",
          "export const folder = \"Fixture Works/Studio\";",
          "export const variable = \"FIXTURE_STUDIO_DATA_DIR\";",
          "export const hint = \"Set FIXTURE_STUDIO_DATA_DIR to move Fixture Studio's data.\";",
          ""
        ].join("\n"),
        "src/shell/runtime/src/resources.ts": "export const data = [\".fixtureworks/studio\", \"fixtureworks/studio\"].join(\",\");\n",
        "src/shell/window/src/index.html": "<title>Fixture Studio</title>\n",
        "src/shell/ui/src/styles/brand.scss": "/* Fixture Works/Studio Mac */\n"
      });
      const output = new TextOutputFixture();

      const passed = await ProductIdentityCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      const rule = ProductIdentityCheckTests.RULE;
      assert.equal(output.text, [
        `src/shell/desktop/src/resources.ts:1: spells "Fixture Studio"${rule}`,
        `src/shell/desktop/src/resources.ts:2: spells "org.fixtureworks.studio"${rule}`,
        `src/shell/desktop/src/resources.ts:3: spells "org.fixtureworks.studio.development"${rule}`,
        `src/shell/desktop/src/resources.ts:4: spells "Fixture Studio"${rule}`,
        `src/shell/desktop/src/resources.ts:5: spells "Fixture Works/Studio"${rule}`,
        `src/shell/desktop/src/resources.ts:6: spells "FIXTURE_STUDIO_DATA_DIR"${rule}`,
        `src/shell/desktop/src/resources.ts:7: spells "FIXTURE_STUDIO_DATA_DIR"${rule}`,
        `src/shell/desktop/src/resources.ts:7: spells "Fixture Studio"${rule}`,
        `src/shell/runtime/src/resources.ts:1: spells ".fixtureworks/studio"${rule}`,
        `src/shell/runtime/src/resources.ts:1: spells "fixtureworks/studio"${rule}`,
        `src/shell/ui/src/styles/brand.scss:1: spells "Fixture Works/Studio Mac"${rule}`,
        `src/shell/window/src/index.html:1: spells "Fixture Studio"${rule}`,
        "Checked 4 production files of the shell for the product's identity.",
        ""
      ].join("\n"));
    });

    test("a root manifest without a valid product fails the check with the reason", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest({ slug: "Fixture" })) });
      const output = new TextOutputFixture();

      const passed = await ProductIdentityCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, "The root package.json's teamrun.product.slug must be lowercase kebab-case.\n");
    });

    test("an unexpected error while reading the identity is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const directory = repository.directory;
      const check = new ProductIdentityCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))), () => Promise.reject(new TypeError("A defect.")));

      await assert.rejects(check.runAsync(new TextOutputFixture()), TypeError);
    });
  }

  private static createCheck(repository: RepositoryFixture): ProductIdentityCheck {
    const directory = repository.directory;
    return new ProductIdentityCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))), () => ProductIdentity.readAsync(directory));
  }
}

ProductIdentityCheckTests.register();
