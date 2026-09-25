/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ReleaseUpdateInfo } from "@noldova/teamrun-desktop";

@TestClass
export class ReleaseUpdateInfoTests {
  private static readonly URL: string = "https://github.com/noldova-com/teamrun/releases/download/v0.0.3/TeamRun-windows-x64.exe";

  @TestMethod
  public readsTheSingleUpdateFileOfATarget(): void {
    const info = ReleaseUpdateInfo.parse(ReleaseUpdateInfoTests.format({}));

    Assert.areEqual("0.0.3", info.version);
    Assert.areEqual(ReleaseUpdateInfoTests.URL, info.url);
    Assert.areEqual("c2hhNTEy", info.sha512);
    Assert.areEqual(1024, info.size);
    Assert.areEqual("2026-09-25T16:00:00.000Z", info.releaseDate);
  }

  @TestMethod
  public rejectsMalformedUpdateInformation(): void {
    const file = { url: ReleaseUpdateInfoTests.URL, sha512: "c2hhNTEy", size: 1024 };
    const invalid = [
      "not json", "[]",
      ReleaseUpdateInfoTests.format({ version: " " }),
      ReleaseUpdateInfoTests.format({ version: 3 }),
      ReleaseUpdateInfoTests.format({ releaseDate: null }),
      ReleaseUpdateInfoTests.format({ files: {} }),
      ReleaseUpdateInfoTests.format({ files: [] }),
      ReleaseUpdateInfoTests.format({ files: [file, file] }),
      ReleaseUpdateInfoTests.format({ files: [{ ...file, url: "" }] }),
      ReleaseUpdateInfoTests.format({ files: [{ ...file, sha512: 7 }] }),
      ReleaseUpdateInfoTests.format({ files: [{ ...file, size: 0 }] }),
      ReleaseUpdateInfoTests.format({ files: [{ ...file, size: 1.5 }] })
    ];
    for (const text of invalid)
      Assert.throws(() => ReleaseUpdateInfo.parse(text), Error, text);
  }

  private static format(changes: Record<string, unknown>): string {
    return JSON.stringify({
      version: "0.0.3", files: [{ url: ReleaseUpdateInfoTests.URL, sha512: "c2hhNTEy", size: 1024 }], path: ReleaseUpdateInfoTests.URL,
      sha512: "c2hhNTEy", releaseDate: "2026-09-25T16:00:00.000Z", ...changes
    });
  }
}
