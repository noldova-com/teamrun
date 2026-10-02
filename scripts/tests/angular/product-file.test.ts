/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ProductFile from "../../angular/product-file.ts";
import PackageException from "../../packages/package.exception.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ProductFileTests {
  public static register(): void {
    test("the window's product file is generated from the root manifest's identity", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest()) });
      const file = new ProductFile(repository.directory);

      await file.writeAsync();

      assert.equal(file.file, path.join(repository.directory, "src", "generated", "product.ts"));
      assert.equal(await readFile(file.file, "utf8"), [
        "/**",
        " * @license",
        " * Copyright (c) Noldova.",
        " *",
        " * This source code is licensed under the license found in the",
        " * LICENSE file in the root directory of this source tree.",
        " */",
        "",
        "export const productName: string = \"Fixture Studio\";",
        ""
      ].join("\n"));
    });

    test("no product file is written without a valid identity", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": "{}" });

      await assert.rejects(new ProductFile(repository.directory).writeAsync(), PackageException);
    });
  }
}

ProductFileTests.register();
