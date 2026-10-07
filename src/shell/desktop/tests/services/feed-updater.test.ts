/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FeedProvider, FeedSource, FeedUpdater, type IFeedResponse, UpdateException } from "@noldova/teamrun-shell-desktop";

import { FakeAppUpdater } from "../fixtures/fake-app-updater.fixture.js";

@TestClass
export class FeedUpdaterTests {
  private static readonly SOURCE: FeedSource = new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage",
    (): Promise<IFeedResponse> => Promise.reject(new Error("offline")));

  @TestMethod
  public setsTheUpdaterUpToCheckOnlyAndOfferOnlyReleases(): void {
    const app = new FakeAppUpdater();

    new FeedUpdater(app, FeedUpdaterTests.SOURCE, "/installations/1/update-config.json", "CN=Noldova", "teamrun", () => undefined);

    Assert.areEqual(JSON.stringify([false, false, false, false, true, true]),
      JSON.stringify([app.autoDownload, app.autoInstallOnAppQuit, app.allowDowngrade, app.allowPrerelease, app.disableDifferentialDownload, app.disableWebInstaller]));
    Assert.isTrue(app.isUpdateSupported(FakeAppUpdater.info("1.3.0")) === true);
    Assert.isTrue(app.isUpdateSupported(FakeAppUpdater.info("1.3.0-beta.1")) === false);
    Assert.isNull(app.updateConfigPath);
    Assert.isNull(app.feed);
  }

  @TestMethod
  public setsTheFeedAfterItsSettingsFileSinceSettingTheFileDropsTheFeed(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, join(folder, "update-config.json"), "CN=Noldova", "teamrun", () => undefined);

      await updater.checkAsync();

      Assert.areEqual("custom", app.feed?.provider);
      Assert.areEqual(FeedProvider, app.feed?.updateProvider);
      Assert.areEqual(FeedUpdaterTests.SOURCE, app.feed?.source);
    });
  }

  @TestMethod
  public recordsTheUpdatersWarningsAndErrorsButNotItsInformation(): void {
    const app = new FakeAppUpdater();
    const lines: string[] = [];

    new FeedUpdater(app, FeedUpdaterTests.SOURCE, "/installations/1/update-config.json", "CN=Noldova", "teamrun", t => lines.push(t));
    app.logger?.info("Checking for update");
    app.logger?.warn("Ignoring signature validation");
    app.logger?.error(new Error("socket hang up"));

    Assert.areEqual(JSON.stringify(["The updater reported: Ignoring signature validation", "The updater reported: Error: socket hang up"]), JSON.stringify(lines));
  }

  @TestMethod
  public writesItsSettingsBeforeTheFirstCheckOnlyAndGivesTheNewerVersion(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const file = join(folder, "installations", "1", "update-config.json");
      const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, file, "CN=Noldova", "teamrun", () => undefined);
      app.check = () => Promise.resolve({ isUpdateAvailable: true, updateInfo: FakeAppUpdater.info("1.3.0") });

      const found = await updater.checkAsync();
      await writeFile(file, "changed");
      app.check = () => Promise.resolve({ isUpdateAvailable: false, updateInfo: FakeAppUpdater.info("1.2.0") });
      const upToDate = await updater.checkAsync();
      app.check = () => Promise.resolve(null);
      const inactive = await updater.checkAsync();

      Assert.areEqual("1.3.0", found);
      Assert.isNull(upToDate);
      Assert.isNull(inactive);
      Assert.areEqual(file, app.configWhenChecked);
      Assert.areEqual("changed", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public writesTheSettingsThePublisherCheckAndTheCacheRead(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const file = join(folder, "update-config.json");

      await new FeedUpdater(app, FeedUpdaterTests.SOURCE, file, "CN=Noldova, O=Noldova", "teamrun", () => undefined).checkAsync();

      Assert.areEqual(JSON.stringify({ publisherName: ["CN=Noldova, O=Noldova"], updaterCacheDirName: "teamrun-updater" }), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public givesEachCheckFailureItsReason(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, join(folder, "update-config.json"), "CN=Noldova", "teamrun", () => undefined);
      const own = new UpdateException("The update feed answered with HTTP status 404.");
      const coded = Object.assign(new Error("Cannot parse"), { code: "ERR_UPDATER_INVALID_UPDATE_INFO" });

      app.check = () => Promise.reject(own);
      const first = await Assert.throwsAsync(() => updater.checkAsync(), UpdateException);
      app.check = () => Promise.reject(coded);
      const second = await Assert.throwsAsync(() => updater.checkAsync(), UpdateException);
      app.check = () => Promise.reject(new Error("net::ERR_CONNECTION_RESET"));
      const third = await Assert.throwsAsync(() => updater.checkAsync(), UpdateException);
      app.check = () => Promise.reject("refused");
      const fourth = await Assert.throwsAsync(() => updater.checkAsync(), UpdateException);

      Assert.areEqual(own, first);
      Assert.areEqual("The release's information is invalid.", second.message);
      Assert.areEqual(coded, second.cause);
      Assert.areEqual("TeamRun couldn't reach its update feed.", third.message);
      Assert.areEqual("TeamRun couldn't reach its update feed.", fourth.message);
    });
  }

  @TestMethod
  public async reportsTheDownloadsWholePercentagesAndGivesItsFile(): Promise<void> {
    const app = new FakeAppUpdater();
    const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, "/installations/1/update-config.json", "CN=Noldova", "teamrun", () => undefined);
    const progress: number[] = [];
    app.download = () => {
      app.listener?.(FakeAppUpdater.progress(12.7));
      app.listener?.(FakeAppUpdater.progress(100));
      return Promise.resolve(["/cache/TeamRun-linux-x64.AppImage"]);
    };

    const file = await updater.downloadAsync(t => progress.push(t));

    Assert.areEqual("/cache/TeamRun-linux-x64.AppImage", file);
    Assert.areEqual(JSON.stringify([12, 100]), JSON.stringify(progress));
    Assert.isNull(app.listener);
  }

  @TestMethod
  public async givesEachDownloadFailureItsReasonAndStopsListening(): Promise<void> {
    const app = new FakeAppUpdater();
    const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, "/installations/1/update-config.json", "CN=Noldova", "teamrun", () => undefined);
    const reasons: string[] = [];

    for (const code of ["ERR_CHECKSUM_MISMATCH", "ERR_UPDATER_INVALID_SIGNATURE", "ERR_UPDATER_NO_CHECKSUM"]) {
      app.download = () => Promise.reject(Object.assign(new Error(code), { code }));
      reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);
    }
    app.download = () => Promise.reject(new Error("net::ERR_NETWORK_CHANGED"));
    reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);
    app.download = () => Promise.resolve([]);
    reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);

    Assert.areEqual(JSON.stringify([
      "The download doesn't match the release.",
      "The update isn't signed by the publisher.",
      "The release's information is invalid.",
      "The download was interrupted.",
      "The download was interrupted."
    ]), JSON.stringify(reasons));
    Assert.isNull(app.listener);
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-feed-updater-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
