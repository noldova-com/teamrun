/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QuitQuestion } from "@noldova/teamrun-shell-desktop";

@TestClass
export class QuitQuestionTests {
  @TestMethod
  public keepsItsOwnCopyOfTheWorkAndWritesItAsJson(): void {
    const descriptions = ["Indexing the project"];

    const question = new QuitQuestion(descriptions, true);
    descriptions.push("Building");

    Assert.areEqual(JSON.stringify(["Indexing the project"]), JSON.stringify(question.descriptions));
    Assert.isTrue(question.isWaiting);
    Assert.areEqual(JSON.stringify({ descriptions: ["Indexing the project"], isWaiting: true }), JSON.stringify(question.toJson()));
    Assert.areEqual(JSON.stringify({ descriptions: [], isWaiting: false }), JSON.stringify(new QuitQuestion([], false).toJson()));
  }
}
