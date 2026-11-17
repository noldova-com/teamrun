/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, pbkdf2 } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ReleaseDownload, ReleaseFile, ReleaseSourceException, Resources } from "@noldova/teamrun.providers";

import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const body = Buffer.from("a release's program");
const sha256 = createHash("sha256").update(body).digest("hex");

@TestClass
export class ReleaseDownloadTests {
  @TestMethod
  public savesAFileOfAPublishedSizeOfTheSizeTheServerSendsOrOfNoSizeCheckingItsSha256(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      server.serve("/unsized", body, 200, false);
      const cases: readonly [string, number | null][] = [["/program", body.length], ["/program", null], ["/unsized", null]];
      for (const [file, bytes] of cases) {
        const progress: number[][] = [];
        const path = directory.resolve(`program${file.slice(1)}-${bytes}`);

        await ReleaseDownload.save(new ReleaseFile(server.url(file), sha256, bytes), path, "Claude Code", (received, total) => progress.push([received, total]),
          new AbortController().signal);

        Assert.areEqual(body.toString(), readFileSync(path, "utf8"));
        Assert.areEqual(JSON.stringify([body.length, body.length]), JSON.stringify(progress.at(-1)), `${file} ${bytes}`);
      }
      Assert.areEqual("/program identity,/program identity,/unsized identity", server.requests.join(","));
    });
  }

  @TestMethod
  public refusesADownloadThatFailsItsChecksOrIsntThere(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      const cases: readonly [ReleaseFile, string][] = [
        [new ReleaseFile(server.url("/program"), "0".repeat(64), null), Resources.formatDownloadMismatch("Claude Code")],
        [new ReleaseFile(server.url("/program"), sha256, body.length - 1), Resources.formatDownloadMismatch("Claude Code")],
        [new ReleaseFile(server.url("/program"), sha256, body.length + 1), Resources.formatDownloadMismatch("Claude Code")],
        [new ReleaseFile(server.url("/missing"), sha256, null), Resources.formatDownloadFailed("Claude Code", 404)],
        [new ReleaseFile(server.url("/empty"), sha256, null), Resources.formatDownloadFailed("Claude Code", 204)]
      ];
      for (const [index, [file, message]] of cases.entries()) {
        const failure = await Assert.throwsAsync(() => ReleaseDownload.save(file, directory.resolve(`program-${index}`), "Claude Code", () => undefined,
          new AbortController().signal), Error);
        Assert.areEqual(message, failure.message, String(index));
      }
      Assert.areEqual("The Claude Code download failed its size or SHA-256 check. Nothing was installed.", Resources.formatDownloadMismatch("Claude Code"));
      Assert.areEqual("Downloading Claude Code failed with HTTP status 404. Nothing was installed.", Resources.formatDownloadFailed("Claude Code", 404));
    });
  }

  @TestMethod
  public saysTheReleasesCantBeReachedWhenTheirServerIsntThereOrTheConnectionDropsMidDownload(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      server.cut("/cut", body);
      const cases: readonly [string, string][] = [["closed", "http://localhost:1/program"], ["cut", server.url("/cut")]];
      for (const [name, url] of cases) {
        const failure = await Assert.throwsAsync(() => ReleaseDownload.save(new ReleaseFile(url, sha256, null), directory.resolve(`program-${name}`), "Claude Code",
          () => undefined, new AbortController().signal), Error);
        Assert.areEqual(Resources.formatReleasesUnreachable("Claude Code"), failure.message, name);
        Assert.isInstanceOf(failure.cause, TypeError);
      }
      Assert.areEqual("TeamRun couldn't reach Claude Code's releases, or lost the connection while it downloaded one. Check the network connection and try again. "
        + "Nothing was installed.", Resources.formatReleasesUnreachable("Claude Code"));
    });
  }

  @TestMethod
  public stopsADownloadOfNoPublishedSizeOncePastItsLimitOf1GiBUnlessGivenAnother(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      const failure = await Assert.throwsAsync(() => ReleaseDownload.save(new ReleaseFile(server.url("/program"), sha256, null), directory.resolve("over"), "Claude Code",
        () => undefined, new AbortController().signal, body.length - 1), Error);

      await ReleaseDownload.save(new ReleaseFile(server.url("/program"), sha256, null), directory.resolve("at"), "Claude Code", () => undefined,
        new AbortController().signal, body.length);

      Assert.areEqual(Resources.formatDownloadTooLarge("Claude Code", body.length - 1), failure.message);
      Assert.areEqual(body.toString(), readFileSync(directory.resolve("at"), "utf8"));
      Assert.areEqual(1024 * 1024 * 1024, Resources.releaseDownloadLimit);
      Assert.areEqual("The Claude Code download was larger than 18 bytes, more than any release TeamRun installs, so it was stopped. Nothing was installed.",
        Resources.formatDownloadTooLarge("Claude Code", 18));
    });
  }

  @TestMethod
  public savesAFileThatListsNoHashFromASafeAddress(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      await ReleaseDownload.save(new ReleaseFile(server.url("/program"), null, null), directory.resolve("program"), "Agent", () => undefined, new AbortController().signal);

      Assert.areEqual(body.toString(), readFileSync(directory.resolve("program"), "utf8"));
    });
  }

  @TestMethod
  public stopsAFileThatListsNoHashWhenItsAnswerLeftHttpsButKeepsOneItCanCheck(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (_, directory) => {
      const fetching = globalThis.fetch;
      globalThis.fetch = (): Promise<Response> => Promise.resolve(Object.defineProperty(new Response(body), "url", { value: "http://example.com/program" }));
      try {
        const failure = await Assert.throwsAsync(() => ReleaseDownload.save(new ReleaseFile("https://example.com/program", null, null), directory.resolve("insecure"), "Agent",
          () => undefined, new AbortController().signal), Error);
        await ReleaseDownload.save(new ReleaseFile("https://example.com/program", sha256, null), directory.resolve("checked"), "Agent", () => undefined, new AbortController().signal);

        Assert.areEqual(Resources.formatDownloadInsecure("Agent"), failure.message);
        Assert.isFalse(existsSync(directory.resolve("insecure")));
        Assert.areEqual(body.toString(), readFileSync(directory.resolve("checked"), "utf8"));
      }
      finally {
        globalThis.fetch = fetching;
      }
    });
  }

  @TestMethod
  public leavesNoFileOnceADownloadFailsEvenWhileTheThreadPoolIsBusy(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      server.cut("/cut", body);
      const cases: readonly [string, ReleaseFile, boolean][] = [
        ["cut", new ReleaseFile(server.url("/cut"), sha256, null), false],
        ["cut while busy", new ReleaseFile(server.url("/cut"), sha256, null), true],
        ["closed", new ReleaseFile("http://localhost:1/program", sha256, null), false],
        ["missing", new ReleaseFile(server.url("/missing"), sha256, null), false],
        ["mismatch", new ReleaseFile(server.url("/program"), "0".repeat(64), null), false],
        ["larger than published", new ReleaseFile(server.url("/program"), sha256, body.length - 1), true]
      ];
      for (const [name, file, busy] of cases) {
        const path = directory.resolve(name);
        const pool = busy ? Array.from({ length: 4 }, () => promisify(pbkdf2)("password", "salt", 20000, 32, "sha256")) : [];

        await Assert.throwsAsync(() => ReleaseDownload.save(file, path, "Claude Code", () => undefined, new AbortController().signal), Error);
        const there = existsSync(path);
        await Promise.all(pool);

        Assert.isFalse(there, name);
        Assert.isFalse(existsSync(path), name);
      }
    });
  }

  @TestMethod
  public throwsAReleaseSourceExceptionWithTheDownloadsFailureAndTheCleanUpsWhenItsFileCantBeRemoved(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      const path = directory.resolve("program");
      const moved = directory.resolve("moved");

      const failure = await Assert.throwsAsync(() => ReleaseDownload.save(new ReleaseFile(server.url("/program"), "0".repeat(64), null), path, "Claude Code", () => {
        if (existsSync(moved))
          return;
        renameSync(path, moved);
        mkdirSync(path);
      }, new AbortController().signal), ReleaseSourceException);
      const cleanup = failure.cause;

      Assert.areEqual(Resources.formatDownloadMismatch("Claude Code"), failure.message);
      Assert.isInstanceOf(cleanup, SuppressedError);
      Assert.areEqual(Resources.formatDownloadMismatch("Claude Code"), cleanup instanceof SuppressedError ? (cleanup.suppressed as Error).message : null);
      Assert.areEqual("ERR_FS_EISDIR", cleanup instanceof SuppressedError ? (cleanup.error as NodeJS.ErrnoException).code : null);
      Assert.isTrue(statSync(path).isDirectory());
      Assert.areEqual(body.toString(), readFileSync(moved, "utf8"));
    });
  }

  @TestMethod
  public async closesAStreamAndRejectsWithItsErrorWhenItsCloseFailsButNotWithTheErrorItWasDestroyedWith(): Promise<void> {
    const output = new Writable({ write: (_chunk, _encoding, callback) => callback(), destroy: (_error, callback) => callback(new Error("close failed")) });
    const cut = new Writable({ write: (_chunk, _encoding, callback) => callback(), destroy: (error, callback) => setImmediate(() => callback(error)) });
    const seen: string[] = [];
    cut.on("error", error => seen.push(error.message));

    const failure = await Assert.throwsAsync(() => ReleaseDownload.close(output), Error);
    await ReleaseDownload.close(output);
    cut.destroy(new Error("cut"));
    await ReleaseDownload.close(cut);

    Assert.areEqual("close failed", failure.message);
    Assert.isTrue(output.closed);
    Assert.areEqual("cut", seen.join(","));
    Assert.isTrue(cut.closed);
  }

  @TestMethod
  public neverWritesOverAFileThatIsAlreadyThere(): Promise<void> {
    return ReleaseDownloadTests.withServer(async (server, directory) => {
      const path = directory.resolve("program");
      writeFileSync(path, "kept");

      await Assert.throwsAsync(() => ReleaseDownload.save(new ReleaseFile(server.url("/program"), sha256, null), path, "Claude Code", () => undefined,
        new AbortController().signal), Error);

      Assert.isTrue(existsSync(path));
      Assert.areEqual("kept", readFileSync(path, "utf8"));
    });
  }

  private static async withServer(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/program", body).serve("/empty", Buffer.alloc(0), 204);
    await test(server, directory);
  }
}
