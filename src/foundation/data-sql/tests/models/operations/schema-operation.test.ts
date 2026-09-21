/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Index } from "@noldova/teamrun-foundation-data";
import { CreateIndexOperation, SchemaOperation } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class SchemaOperationTests {
  @TestMethod
  public isTheBaseOfEveryOperation(): void {
    Assert.isInstanceOf(new CreateIndexOperation(new Index("IX_notes_text", "notes", ["text"], false)), SchemaOperation);
  }
}
