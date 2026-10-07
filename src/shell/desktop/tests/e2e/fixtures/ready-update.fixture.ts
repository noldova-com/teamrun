/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";
import { Installation, ProductInfo } from "@noldova/teamrun-shell-runtime";

import UpdateFeedFixture from "./update-feed.fixture.ts";

export default class ReadyUpdateFixture {
  private static readonly EXECUTABLE_RECORD: string = path.resolve("_build", "development-app", "path.txt");
  private static readonly CACHE_SUFFIX: string = "-updater-";
  private static readonly PENDING_FOLDER: string = "pending";
  private static readonly RECORD_FILE: string = "update-ready.json";
  private static readonly MAC_CACHES: readonly string[] = ["Library", "Caches"];

  public readonly packageFile: string;
  public readonly recordFile: string;

  private constructor(packageFile: string, recordFile: string) {
    this.packageFile = packageFile;
    this.recordFile = recordFile;
  }

  public static environment(cacheFolder: string): Readonly<Record<string, string>> {
    switch (process.platform) {
      case "win32":
        return { LOCALAPPDATA: cacheFolder };
      case "darwin":
        return { HOME: cacheFolder };
      default:
        return { XDG_CACHE_HOME: cacheFolder };
    }
  }

  public static async seedAsync(deviceDirectory: string, cacheFolder: string, version: string, contents: Buffer): Promise<ReadyUpdateFixture> {
    const program = await readFile(ReadyUpdateFixture.EXECUTABLE_RECORD, "utf8");
    const installation = Installation.locate(deviceDirectory, program, process.platform);
    const cacheRoot = process.platform === "darwin" ? path.join(cacheFolder, ...ReadyUpdateFixture.MAC_CACHES) : cacheFolder;
    const packageFile = path.join(cacheRoot, `${ProductInfo.current.slug}${ReadyUpdateFixture.CACHE_SUFFIX}${path.basename(installation)}`,
      ReadyUpdateFixture.PENDING_FOLDER, UpdateFeedFixture.source.packageFile);
    await mkdir(path.dirname(packageFile), { recursive: true });
    await writeFile(packageFile, contents);
    const recordFile = path.join(installation, ReadyUpdateFixture.RECORD_FILE);
    await mkdir(installation, { recursive: true });
    await writeFile(recordFile, JSON.stringify(new UpdateReadyRecord(version, packageFile, UpdateFeedFixture.sha512(contents), false).toJson()));
    return new ReadyUpdateFixture(packageFile, recordFile);
  }
}
