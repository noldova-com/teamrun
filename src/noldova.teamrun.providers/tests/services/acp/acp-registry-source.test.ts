/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpRegistryException, AcpRegistrySource, Resources } from "@noldova/teamrun.providers";

import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const HOUR = 3_600_000;

const index = (...ids: readonly string[]): string => JSON.stringify({ agents: ids.map(t => ({ id: t, name: t, version: "1.0.0",
  distribution: { npx: { package: `${t}@1.0.0` } } })) });

@TestClass
export class AcpRegistrySourceTests {
  @TestMethod
  public fetchesTheListAndKeepsItInItsFile(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from(index("devin", "droid")));
      const file = directory.resolve("registry", "registry.json");

      const listing = await new AcpRegistrySource(server.url("/registry.json"), file, HOUR, 5_000).readAsync();

      Assert.areEqual("devin,droid", listing.registry.agents.map(t => t.id).join(","));
      Assert.isNull(listing.failure);
      Assert.areEqual(index("devin", "droid"), readFileSync(file, "utf8"));
      Assert.areEqual("/registry.json", server.requests.map(t => t.split(" ")[0]).join(","));
    });
  }

  @TestMethod
  public showsAFetchedListItCantKeep(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from(index("devin")));
      const blocker = directory.resolve("blocker");
      writeFileSync(blocker, "a file where the folder would be");
      const taken = directory.resolve("taken");
      mkdirSync(taken);
      writeFileSync(join(taken, "kept.txt"), "a folder where the file would be");

      for (const file of [join(blocker, "registry.json"), taken]) {
        const listing = await new AcpRegistrySource(server.url("/registry.json"), file, HOUR, 5_000).readAsync();

        Assert.areEqual("devin", listing.registry.agents.map(t => t.id).join(","), file);
        Assert.isNull(listing.failure, file);
      }
      Assert.areEqual("a file where the folder would be", readFileSync(blocker, "utf8"));
      Assert.areEqual("blocker,taken", readdirSync(directory.path).sort().join(","));
      Assert.areEqual("kept.txt", readdirSync(taken).join(","));
    });
  }

  @TestMethod
  public usesTheKeptListWhileItIsYoungerThanTheMaximumAgeAndFetchesAgainAfter(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from(index("fresh")));
      const file = directory.resolve("registry.json");
      writeFileSync(file, index("kept"));
      const written = new Date(Math.floor(Date.now() / 1_000) * 1_000);
      utimesSync(file, written, written);
      let now = written.getTime() + 1;
      const source = new AcpRegistrySource(server.url("/registry.json"), file, HOUR, 5_000, () => now);

      const young = await source.readAsync();
      now += HOUR + 1;
      const old = await source.readAsync();

      Assert.areEqual("kept", young.registry.agents.map(t => t.id).join(","));
      Assert.areEqual("fresh", old.registry.agents.map(t => t.id).join(","));
      Assert.areEqual(1, server.requests.length);
      Assert.areEqual(index("fresh"), readFileSync(file, "utf8"));
      Assert.areEqual(now, old.fetchedAt.getTime());
    });
  }

  @TestMethod
  public showsTheKeptListWithTheFailureWhenADueFetchFailsOrCantBeRead(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/unreadable.json", Buffer.from("not json"));
      const large = index("large");
      const oversized = Buffer.from(`${large.slice(0, -1)}, "padding": "${"x".repeat(Resources.acpRegistryMaxBytes)}"}`);
      server.serve("/large.json", oversized);
      server.serve("/unsized.json", oversized, 200, false);
      server.serve("/empty.json", Buffer.alloc(0), 204);
      server.cut("/cut.json", Buffer.from(index("cut")));
      server.redirect("/moved.json", server.url("/unreadable.json"));
      const file = directory.resolve("registry.json");
      writeFileSync(file, index("kept"));
      const written = new Date(Math.floor((Date.now() - 2 * HOUR) / 1_000) * 1_000);
      utimesSync(file, written, written);
      const cases: readonly [string, string][] = [["/missing.json", Resources.formatAcpRegistryFailed(404)], ["/unreadable.json", Resources.acpRegistryUnreadable],
        ["/large.json", Resources.acpRegistryUnreadable], ["/unsized.json", Resources.acpRegistryUnreadable], ["/empty.json", Resources.acpRegistryUnreadable],
        ["/cut.json", Resources.acpRegistryUnreachable], ["/moved.json", Resources.formatAcpRegistryFailed(302)]];
      for (const [path, failure] of cases) {
        const listing = await new AcpRegistrySource(server.url(path), file, HOUR, 5_000).readAsync();

        Assert.areEqual("kept", listing.registry.agents.map(t => t.id).join(","), path);
        Assert.areEqual(failure, listing.failure, path);
        Assert.areEqual(written.getTime(), Math.round(listing.fetchedAt.getTime() / 1_000) * 1_000, path);
        Assert.areEqual(index("kept"), readFileSync(file, "utf8"), path);
      }
    });
  }

  @TestMethod
  public stopsReadingAnAnswerThatNeverEndsAtTheLimitAndClosesIt(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      const closed = server.endless("/endless.json", Buffer.alloc(64 * 1024, "x"));

      const failure = await Assert.throwsAsync(() => new AcpRegistrySource(server.url("/endless.json"), directory.resolve("registry.json"), HOUR, 5_000).readAsync(), AcpRegistryException);
      await closed;

      Assert.areEqual(Resources.acpRegistryUnreadable, failure.message);
    });
  }

  @TestMethod
  public fetchesAgainWhenTheKeptListIsDatedAfterNow(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from(index("fresh")));
      const file = directory.resolve("registry.json");
      writeFileSync(file, index("kept"));
      const ahead = new Date(Date.now() + 2 * HOUR);
      utimesSync(file, ahead, ahead);

      const listing = await new AcpRegistrySource(server.url("/registry.json"), file, HOUR, 5_000).readAsync();

      Assert.areEqual("fresh", listing.registry.agents.map(t => t.id).join(","));
      Assert.areEqual(index("fresh"), readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  public refusesAnAddressThatIsntHttpsOrThisComputersLoopback(): void {
    for (const url of ["http://example.com/registry.json", "http://10.0.0.1/registry.json", "ftp://example.com/registry.json", "file:///registry.json", "not a url"]) {
      const error = Assert.throws(() => new AcpRegistrySource(url, "registry.json", HOUR, 5_000), ArgumentException);
      Assert.areEqual(Resources.acpRegistryUrlParameter, error.parameterName, url);
      Assert.isTrue(error.message.includes(Resources.acpRegistryUrlRefused), url);
    }
    for (const url of [Resources.acpRegistryUrl, "http://localhost:8080/registry.json", "http://127.0.0.1/registry.json", "http://[::1]:9/registry.json"])
      Assert.isNotNull(new AcpRegistrySource(url, "registry.json", HOUR, 5_000), url);
  }

  @TestMethod
  public failsWhenTheFetchFailsAndNoReadableListIsKept(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/unreadable.json", Buffer.from("{}"));
      const kept = directory.resolve("kept.json");
      writeFileSync(kept, "not json");
      const cases: readonly [string, string, string][] = [["/missing.json", directory.resolve("none.json"), Resources.formatAcpRegistryFailed(404)],
        ["/unreadable.json", kept, Resources.acpRegistryUnreadable]];
      for (const [path, file, failure] of cases) {
        const error = await Assert.throwsAsync(() => new AcpRegistrySource(server.url(path), file, HOUR, 5_000).readAsync(), Error);

        Assert.areEqual(failure, error.message, path);
      }
      Assert.isFalse(existsSync(directory.resolve("none.json")));
      Assert.areEqual("not json", readFileSync(kept, "utf8"));
    });
  }

  @TestMethod
  public failsAsUnreachableWhenTheRegistryCantBeReached(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      const url = server.url("/registry.json");
      await server[Symbol.asyncDispose]();

      const error = await Assert.throwsAsync(() => new AcpRegistrySource(url, directory.resolve("registry.json"), HOUR, 5_000).readAsync(), AcpRegistryException);

      Assert.areEqual(Resources.acpRegistryUnreachable, error.message);
    });
  }

  @TestMethod
  public sharesOneFetchBetweenReadsAtTheSameTime(): Promise<void> {
    return AcpRegistrySourceTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from(index("devin")));
      mkdirSync(directory.resolve("cache"));
      const source = new AcpRegistrySource(server.url("/registry.json"), directory.resolve("cache", "registry.json"), HOUR, 5_000);

      const [first, second] = await Promise.all([source.readAsync(), source.readAsync()]);

      Assert.areEqual(first, second);
      Assert.areEqual(1, server.requests.length);
    });
  }

  private static async withServer(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }
}
