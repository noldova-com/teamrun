/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionAsk } from "@noldova/teamrun.core";

@TestClass
export class PermissionAskTests {
  @TestMethod
  public keepsTheModulesLabelsAndLeavesThemOutByDefault(): void {
    const labelled = new PermissionAsk("browser.click", "Click Pay", {}, false, "Allow for this chat", "I'll type it myself");
    const plain = new PermissionAsk("notes.deleteItem", "Delete the note", {}, false);

    Assert.areEqual("Allow for this chat", labelled.allowAlwaysLabel);
    Assert.areEqual("I'll type it myself", labelled.takeOverLabel);
    Assert.isNull(plain.allowAlwaysLabel);
    Assert.isNull(plain.takeOverLabel);
  }

  @TestMethod
  public keepsTheBasesQuestionIdAndMakesOneByDefault(): void {
    const asked = new PermissionAsk("browser.click", "Click Pay", {}, false, null, null, "request-1");
    const ids = [new PermissionAsk("browser.click", "Click Pay", {}, false).id, new PermissionAsk("browser.click", "Click Pay", {}, false).id];

    Assert.areEqual("request-1", asked.id);
    Assert.areEqual(2, new Set(ids.filter(t => t.length > 0)).size);
  }

  @TestMethod
  public refusesABlankTextOrLabel(): void {
    Assert.areEqual("action", Assert.throws(() => new PermissionAsk(" ", "Click Pay", {}, false), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new PermissionAsk("browser.click", "", {}, false), ArgumentException).parameterName);
    Assert.areEqual("allowAlwaysLabel", Assert.throws(() => new PermissionAsk("browser.click", "Click Pay", {}, false, " "), ArgumentException).parameterName);
    Assert.areEqual("takeOverLabel", Assert.throws(() => new PermissionAsk("browser.click", "Click Pay", {}, false, null, ""), ArgumentException).parameterName);
  }

  @TestMethod
  public offersAllowOnceByDefaultAndLeavesItOutOnlyWhenAnotherOptionAllows(): void {
    const site = new PermissionAsk("browser.navigate", "Open status.example.net", {}, false, "Allow this site for the project", null, undefined, false);
    const screen = new PermissionAsk("computer-use.screen", "See the screen", {}, true, null, null, undefined, false);

    Assert.areEqual("true,false,false", [new PermissionAsk("notes.deleteItem", "Delete the note", {}, false), site, screen].map(t => t.offersAllowOnce).join(","));
    Assert.areEqual("offersAllowOnce", Assert.throws(() => new PermissionAsk("notes.deleteItem", "Delete the note", {}, false, null, "I'll do it", undefined, false),
      ArgumentException).parameterName);
  }
}
