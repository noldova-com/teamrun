/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity } from "@noldova/teamrun.core";

@TestClass
export class ChangeEntityTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Project", ChangeEntity.Project);
    Assert.areEqual("Chat", ChangeEntity.Chat);
    Assert.areEqual("ChatMember", ChangeEntity.ChatMember);
    Assert.areEqual("Message", ChangeEntity.Message);
    Assert.areEqual("Approval", ChangeEntity.Approval);
    Assert.areEqual("Provider", ChangeEntity.Provider);
    Assert.areEqual("SharedMcpServer", ChangeEntity.SharedMcpServer);
    Assert.areEqual("AcpAgent", ChangeEntity.AcpAgent);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ChangeEntity);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
