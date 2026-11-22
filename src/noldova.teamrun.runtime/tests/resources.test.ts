/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "@noldova/teamrun.runtime";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsDesktopCoreNamesFromTeamRunsNames(): void {
    Assert.areEqual("teamrun.projectOpen", Resources.formatQualifiedName("teamrun", "ProjectOpen"));
    Assert.areEqual("teamrun.stateInvalidated", Resources.formatQualifiedName("teamrun", "StateInvalidated"));
    Assert.areEqual("20260908120000-initial", Resources.formatMigrationId("20260908120000_Initial"));
    Assert.areEqual("teamrun.sqlite", Resources.formatDatabaseFileName("teamrun"));
    Assert.areEqual("TeamRun has no command or method teamrun.missing for its tool.", Resources.formatHandlerMissing("teamrun.missing"));
  }

  @TestMethod
  public acceptsOnlyEnvironmentNamesAProgramCanReceive(): void {
    Assert.isTrue(Resources.environmentNamePattern.test("PATH"));
    Assert.isFalse(Resources.environmentNamePattern.test("=C:"));
    Assert.isFalse(Resources.environmentNamePattern.test(""));
  }

  @TestMethod
  public namesTheFilesADeletedChatHoldsOnlyWhenItHoldsSome(): void {
    Assert.areEqual("Delete the chat \"Notes\"", Resources.formatDeleteChatRequest("Notes", 0));
    Assert.areEqual("Delete the chat \"Notes\" and the file it holds", Resources.formatDeleteChatRequest("Notes", 1));
    Assert.areEqual("Delete the chat \"Notes\" and the 2 files it holds", Resources.formatDeleteChatRequest("Notes", 2));
  }
}
