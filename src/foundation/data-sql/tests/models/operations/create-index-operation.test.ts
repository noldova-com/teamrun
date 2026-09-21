/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Index } from "@noldova/teamrun-foundation-data";
import { CreateIndexOperation } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TestDialect } from "../../fixtures/test-dialect.fixture.js";

@TestClass
export class CreateIndexOperationTests {
  @TestMethod
  public rendersTheIndexInTheDialect(): void {
    const index = new Index("IX_notes_text", "notes", ["text"], true);
    const operation = new CreateIndexOperation(index);

    Assert.areEqual(index, operation.index);
    Assert.areEqual("CREATE UNIQUE INDEX IX_notes_text ON notes (text)", operation.render(new TestDialect()));
  }
}
