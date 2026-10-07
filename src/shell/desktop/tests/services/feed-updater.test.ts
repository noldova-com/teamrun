/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CancellationToken } from "electron-updater";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FeedProvider, FeedSource, FeedUpdater, type IFeedResponse, UpdateException } from "@noldova/teamrun-shell-desktop";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeAppUpdater } from "../fixtures/fake-app-updater.fixture.js";

@TestClass
export class FeedUpdaterTests {
  private static readonly SOURCE: FeedSource = new FeedSource("http://127.0.0.1:8080/", "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage",
    (): Promise<IFeedResponse> => Promise.reject(new Error("offline")));
  private static readonly INSTALLATION: string = join("/devices", "installations", "0123456789abcdef");
  private static readonly PACKAGE: string = join("/cache", "teamrun-updater-0123456789abcdef", "pending", "TeamRun-linux-x64.AppImage");

  @TestMethod
  public setsTheUpdaterUpToCheckOnlyAndOfferOnlyReleases(): void {
    const app = new FakeAppUpdater();

    const updater = FeedUpdaterTests.create(app);

    Assert.areEqual(JSON.stringify([false, false, false, false, true, true]),
      JSON.stringify([app.autoDownload, app.autoInstallOnAppQuit, app.allowDowngrade, app.allowPrerelease, app.disableDifferentialDownload, app.disableWebInstaller]));
    Assert.isTrue(app.isUpdateSupported(FakeAppUpdater.info("1.3.0")) === true);
    Assert.isTrue(app.isUpdateSupported(FakeAppUpdater.info("1.3.0-beta.1")) === false);
    Assert.isNull(app.updateConfigPath);
    Assert.isNull(app.feed);
    Assert.areEqual(FeedUpdaterTests.PACKAGE, updater.packagePath);
  }

  @TestMethod
  public setsTheFeedAfterItsSettingsFileSinceSettingTheFileDropsTheFeed(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();

      await FeedUpdaterTests.create(app, folder).checkAsync();

      Assert.areEqual("custom", app.feed?.provider);
      Assert.areEqual(FeedProvider, app.feed?.updateProvider);
      Assert.areEqual(FeedUpdaterTests.SOURCE, app.feed?.source);
    });
  }

  @TestMethod
  public recordsTheUpdatersWarningsAndErrorsButNotItsInformation(): void {
    const app = new FakeAppUpdater();
    const lines: string[] = [];

    new FeedUpdater(app, FeedUpdaterTests.SOURCE, FeedUpdaterTests.INSTALLATION, "/cache", "teamrun", null, t => lines.push(t));
    app.logger?.info("Checking for update");
    app.logger?.warn("Ignoring signature validation");
    app.logger?.error(new Error("socket hang up"));

    Assert.areEqual(JSON.stringify(["The updater reported: Ignoring signature validation", "The updater reported: Error: socket hang up"]), JSON.stringify(lines));
  }

  @TestMethod
  public writesItsSettingsBeforeTheFirstCheckOnlyAndGivesTheNewerVersion(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const installation = join(folder, "installations", "0123456789abcdef");
      const file = join(installation, "update-config.json");
      const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, installation, "/cache", "teamrun", null, () => undefined);
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
  public namesTheCacheAfterTheProductAndTheInstallationAndLeavesThePublisherOut(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const installation = join(folder, "0123456789abcdef");

      await new FeedUpdater(new FakeAppUpdater(), FeedUpdaterTests.SOURCE, installation, "/cache", "teamrun", null, () => undefined).checkAsync();

      Assert.areEqual(JSON.stringify({ updaterCacheDirName: "teamrun-updater-0123456789abcdef" }), await readFile(join(installation, "update-config.json"), "utf8"));
    });
  }

  @TestMethod
  public givesEachCheckFailureItsReason(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const updater = FeedUpdaterTests.create(app, folder);
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
      Assert.areEqual("The update stopped on an unexpected error.", third.message);
      Assert.areEqual("The update stopped on an unexpected error.", fourth.message);
    });
  }

  @TestMethod
  public saysASettingsFileItCannotWriteIsUnexpected(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const blocked = join(folder, "file");
      await writeFile(blocked, "");

      const failure = await Assert.throwsAsync(() => FeedUpdaterTests.create(new FakeAppUpdater(), join(blocked, "installation")).checkAsync(), UpdateException);

      Assert.areEqual("The update stopped on an unexpected error.", failure.message);
    });
  }

  @TestMethod
  public async reportsTheDownloadsWholePercentagesAndGivesItsFile(): Promise<void> {
    const app = new FakeAppUpdater();
    const updater = FeedUpdaterTests.create(app);
    const progress: number[] = [];
    app.download = () => {
      app.listener?.(FakeAppUpdater.progress(12.7));
      app.listener?.(FakeAppUpdater.progress(100));
      return Promise.resolve([FeedUpdaterTests.PACKAGE]);
    };

    const file = await updater.downloadAsync(t => progress.push(t));

    Assert.areEqual(FeedUpdaterTests.PACKAGE, file);
    Assert.areEqual(JSON.stringify([12, 100]), JSON.stringify(progress));
    Assert.isNull(app.listener);
  }

  @TestMethod
  public async givesEachDownloadFailureItsReasonAndStopsListening(): Promise<void> {
    const app = new FakeAppUpdater();
    const updater = FeedUpdaterTests.create(app);
    const reasons: string[] = [];

    for (const code of ["ERR_CHECKSUM_MISMATCH", "ERR_UPDATER_INVALID_SIGNATURE", "ERR_UPDATER_NO_CHECKSUM"]) {
      app.download = () => Promise.reject(Object.assign(new Error(code), { code }));
      reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);
    }
    app.download = () => Promise.reject(new Error("net::ERR_NETWORK_CHANGED"));
    reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);
    app.download = () => Promise.resolve([]);
    reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);
    app.download = () => Promise.resolve([join("/cache", "elsewhere", "TeamRun-linux-x64.AppImage")]);
    reasons.push((await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException)).message);

    Assert.areEqual(JSON.stringify([
      "The download doesn't match the release.",
      "The update isn't signed by the publisher.",
      "The release's information is invalid.",
      "The download was interrupted.",
      "The download was interrupted.",
      "The update stopped on an unexpected error."
    ]), JSON.stringify(reasons));
    Assert.isNull(app.listener);
  }

  @TestMethod
  public cancelsTheDownloadInProgressOnly(): Promise<void> {
    const app = new FakeAppUpdater();
    const updater = FeedUpdaterTests.create(app);
    const tokens: CancellationToken[] = [];
    const download = Promise.withResolvers<string[]>();
    app.download = t => {
      tokens.push(t);
      return download.promise;
    };

    updater.cancel();
    const downloading = updater.downloadAsync(() => undefined);
    updater.cancel();
    const cancelled = tokens[0]?.cancelled;
    download.reject(new Error("cancelled"));

    return Assert.throwsAsync(() => downloading, UpdateException).then(failure => {
      updater.cancel();
      Assert.isTrue(cancelled === true);
      Assert.areEqual("The download was interrupted.", failure.message);
      Assert.areEqual(1, tokens.length);
    });
  }

  @TestMethod
  public checksThePublisherOfEachDownloadAndDeletesOneThatFailsOrLogsWhyItCannot(): Promise<void> {
    return FeedUpdaterTests.withFolderAsync(async folder => {
      const app = new FakeAppUpdater();
      const checked: string[] = [];
      const lines: string[] = [];
      let failure: string | null = null;
      const updater = new FeedUpdater(app, FeedUpdaterTests.SOURCE, FeedUpdaterTests.INSTALLATION, folder, "teamrun", t => {
        checked.push(t);
        return Promise.resolve(failure);
      }, t => lines.push(t));
      await mkdir(join(updater.packagePath, ".."), { recursive: true });
      await writeFile(updater.packagePath, "TeamRun 1.3.0");
      app.download = () => Promise.resolve([updater.packagePath]);

      const before = updater.downloadedFile;
      const signed = await updater.downloadAsync(() => undefined);
      const kept = existsSync(signed);
      const downloaded = updater.downloadedFile;
      failure = "The signature is not the publisher's.";
      const unsigned = await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException);
      const isDeleted = !existsSync(updater.packagePath);
      await writeFile(updater.packagePath, "TeamRun 1.3.0");
      let stuck: UpdateException;
      {
        using _rm = new FailingFileCallFixture("rm", updater.packagePath, "EBUSY");
        stuck = await Assert.throwsAsync(() => updater.downloadAsync(() => undefined), UpdateException);
      }

      Assert.areEqual(updater.packagePath, signed);
      Assert.isNull(before);
      Assert.areEqual(updater.packagePath, downloaded);
      Assert.isTrue(kept);
      Assert.areEqual("The update isn't signed by the publisher.", unsigned.message);
      Assert.isTrue(isDeleted);
      Assert.areEqual("The update isn't signed by the publisher.", stuck.message);
      Assert.isTrue(existsSync(updater.packagePath));
      Assert.areEqual(1, lines.length);
      Assert.isTrue(lines[0]?.startsWith("The update that failed its publisher check could not be deleted: Error: EBUSY") === true, lines[0]);
      Assert.areEqual(JSON.stringify([updater.packagePath, updater.packagePath, updater.packagePath]), JSON.stringify(checked));
    });
  }

  private static create(app: FakeAppUpdater, folder: string = FeedUpdaterTests.INSTALLATION): FeedUpdater {
    return new FeedUpdater(app, FeedUpdaterTests.SOURCE, folder === FeedUpdaterTests.INSTALLATION ? folder : join(folder, "0123456789abcdef"), "/cache", "teamrun", null, () => undefined);
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
