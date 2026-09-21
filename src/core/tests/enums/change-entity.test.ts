/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity } from "@noldova/teamrun-core";

@TestClass
export class ChangeEntityTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Project", ChangeEntity.Project);
    Assert.areEqual("Conversation", ChangeEntity.Conversation);
    Assert.areEqual("Message", ChangeEntity.Message);
    Assert.areEqual("Approval", ChangeEntity.Approval);
    Assert.areEqual("ProviderAccount", ChangeEntity.ProviderAccount);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(ChangeEntity);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
