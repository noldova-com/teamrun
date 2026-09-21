/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataSource, DbContext, DbContextOptionsBuilder } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryProvider } from "../fixtures/memory-provider.fixture.js";
import { NotesContext } from "../fixtures/notes-context.fixture.js";

@TestClass
export class DbContextTests {
  @TestMethod
  public opensItsDatabaseWithItsMigrations(): void {
    const provider = new MemoryProvider();
    using context = new NotesContext(new DbContextOptionsBuilder().use(provider, new DataSource("notes", ":memory:")));

    Assert.isInstanceOf(context, DbContext);
    Assert.isTrue(context.database.connection.isOpen);
    Assert.areEqual("20260908130000_Notes,20260908130001_Tags", context.database.getPendingMigrations().map(t => t.id).join(","));
    Assert.areEqual(2, context.database.migrate().length);
    Assert.areEqual(0, context.database.getPendingMigrations().length);
  }

  @TestMethod
  public disposalClosesTheConnection(): void {
    const provider = new MemoryProvider();
    const context = new NotesContext(new DbContextOptionsBuilder().use(provider, new DataSource("notes", ":memory:")));
    context[Symbol.dispose]();

    Assert.isFalse(context.database.connection.isOpen);
    Assert.areEqual(1, provider.connections[0]?.closeCount);
  }
}
