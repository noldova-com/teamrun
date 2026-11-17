/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalNotDeniableException, CoreException, DenyingTurn, Resources } from "@noldova/teamrun.core";

@TestClass
export class ApprovalNotDeniableExceptionTests {
  @TestMethod
  public carriesItsNameTurnAndSummary(): void {
    const exception = new ApprovalNotDeniableException(DenyingTurn.Title, "Run rm a.txt");

    Assert.isInstanceOf(exception, CoreException);
    Assert.areEqual("ApprovalNotDeniableException", exception.name);
    Assert.areEqual(DenyingTurn.Title, exception.turn);
    Assert.areEqual("Run rm a.txt", exception.summary);
    Assert.areEqual("ApprovalNotDeniableException", Resources.formatFailureKind(exception));
  }

  @TestMethod
  public saysWhichTurnCouldNotDeny(): void {
    Assert.areEqual(Resources.formatExplorerDenied("Run rm a.txt"), new ApprovalNotDeniableException(DenyingTurn.Explorer, "Run rm a.txt").message);
    Assert.areEqual(Resources.titleTurnNotDeniable, new ApprovalNotDeniableException(DenyingTurn.Title, "Run rm a.txt").message);
    Assert.areEqual(Resources.summaryTurnNotDeniable, new ApprovalNotDeniableException(DenyingTurn.Summary, "Run rm a.txt").message);
  }
}
