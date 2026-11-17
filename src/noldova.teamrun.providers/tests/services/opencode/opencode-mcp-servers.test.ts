/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OpencodeMcpServers } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class OpencodeMcpServersTests {
  @TestMethod
  public readsTheManagedFolderOfEachSystemLastOrTheOneOpencodesOwnVariableNames(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const work = directory.resolve("work");
    mkdirSync(join(work, ".git"), { recursive: true });
    const managed = (environment: NodeJS.ProcessEnv, platform: string): string => OpencodeMcpServers.files({ HOME: home, USERPROFILE: home, ...environment }, work, platform)
      .slice(-2).join(",");
    const of = (folder: string): string => [join(folder, "opencode.json"), join(folder, "opencode.jsonc")].join(",");

    Assert.areEqual(of("/Library/Application Support/opencode"), managed({}, "darwin"));
    Assert.areEqual(of(join("D:\\Data", "opencode")), managed({ ProgramData: "D:\\Data" }, "win32"));
    Assert.areEqual(of(join("C:\\ProgramData", "opencode")), managed({ ProgramData: " " }, "win32"));
    Assert.areEqual(of("/etc/opencode"), managed({}, "linux"));
    Assert.areEqual(of(resolve(work, "managed")), managed({ OPENCODE_TEST_MANAGED_CONFIG_DIR: "managed" }, "linux"));
  }

  @TestMethod
  public resolvesARelativeConfigFileAndFolderAgainstTheLaunchsFolderAsOpencodeDoes(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const work = directory.resolve("work");
    mkdirSync(join(work, ".git"), { recursive: true });

    const files = OpencodeMcpServers.files({ HOME: home, USERPROFILE: home, OPENCODE_CONFIG: "own.json", OPENCODE_CONFIG_DIR: "folder" }, work, "linux");

    Assert.isTrue(files.includes(resolve(work, "own.json")));
    Assert.isTrue(files.includes(resolve(work, "folder", "opencode.json")));
    Assert.isTrue(files.includes(resolve(work, "folder", "opencode.jsonc")));
    Assert.isFalse(files.includes("own.json"));
  }

  @TestMethod
  public namesTheServersAManagedFileNamesBesideThePersons(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const work = directory.resolve("work");
    mkdirSync(join(work, ".git"), { recursive: true });
    mkdirSync(directory.resolve("managed"), { recursive: true });
    mkdirSync(directory.resolve("config", "opencode"), { recursive: true });
    writeFileSync(directory.resolve("managed", "opencode.jsonc"), `{ "mcp": { "organization": { "type": "remote", "url": "https://example.com/mcp" }, }, }`);
    writeFileSync(directory.resolve("config", "opencode", "opencode.json"), JSON.stringify({ mcp: { docs: {} } }));

    const names = OpencodeMcpServers.names({ HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: directory.resolve("config"),
      OPENCODE_TEST_MANAGED_CONFIG_DIR: directory.resolve("managed") }, work);

    Assert.areEqual("docs,organization", names.join(","));
  }
}
