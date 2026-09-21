/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConstraintsBuilder } from "@noldova/teamrun-foundation-data-sql";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import type { Note } from "../../fixtures/note.fixture.js";
import type { Owner } from "../../fixtures/owner.fixture.js";

@TestClass
export class ConstraintsBuilderTests {
  @TestMethod
  public hasNoConstraintsByDefault(): void {
    const builder = new ConstraintsBuilder<Note>();

    Assert.isNull(builder.toPrimaryKey());
    Assert.areEqual(0, builder.toForeignKeys().length);
  }

  @TestMethod
  public declaresACompositePrimaryKeyAndForeignKeys(): void {
    const builder = new ConstraintsBuilder<Note>();

    Assert.areEqual(builder, builder.primaryKey(t => t.id, t => t.text));
    Assert.areEqual(builder, builder.foreignKey<Owner>(t => t.ownerId, "owners", t => t.id));
    Assert.areEqual("id,text", builder.toPrimaryKey()?.columns.join(","));
    const foreignKeys = [...builder.toForeignKeys()];
    foreignKeys.length = 0;
    Assert.areEqual("ownerId", builder.toForeignKeys()[0]?.column);
    Assert.areEqual("owners", builder.toForeignKeys()[0]?.principalTable);
    Assert.areEqual("id", builder.toForeignKeys()[0]?.principalColumn);
  }

  @TestMethod
  public rejectsAKeyWithoutColumns(): void {
    Assert.throws(() => new ConstraintsBuilder<Note>().primaryKey(), ArgumentException);
  }
}
