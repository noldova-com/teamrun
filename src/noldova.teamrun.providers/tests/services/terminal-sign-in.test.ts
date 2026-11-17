/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessCommand, Resources, TerminalSignIn } from "@noldova/teamrun.providers";

import { CopilotTestHost } from "../fixtures/copilot-test-host.fixture.js";
import { FxTestHost } from "../fixtures/fx-test-host.fixture.js";
import { MuseTestHost } from "../fixtures/muse-test-host.fixture.js";
import { OpencodeTestHost } from "../fixtures/opencode-test-host.fixture.js";
import { PiTestHost } from "../fixtures/pi-test-host.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class TerminalSignInTests {
  @TestMethod
  public namesTheFolderOfTheCopyTurnsRunFirstOnThePathUnderThePathsOwnNameWhenTheLauncherIsThere(): void {
    using directory = new TemporaryDirectory();
    const own = TerminalSignInTests.folder(directory, "claude", "claude");
    const cursor = TerminalSignInTests.folder(directory, "cursor", "cursor-agent.cmd");

    const claude = TerminalSignIn.of(new ProcessCommand(join(own, "claude"), []), "claude auth login", { Path: "/usr/bin" });
    const windows = TerminalSignIn.of(new ProcessCommand(join(cursor, "node.exe"), [join(cursor, "index.js")]), "cursor-agent login", {});

    Assert.areEqual(JSON.stringify({ command: "claude auth login", environment: { Path: [own, "/usr/bin"].join(delimiter) } }), JSON.stringify(claude?.toJson()));
    Assert.areEqual(JSON.stringify({ command: "cursor-agent login", environment: { PATH: cursor } }), JSON.stringify(windows?.toJson()));
  }

  @TestMethod
  public namesNoCopyWhenTheFolderHoldsNoLauncherOrThereIsNoCommandOrSignIn(): void {
    using directory = new TemporaryDirectory();
    const shared = TerminalSignInTests.folder(directory, "node", "node");
    const command = new ProcessCommand(join(shared, "node"), [join(directory.path, "pi", "cli.js")]);

    Assert.isNull(TerminalSignIn.of(command, "pi", { PATH: "/usr/bin" }));
    Assert.isNull(TerminalSignIn.of(null, "pi", { PATH: "/usr/bin" }));
    Assert.isNull(TerminalSignIn.of(command, null, { PATH: "/usr/bin" }));
  }

  @TestMethod
  public namesOnlyTheCopysFolderWhenThePathIsMissingOrEmptySoNoEmptyEntryNamesTheCurrentFolder(): void {
    using directory = new TemporaryDirectory();
    const own = TerminalSignInTests.folder(directory, "claude", "claude");
    const command = new ProcessCommand(join(own, "claude"), []);

    Assert.areEqual(JSON.stringify([{ PATH: own }, { PATH: own }]),
      JSON.stringify([TerminalSignIn.of(command, "claude auth login", {}), TerminalSignIn.of(command, "claude auth login", { PATH: "" })].map(t => t?.environment)));
  }

  @TestMethod
  public async signsCopilotFxOpencodeMuseCodeAndPiInThroughTheCopyTheirTurnsRunEvenWhenOnlyFoundOffThePath(): Promise<void> {
    await using copilot = new CopilotTestHost();
    await using fx = new FxTestHost();
    await using opencode = new OpencodeTestHost();
    await using muse = new MuseTestHost();
    using pi = new PiTestHost();
    using directory = new TemporaryDirectory();
    const copyOf = (launcher: string): ProcessCommand => new ProcessCommand(join(TerminalSignInTests.folder(directory, launcher, `${launcher}.cmd`), "node"), []);

    const commands = [
      await copilot.createAdapter({}, copyOf("copilot")).readSignInCommand(copilot.provider),
      await fx.createAdapter({}, copyOf("fx")).readSignInCommand(fx.provider),
      await opencode.createAdapter({}, copyOf("opencode")).readSignInCommand(opencode.provider),
      await muse.createAdapter({}, null, () => copyOf("muse")).readSignInCommand(muse.provider),
      await pi.createAdapter(copyOf("pi")).readSignInCommand(pi.createProvider())
    ];

    Assert.areEqual(JSON.stringify([[Resources.copilotSignInCommand, directory.resolve("copilot")], [Resources.fxSignInCommand, directory.resolve("fx")],
      [Resources.opencodeSignInCommand, directory.resolve("opencode")], [Resources.museSignInCommand, directory.resolve("muse")], [Resources.piSignInCommand, directory.resolve("pi")]]),
      JSON.stringify(commands.map(t => [t?.command, Object.values(t?.environment ?? {})[0]?.split(delimiter)[0]])));
  }

  private static folder(directory: TemporaryDirectory, name: string, launcher: string): string {
    const folder = directory.resolve(name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, launcher), "");
    return folder;
  }
}
