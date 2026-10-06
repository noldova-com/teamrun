/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppImageSource } from "@noldova/teamrun-shell-runtime";

import { FileSystemPatchFixture } from "../fixtures/file-system-patch.fixture.js";

@TestClass
export class AppImageSourceTests {
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = { APPIMAGE: "/home/ada/TeamRun.AppImage", APPDIR: "/tmp/.mount_TeamRuX" };

  @TestMethod
  public findsTheAppImageOfAProgramInsideItsFolder(): void {
    const source = AppImageSource.find({ ...AppImageSourceTests.ENVIRONMENT, APPDIR: "/tmp//.mount_TeamRuX/" }, "/tmp/.mount_TeamRuX/teamrun");

    Assert.areEqual("/home/ada/TeamRun.AppImage", source?.file);
    Assert.areEqual("/tmp/.mount_TeamRuX", source?.folder);
  }

  @TestMethod
  public findsNoAppImageWithoutBothAbsolutePathsOrForAProgramOutsideItsFolder(): void {
    const cases: readonly (readonly [NodeJS.ProcessEnv, string])[] = [
      [{}, "/tmp/.mount_TeamRuX/teamrun"],
      [{ APPIMAGE: "/home/ada/TeamRun.AppImage" }, "/tmp/.mount_TeamRuX/teamrun"],
      [{ APPDIR: "/tmp/.mount_TeamRuX" }, "/tmp/.mount_TeamRuX/teamrun"],
      [{ ...AppImageSourceTests.ENVIRONMENT, APPIMAGE: "TeamRun.AppImage" }, "/tmp/.mount_TeamRuX/teamrun"],
      [{ ...AppImageSourceTests.ENVIRONMENT, APPDIR: "mount" }, "mount/teamrun"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_TeamRuX"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_TeamRuY/teamrun"],
      [AppImageSourceTests.ENVIRONMENT, "/opt/teamrun/teamrun"]
    ];

    Assert.areEqual(",,,,,,,,", cases.map(([environment, program]) => AppImageSource.find(environment, program)?.file ?? "").join(","));
  }

  @TestMethod
  public isMountedWhenItsFolderIsAMountPoint(): void {
    const table = [
      "22 1 0:21 / /proc rw,nosuid shared:12 - proc proc rw",
      "98 29 0:62 / /tmp/.mount\\040TeamRun rw,nosuid,nodev shared:51 - fuse.TeamRun.AppImage TeamRun.AppImage ro",
      ""
    ].join("\n");
    using _fileSystem = new FileSystemPatchFixture(null, table);

    const mounted = AppImageSource.find({ APPIMAGE: "/home/ada/TeamRun.AppImage", APPDIR: "/tmp/.mount TeamRun" }, "/tmp/.mount TeamRun/teamrun");
    const extracted = AppImageSource.find({ APPIMAGE: "/home/ada/TeamRun.AppImage", APPDIR: "/tmp/appimage_extracted_1f" }, "/tmp/appimage_extracted_1f/teamrun");

    Assert.areEqual(true, mounted?.isMounted);
    Assert.areEqual(false, extracted?.isMounted);
  }

  @TestMethod
  public locatesTheAppImageForAProgramInsideItAndTheProgramOtherwise(): void {
    Assert.areEqual("/home/ada/TeamRun.AppImage", AppImageSource.locateProgram(AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_TeamRuX/teamrun"));
    Assert.areEqual("/opt/teamrun/teamrun", AppImageSource.locateProgram(AppImageSourceTests.ENVIRONMENT, "/opt/teamrun/teamrun"));
  }
}
