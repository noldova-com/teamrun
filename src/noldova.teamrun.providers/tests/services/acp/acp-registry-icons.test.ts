/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpRegistryAgent, AcpRegistryIcons, Resources } from "@noldova/teamrun.providers";

import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const agent = (icon: string | null, version: string = "1.0.0"): AcpRegistryAgent => new AcpRegistryAgent("devin", "Devin", version, "", icon, new Map(), null, null);

@TestClass
export class AcpRegistryIconsTests {
  @TestMethod
  public keepsAnIconAsADataAddressAndReadsItBackWithoutAskingAgain(): Promise<void> {
    return AcpRegistryIconsTests.withServer(async (server, directory) => {
      const body = Buffer.from("<svg/>");
      server.serveTyped("/devin.svg", body, "image/svg+xml; charset=utf-8");
      const icons = new AcpRegistryIcons(directory.resolve("icons"), 5_000);
      const expected = `data:image/svg+xml;base64,${body.toString("base64")}`;

      Assert.areEqual(expected, await icons.readAsync(agent(server.url("/devin.svg"))));
      Assert.areEqual(expected, await icons.readAsync(agent(server.url("/devin.svg"))));

      Assert.areEqual(1, server.requests.length);
      Assert.areEqual("devin-1.0.0.icon", readdirSync(directory.resolve("icons")).join(","));
    });
  }

  @TestMethod
  public asksAgainForANewVersion(): Promise<void> {
    return AcpRegistryIconsTests.withServer(async (server, directory) => {
      server.serveTyped("/devin.png", Buffer.from("png"), "IMAGE/PNG");
      const icons = new AcpRegistryIcons(directory.resolve("icons"), 5_000);

      await icons.readAsync(agent(server.url("/devin.png")));
      await icons.readAsync(agent(server.url("/devin.png"), "2.0.0"));

      Assert.areEqual(2, server.requests.length);
    });
  }

  @TestMethod
  public hasNoIconForAnEntryWithoutOneOrAnAnswerItCantShowAndKeepsNone(): Promise<void> {
    return AcpRegistryIconsTests.withServer(async (server, directory) => {
      server.serveTyped("/page", Buffer.from("<html>"), "text/html");
      server.serve("/untyped", Buffer.from("x"));
      server.serve("/empty", Buffer.alloc(0), 204);
      server.serveTyped("/missing", Buffer.from("x"), "image/png", 404);
      server.serveTyped("/large", Buffer.alloc(Resources.acpIconMaxBytes + 1), "image/png");
      server.redirect("/moved", server.url("/large"));
      const icons = new AcpRegistryIcons(directory.resolve("icons"), 5_000);

      Assert.isNull(await icons.readAsync(agent(null)));
      for (const path of ["/page", "/untyped", "/empty", "/missing", "/large", "/moved"])
        Assert.isNull(await icons.readAsync(agent(server.url(path))), path);
      Assert.isNull(await icons.readAsync(agent("http://localhost:1/devin.svg")));

      Assert.areEqual(1, server.requests.filter(t => t.startsWith("/large")).length);
      Assert.isFalse(existsSync(directory.resolve("icons")));
    });
  }

  @TestMethod
  public keepsAnIconAtItsLimitAndShowsOneItCantKeep(): Promise<void> {
    return AcpRegistryIconsTests.withServer(async (server, directory) => {
      const body = Buffer.alloc(Resources.acpIconMaxBytes);
      server.serveTyped("/limit.webp", body, "image/webp");
      writeFileSync(directory.resolve("blocker"), "a file where the folder would be");
      const icons = new AcpRegistryIcons(directory.resolve("blocker", "icons"), 5_000);

      Assert.areEqual(`data:image/webp;base64,${body.toString("base64")}`, await icons.readAsync(agent(server.url("/limit.webp"))));
    });
  }

  private static async withServer(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }
}
