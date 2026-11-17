/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpRegistry, AcpRegistryAgent, AcpRegistryBinary, AcpRegistryException, AcpRegistryPackage, Resources } from "@noldova/teamrun.providers";

const SHA256 = "AB".repeat(32);

const agent = (id: string, distribution: object, extra: object = {}): object => ({ id, name: `Agent ${id}`, version: "1.2.3", description: `About ${id}`,
  distribution, ...extra });

@TestClass
export class AcpRegistryTests {
  @TestMethod
  public readsEachAgentsBinariesAndPackagesKeepingOnlyTheRegistrysPlatforms(): void {
    const registry = AcpRegistry.read(JSON.stringify({ version: "1.0.0", agents: [
      agent("devin", { binary: {
        "windows-x86_64": { archive: "https://example.com/devin.zip", cmd: "./bin\\devin.exe", args: ["acp"], sha256: SHA256 },
        "linux-x86_64": { archive: "https://example.com/devin.tar.gz", cmd: "./bin/devin", env: { DEVIN_MODE: "acp" } },
        "freebsd-x86_64": { archive: "https://example.com/devin-bsd.tar.gz", cmd: "devin" }
      } }, { icon: "https://example.com/devin.svg" }),
      agent("droid", { npx: { package: "droid@1.1.0", args: ["exec", "--output-format", "acp-daemon"], env: { DROID_DISABLE_AUTO_UPDATE: "true" } } },
        { icon: "http://example.com/droid.svg" }),
      agent("fast-agent", { uvx: { package: "fast-agent-acp==0.1.0" } })
    ] }));

    Assert.areEqual("devin,droid,fast-agent", registry.agents.map(t => t.id).join(","));
    Assert.areEqual(0, registry.skipped.length);
    const devin = registry.find("devin")!;
    Assert.areEqual("Agent devin|1.2.3|About devin|https://example.com/devin.svg", [devin.name, devin.version, devin.description, devin.icon].join("|"));
    Assert.areEqual("windows-x86_64,linux-x86_64", [...devin.binaries.keys()].join(","));
    const windows = devin.binaryFor("windows-x86_64")!;
    Assert.areEqual("https://example.com/devin.zip|bin,devin.exe|acp|ab".concat("ab".repeat(31)),
      [windows.archive, windows.command.join(","), windows.arguments.join(","), windows.sha256].join("|"));
    const linux = devin.binaryFor("linux-x86_64")!;
    Assert.areEqual("bin,devin||null|acp", [linux.command.join(","), linux.arguments.join(","), String(linux.sha256), linux.environment["DEVIN_MODE"]].join("|"));
    const command = windows.commandIn(join("agents", "devin", "1.2.3"));
    Assert.areEqual(`${join("agents", "devin", "1.2.3", "bin", "devin.exe")}|acp`, `${command.executable}|${command.arguments.join(",")}`);
    Assert.isNull(devin.binaryFor("darwin-aarch64"));
    Assert.isNull(devin.binaryFor(null));
    Assert.isNull(devin.npx);
    const droid = registry.find("droid")!;
    Assert.isNull(droid.icon);
    Assert.areEqual(0, droid.binaries.size);
    Assert.areEqual("droid@1.1.0|exec,--output-format,acp-daemon|true",
      [droid.npx?.name, droid.npx?.arguments.join(","), droid.npx?.environment["DROID_DISABLE_AUTO_UPDATE"]].join("|"));
    Assert.areEqual("fast-agent-acp==0.1.0|", [registry.find("fast-agent")?.uvx?.name, registry.find("fast-agent")?.uvx?.arguments.join(",")].join("|"));
    Assert.isNull(registry.find("missing"));
  }

  @TestMethod
  public writesAnAgentSoItReadsBackTheSame(): void {
    const values = [
      agent("devin", { binary: { "linux-x86_64": { archive: "https://example.com/devin.tar.gz", cmd: "./bin/devin", args: ["acp"], env: { DEVIN_MODE: "acp" }, sha256: SHA256 },
        "windows-x86_64": { archive: "https://example.com/devin.exe", cmd: "devin.exe" } } }, { icon: "https://example.com/devin.svg", website: "https://example.com/devin" }),
      agent("droid", { npx: { package: "droid@1.1.0", args: ["exec"], env: { DROID_DISABLE_AUTO_UPDATE: "true" } } }),
      agent("fast-agent", { uvx: { package: "fast-agent-acp==0.1.0" } })
    ];

    for (const value of AcpRegistry.read(JSON.stringify({ agents: values })).agents) {
      const again = AcpRegistryAgent.fromJson(JsonReader.fromValue(JSON.parse(JSON.stringify(value.toJson())) as unknown));

      Assert.areEqual(JSON.stringify(value.toJson()), JSON.stringify(again.toJson()), value.id);
      Assert.areEqual(value.about, again.about, value.id);
    }
    const devin = AcpRegistryAgent.fromJson(JsonReader.fromValue(values[0]));
    Assert.areEqual("bin/devin|acp", [devin.binaryFor("linux-x86_64")?.command.join("/"), devin.binaryFor("linux-x86_64")?.arguments.join(",")].join("|"));
  }

  @TestMethod
  public readsItsAboutPageFromAnHttpsWebsiteElseItsRepository(): void {
    const about = (fields: object): string | null => AcpRegistryAgent.fromJson(JsonReader.fromValue(agent("devin", { npx: { package: "devin@1.0.0" } }, fields))).about;

    Assert.areEqual("https://example.com/site", about({ website: "https://example.com/site", repository: "https://example.com/code" }));
    Assert.areEqual("https://example.com/code", about({ website: "http://example.com/site", repository: "https://example.com/code" }));
    Assert.areEqual("https://example.com/code", about({ repository: "https://example.com/code" }));
    Assert.isNull(about({ website: "javascript:alert(1)", repository: "file:///code" }));
    Assert.isNull(about({}));
  }

  @TestMethod
  public listsAnAgentForAComputerItHasABuildForOrAPackageFor(): void {
    const binary = new AcpRegistryBinary("https://example.com/a.tar.gz", ["a"], [], {}, null);
    const build = new AcpRegistryAgent("a", "A", "1.0.0", "", null, new Map([["linux-x86_64", binary]]), null, null);
    const npx = new AcpRegistryAgent("a", "A", "1.0.0", "", null, new Map(), new AcpRegistryPackage("a@1.0.0", [], {}), null);
    const uvx = new AcpRegistryAgent("a", "A", "1.0.0", "", null, new Map(), null, new AcpRegistryPackage("a==1.0.0", [], {}));
    const none = new AcpRegistryAgent("a", "A", "1.0.0", "", null, new Map(), null, null);

    Assert.areEqual("true,false,false,true,true,false", [build.isListedFor("linux-x86_64"), build.isListedFor("windows-x86_64"), build.isListedFor(null), npx.isListedFor(null),
      uvx.isListedFor("linux-x86_64"), none.isListedFor("linux-x86_64")].join(","));
  }

  @TestMethod
  public tellsAZipATarAndABinaryThatIsNoArchiveFromItsAddressesPath(): void {
    const kind = (archive: string): string => {
      const binary = new AcpRegistryBinary(archive, ["a"], [], {}, null);
      return binary.isZip ? "zip" : binary.isRaw ? "raw" : "tar";
    };
    const cases: readonly [string, string][] = [["a.zip", "zip"], ["A.ZIP", "zip"], ["a.zip?x=1", "zip"], ["a.tar.gz", "tar"], ["a.tgz", "tar"], ["a.tar.bz2", "tar"], ["a.tbz2", "tar"],
      ["a.tar.xz", "tar"], ["a.txz", "tar"], ["a.exe", "raw"], ["a", "raw"], ["a.gz", "raw"], ["a?file=b.zip", "raw"]];

    for (const [file, expected] of cases)
      Assert.areEqual(expected, kind(`https://example.com/${file}`), file);
  }

  @TestMethod
  public splitsAnExactNpmPackageIntoItsNameAndVersionAndRefusesAnythingElse(): void {
    const of = (name: string): AcpRegistryPackage => new AcpRegistryPackage(name, [], {});

    Assert.areEqual("droid|1.1.0", [of("droid@1.1.0").npmPackageName, of("droid@1.1.0").npmVersion].join("|"));
    Assert.areEqual("@acme/droid|1.1.0-beta.1+b2", [of("@acme/droid@1.1.0-beta.1+b2").npmPackageName, of("@acme/droid@1.1.0-beta.1+b2").npmVersion].join("|"));
    for (const name of ["droid@1.1.0", "@acme/droid@1.1.0", "droid@1.1.0-beta.1", "droid@1.1.0+b2"])
      Assert.isTrue(of(name).isExactNpmPackage, name);
    for (const name of ["droid", "droid@latest", "droid@^1.1.0", "droid@1.1", "--global@1.0.0", "-g", "git+https://example.com/a.git", "https://example.com/a.tgz", "../droid@1.0.0",
      "file:droid@1.0.0", "Droid@1.0.0", "droid@1.0.0 --global", "droid@1.0.0\n", "@acme/@1.0.0", `${"a".repeat(257)}@1.0.0`])
      Assert.isFalse(of(name).isExactNpmPackage, name);
  }

  @TestMethod
  public leavesOutEachEntryThatIsntAValidAgentAndKeepsTheFirstOfAnIdListedTwice(): void {
    const binary = (fields: object): object => ({ binary: { "linux-x86_64": { archive: "https://example.com/a.tar.gz", cmd: "./a", ...fields } } });
    const registry = AcpRegistry.read(JSON.stringify({ agents: [
      agent("good", binary({})),
      agent("Upper", binary({})),
      agent("local-copy", binary({})),
      agent("bad-version", binary({}), { version: "latest" }),
      agent("plain-http", binary({ archive: "http://example.com/a.tar.gz" })),
      agent("parent", binary({ cmd: "../a" })),
      agent("nested-parent", binary({ cmd: "bin\\..\\..\\a" })),
      agent("rooted", binary({ cmd: "/usr/bin/a" })),
      agent("drive", binary({ cmd: "C:\\a.exe" })),
      agent("dot-only", binary({ cmd: "./" })),
      agent("short-sha", binary({ sha256: "abc" })),
      agent("bad-variable", binary({ env: { "BAD-NAME": "x" } })),
      agent("number-variable", { npx: { package: "a@1.0.0", env: { COUNT: 2 } } }),
      agent("blank-package", { npx: { package: " " } }),
      agent("good", { npx: { package: "second@1.0.0" } }),
      { name: "No id", version: "1.0.0", distribution: {} },
      { id: 7, name: "Number id", version: "1.0.0", distribution: {} },
      "not an agent",
      null,
      [agent("listed", binary({}))],
      agent("con", binary({})),
      agent("lpt1", binary({})),
      agent("a".repeat(65), binary({})),
      agent("b".repeat(64), binary({})),
      agent("cursor", binary({})),
      agent("claude-acp", binary({})),
      agent("fx", binary({})),
      agent("pi", binary({})),
      agent("pi-acp", binary({}))
    ] }));

    Assert.areEqual(`good,${"b".repeat(64)}`, registry.agents.map(t => t.id).join(","));
    Assert.areEqual(1, registry.find("good")?.binaries.size);
    Assert.areEqual("Upper,local-copy,bad-version,plain-http,parent,nested-parent,rooted,drive,dot-only,short-sha,bad-variable,number-variable,blank-package,15,"
      + `16,17,18,19,con,lpt1,${"a".repeat(65)},cursor,claude-acp,fx,pi,pi-acp`, registry.skipped.join(","));
    Assert.areEqual(Resources.formatAcpRegistryOwnProvider("cursor"), Assert.throws(() => AcpRegistryAgent.fromJson(JsonReader.fromValue(agent("cursor", binary({})))),
      Error).message);
    Assert.areEqual(Resources.formatAcpRegistryIdInvalid("nul"), Assert.throws(() => AcpRegistryAgent.fromJson(JsonReader.fromValue(agent("nul", binary({})))),
      Error).message);
  }

  @TestMethod
  public refusesTextThatIsntAListOfAgents(): void {
    for (const text of ["", "not json", "null", "[]", "{}", JSON.stringify({ agents: "none" })])
      Assert.areEqual(Resources.acpRegistryUnreadable, Assert.throws(() => AcpRegistry.read(text), AcpRegistryException).message, text);
    Assert.areEqual(0, AcpRegistry.read(JSON.stringify({ agents: [] })).agents.length);
  }

  @TestMethod
  public namesTheRegistrysPlatformKeyForEachPlatformItBuildsFor(): void {
    const cases: readonly [NodeJS.Platform, string, string | null][] = [["win32", "x64", "windows-x86_64"], ["win32", "arm64", "windows-aarch64"],
      ["darwin", "arm64", "darwin-aarch64"], ["darwin", "x64", "darwin-x86_64"], ["linux", "x64", "linux-x86_64"], ["linux", "arm64", "linux-aarch64"],
      ["linux", "ia32", null], ["freebsd", "x64", null]];
    for (const [platform, arch, target] of cases)
      Assert.areEqual(target, AcpRegistryAgent.targetOf(platform, arch), `${platform} ${arch}`);
  }
}
