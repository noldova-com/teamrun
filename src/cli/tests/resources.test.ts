/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-cli";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsMessages(): void {
    Assert.areEqual("The command \"x\" is registered twice.", Resources.formatDuplicateCommand("x"));
    Assert.areEqual("Unknown command \"x\". Run \"teamrun help\" for the list.", Resources.formatUnknownCommand("x"));
    Assert.areEqual("The argument <id> is required.", Resources.formatMissingArgument("id"));
    Assert.areEqual("The option --provider is required.", Resources.formatMissingOption("provider"));
    Assert.areEqual("Error (NotFound): gone", Resources.formatFailure("NotFound", "gone"));
    Assert.areEqual("Could not reach the runtime: why", Resources.formatConnectionFailure("why"));
    Assert.areEqual("Runtime process 1 at ep, product 2, protocol 0.1, since now", Resources.formatRuntimeStatus(1, "ep", "2", "0.1", "now"));
    Assert.areEqual("  help                 Shows this help.", Resources.formatCommandHelp("help", "Shows this help."));
    Assert.areEqual("[Text] hi", Resources.formatDetail("Text", "hi"));
    Assert.areEqual("-- reply Completed", Resources.formatStatus("Completed"));
    Assert.areEqual("  allow: Allow", Resources.formatApprovalOption("allow", "Allow"));
    Assert.areEqual("-- decided allow", Resources.formatDecided("allow"));
    Assert.areEqual("Evidence written to f", Resources.formatEvidenceWritten("f"));
  }

  @TestMethod
  public describesARewind(): void {
    Assert.areEqual("Removed 1 message; 1 file restored. The next reply starts a fresh provider session.", Resources.formatRewound(1, 1, false));
    Assert.areEqual("Removed 2 messages; no files restored. The provider's session continues from there.", Resources.formatRewound(2, null, true));
    Assert.areEqual("Removed 3 messages; 2 files restored. The next reply starts a fresh provider session.", Resources.formatRewound(3, 2, false));
  }
}
