/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateInfo } from "electron-updater";
import { ElectronHttpExecutor } from "electron-updater/out/electronHttpExecutor.js";
import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FeedProvider, FeedSource, type IFeedResponse, UpdateException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class FeedProviderTests {
  private static readonly FEED: string = "https://github.test/noldova/teamrun/releases/latest/download/";
  private static readonly RELEASE: string = "https://objects.github.test/releases/v1.3.0/latest-linux-x64.yml";
  private static readonly OPTIONS: ProviderRuntimeOptions = { isUseMultipleRangeRequest: false, platform: "linux", executor: new ElectronHttpExecutor() };
  private static readonly INFO: string = [
    "version: 1.3.0",
    "files:",
    "  - url: TeamRun-linux-x64.AppImage",
    "    sha512: c2hh",
    "    size: 1024",
    "path: TeamRun-linux-x64.AppImage",
    "sha512: c2hh",
    "releaseDate: '2026-10-06T00:00:00.000Z'"
  ].join("\n");

  @TestMethod
  public readsTheTargetsInformationAndGivesItsPackageFromTheReleaseThatAnswered(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(FeedProviderTests.INFO) }, async (provider, requested) => {
      const info = await provider.getLatestVersion();
      const files = provider.resolveFiles(info);

      Assert.areEqual(JSON.stringify([`${FeedProviderTests.FEED}latest-linux-x64.yml`]), JSON.stringify(requested));
      Assert.areEqual("1.3.0", info.version);
      Assert.areEqual(1, files.length);
      Assert.areEqual("https://objects.github.test/releases/v1.3.0/TeamRun-linux-x64.AppImage", files[0]?.url.href);
      Assert.areEqual("c2hh", files[0]?.info.sha512);
    });
  }

  @TestMethod
  public resolvesThePackageAgainstTheFeedWhenTheResponseNamesNoUrl(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: "", text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      const files = provider.resolveFiles(await provider.getLatestVersion());

      Assert.areEqual(`${FeedProviderTests.FEED}TeamRun-linux-x64.AppImage`, files[0]?.url.href);
    });
  }

  @TestMethod
  public async saysTheFeedIsUnreachableWhenTheFetchFails(): Promise<void> {
    const cause = new Error("net::ERR_NAME_NOT_RESOLVED");
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", () => Promise.reject(cause));
    const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

    const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException);

    Assert.areEqual("TeamRun couldn't reach its update feed.", failure.message);
    Assert.areEqual(cause, failure.cause);
  }

  @TestMethod
  public async givesUpOnAFeedThatDoesNotAnswerInTime(): Promise<void> {
    const signals: unknown[] = [];
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", (_, signal) => {
      signals.push(signal);
      return Promise.reject(timeout);
    });
    const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

    const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException);

    Assert.areEqual("TeamRun couldn't reach its update feed.", failure.message);
    Assert.areEqual(timeout, failure.cause);
    Assert.isTrue(signals[0] instanceof AbortSignal);
    Assert.isTrue(signals[0] instanceof AbortSignal && !signals[0].aborted);
  }

  @TestMethod
  public saysTheFeedIsUnreachableWhenItsAnswerBreaksOff(): Promise<void> {
    const cause = new Error("terminated");
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.reject(cause) }, async provider => {
      const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException);

      Assert.areEqual("TeamRun couldn't reach its update feed.", failure.message);
      Assert.areEqual(cause, failure.cause);
    });
  }

  @TestMethod
  public refusesARedirectToAnotherProtocol(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: "http://objects.github.test/releases/v1.3.0/latest-linux-x64.yml", text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      Assert.areEqual("The update feed redirected to an address with another protocol.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException)).message);
    });
  }

  @TestMethod
  public saysWhichStatusTheFeedRefusedWith(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: false, status: 404, url: FeedProviderTests.RELEASE, text: () => Promise.resolve("Not Found") }, async provider => {
      Assert.areEqual("The update feed answered with HTTP status 404.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException)).message);
    });
  }

  @TestMethod
  public async refusesInformationThatIsNotYamlOrLacksAVersionFilesOrAWholePackage(): Promise<void> {
    const texts = [
      "version: [1.3.0",
      "",
      "version: 1.3.0",
      "version: 13\nfiles: []",
      "version: 1.3.0\nfiles: []",
      "version: 1.3.0\nfiles:\n  - TeamRun-linux-x64.AppImage",
      "version: 1.3.0\nfiles:\n  - url: TeamRun-linux-arm64.AppImage\n    sha512: c2hh\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: TeamRun-linux-x64.AppImage\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: TeamRun-linux-x64.AppImage\n    sha512: ''\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: TeamRun-linux-x64.AppImage\n    sha512: c2hh\n    size: 10.5",
      "version: 1.3.0\nfiles:\n  - url: TeamRun-linux-x64.AppImage\n    sha512: c2hh\n    size: 0"
    ];

    for (const text of texts)
      await FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(text) }, async provider => {
        Assert.areEqual("The release's information is invalid.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateException)).message, text);
      });
  }

  @TestMethod
  public givesNoPackageBeforeAReadOrForInformationWithoutIt(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      const other: UpdateInfo = { version: "1.3.0", files: [], path: "TeamRun-linux-x64.AppImage", sha512: "c2hh", releaseDate: "2026-10-06T00:00:00.000Z" };

      const before = Assert.throws(() => provider.resolveFiles(other), UpdateException);
      await provider.getLatestVersion();

      Assert.areEqual("The release's information is invalid.", before.message);
      Assert.areEqual("The release's information is invalid.", Assert.throws(() => provider.resolveFiles(other), UpdateException).message);
    });
  }

  @TestMethod
  public refusesOptionsWithoutASource(): void {
    Assert.areEqual("source", Assert.throws(() => new FeedProvider({ source: "https://example.test/" }, null, FeedProviderTests.OPTIONS), ArgumentException).parameterName);
  }

  private static async withAnswerAsync(response: IFeedResponse, run: (provider: FeedProvider, requested: string[]) => Promise<void>): Promise<void> {
    const requested: string[] = [];
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", url => {
      requested.push(url);
      return Promise.resolve(response);
    });
    await run(new FeedProvider({ source }, null, FeedProviderTests.OPTIONS), requested);
  }
}
