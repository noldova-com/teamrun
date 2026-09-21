/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Index } from "@noldova/teamrun-foundation-data";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class IndexTests {
  @TestMethod
  public holdsANamedIndexOverFields(): void {
    const fields = ["conversation_id", "sequence"];
    const index = new Index("IX_messages_conversationId_sequence", "messages", fields, true);
    fields.length = 0;

    Assert.areEqual("IX_messages_conversationId_sequence", index.name);
    Assert.areEqual("messages", index.container);
    Assert.areEqual("conversation_id,sequence", index.fields.join(","));
    Assert.isTrue(index.isUnique);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("name", Assert.throws(() => new Index("", "messages", ["id"], false), ArgumentException).parameterName);
    Assert.areEqual("container", Assert.throws(() => new Index("ix", " ", ["id"], false), ArgumentException).parameterName);
    Assert.areEqual("fields", Assert.throws(() => new Index("ix", "messages", [], false), ArgumentException).parameterName);
  }
}
