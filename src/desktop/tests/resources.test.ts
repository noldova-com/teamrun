/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-desktop";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsMessages(): void {
    Assert.areEqual("The runtime could not be reached. why", Resources.formatRuntimeFailure("why"));
    Assert.areEqual("Screenshot written to shot.png.", Resources.formatScreenshotWritten("shot.png"));
  }

  @TestMethod
  public carriesTheStampedProductVersion(): void {
    Assert.isFalse(Resources.productVersion.includes("__"));
    Assert.isTrue(Resources.productVersion.length > 0);
  }

  @TestMethod
  public preloadRepeatsTheChannelNames(): void {
    const preloadPath = createRequire(import.meta.url).resolve("@noldova/teamrun-desktop/preload.cjs");
    const preload = readFileSync(preloadPath, "utf8");

    const channels = [
      Resources.invokeChannel, Resources.eventChannel, Resources.openExternalChannel, Resources.pickDirectoryChannel, Resources.infoChannel,
      Resources.titleBarChannel, Resources.imageChannel
    ];
    for (const channel of channels)
      Assert.isTrue(preload.includes(`"${channel}"`), channel);
  }
}
