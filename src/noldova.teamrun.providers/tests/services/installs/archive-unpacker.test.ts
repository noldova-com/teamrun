/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ArchiveUnpacker, ExecutableSource, LocatedExecutable } from "@noldova/teamrun.providers";

@TestClass
export class ArchiveUnpackerTests {
  @TestMethod
  public unpacksWithUnzipOrWindowsTar(): void {
    const unzip = ArchiveUnpacker.command(new LocatedExecutable("/usr/bin/unzip", ExecutableSource.Path), "/s/download.zip", "/s/1.3.0");
    Assert.areEqual("/usr/bin/unzip -q -o /s/download.zip -d /s/1.3.0", [unzip.executable, ...unzip.arguments].join(" "));
    const tar = ArchiveUnpacker.command(new LocatedExecutable("C:\\Windows\\System32\\TAR.EXE", ExecutableSource.Path), "C:\\s\\download.zip",
      "C:\\s\\1.3.0");
    Assert.areEqual("C:\\Windows\\System32\\TAR.EXE -xf C:\\s\\download.zip -C C:\\s\\1.3.0", [tar.executable, ...tar.arguments].join(" "));
  }
}
