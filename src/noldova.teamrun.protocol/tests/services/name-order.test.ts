/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NameOrder } from "@noldova/teamrun.protocol";

@TestClass
export class NameOrderTests {
  @TestMethod
  public sortsByNameInTheRuntimesLanguageIgnoringCaseWithAnAccentedNameBesideItsLetter(): void {
    const names = ["zoe", "Émile", "bob", "Alice", "edgar", "Frank"];

    Assert.areEqual(["Alice", "bob", "edgar", "Émile", "Frank", "zoe"].join(), NameOrder.sort(names, t => t).join());
    Assert.areEqual(["zoe", "Émile", "bob", "Alice", "edgar", "Frank"].join(), names.join());
  }

  @TestMethod
  public keepsTheOrderOfNamesThatDifferOnlyInCaseAndSortsByEachNameInTurn(): void {
    const items = [["Codex", "work"], ["Claude", "Work"], ["Claude", "home"], ["Codex", "Home"], ["Claude", "work"]] as const;

    Assert.areEqual(["Claude home", "Codex Home", "Codex work", "Claude Work", "Claude work"].join(),
      NameOrder.sort(items, ([, label]) => label).map(t => t.join(" ")).join());
    Assert.areEqual(["Claude home", "Claude Work", "Claude work", "Codex Home", "Codex work"].join(),
      NameOrder.sort(items, ([kind]) => kind, ([, label]) => label).map(t => t.join(" ")).join());
  }
}
