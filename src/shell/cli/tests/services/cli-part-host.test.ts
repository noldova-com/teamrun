/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";

import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliPartHostTests {
  @TestMethod
  public async startsOnlyTheTargetsPartAndItsDependenciesInDeclarationOrderAndStopsThemInReverse(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const text = await fixture.runModuleAsync(build, ["needy", "run"]);
    const log = await build.readPartsLogAsync();
    const json = await fixture.runModuleAsync(build, ["needy", "run", "--json"]);

    Assert.areEqual(0, text.code, text.error);
    Assert.areEqual("Needy ran.\n", text.output);
    Assert.areEqual("activate probe\nactivate needy\ndeactivate needy\ndeactivate probe\n", log);
    Assert.areEqual(0, json.code, json.error);
    Assert.areEqual("{\"pong\":\"needy\"}\n", json.output);
  }

  @TestMethod
  public async refusesAModuleWhosePartCannotStartAsNotActiveAndStopsThePartsItStarted(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const missing = "Its command-line part does not export a CliPart class with activateAsync and deactivateAsync.";
    const failed = "Its command-line part failed to start: ";
    const cases: readonly (readonly [string, string])[] = [
      ["hollow", missing],
      ["nameless", missing],
      ["inert", missing],
      ["halfway", missing],
      ["lopsided", missing],
      ["unfinished", missing],
      ["clumsy", `${failed}The clumsy part tripped.`],
      ["greedy", `${failed}greedy.extra is not a command-line command that greedy declares. (Parameter 'name')`],
      ["doubled", `${failed}doubled.run is registered already. (Parameter 'name')`]
    ];

    for (const [id, reason] of cases) {
      const result = await fixture.runModuleAsync(build, [id, "run"]);
      const json = await fixture.runModuleAsync(build, [id, "run", "--json"]);

      Assert.areEqual(7, result.code, id);
      Assert.areEqual(`The module ${id} is not active: ${reason}\n`, result.error);
      Assert.areEqual(JSON.stringify({ code: "ModuleNotActive", message: `The module ${id} is not active: ${reason}`, details: { module: id, cause: reason } }),
        json.error.trimEnd());
    }
    const absent = await fixture.runModuleAsync(build, ["absent", "run"]);
    const unregistered = await fixture.runModuleAsync(build, ["probe", "unregistered"]);

    Assert.areEqual(7, absent.code);
    Assert.isTrue(absent.error.startsWith(`The module absent is not active: ${failed}`), absent.error);
    Assert.areEqual(7, unregistered.code);
    Assert.areEqual("The module probe is not active: Its command-line part did not register probe.unregistered.\n", unregistered.error);
    Assert.areEqual(`${"activate clumsy\ndeactivate clumsy\n".repeat(2)}activate probe\ndeactivate probe\n`, await build.readPartsLogAsync());
  }

  @TestMethod
  public async stopsEveryPartItStartedAndReportsAPartThatFailsToStopAfterTheCommandsResultOrError(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const stuck = JSON.stringify({ code: "PartNotStopped", message: "A command-line part failed to stop: The sticky part would not let go." });

    const ran = await fixture.runModuleAsync(build, ["sticky", "run"]);
    const json = await fixture.runModuleAsync(build, ["sticky", "run", "--json"]);
    const failed = await fixture.runModuleAsync(build, ["sticky", "fail", "--json"]);

    Assert.areEqual(9, ran.code, ran.error);
    Assert.areEqual("Sticky ran.\n", ran.output);
    Assert.areEqual("A command-line part failed to stop: The sticky part would not let go.\n", ran.error);
    Assert.areEqual(9, json.code, json.error);
    Assert.areEqual("\"ran\"\n", json.output);
    Assert.areEqual(`${stuck}\n`, json.error);
    Assert.areEqual(1, failed.code, failed.error);
    Assert.areEqual(`${JSON.stringify({ code: "StickyBroke", message: "The sticky command broke." })}\n${stuck}\n`, failed.error);
    Assert.areEqual("activate probe\nactivate sticky\ndeactivate sticky\ndeactivate probe\n".repeat(3), await build.readPartsLogAsync());
  }

  @TestMethod
  public async startsNoPartAfterAStopAndStopsAPartThatFinishesStartingAfterIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const interruptAsync = async (): Promise<{ code: number; error: string; beforeRelease: string; readLaterError: () => string }> => {
      await rm(build.locate(ProbeBuildFixture.SLOW_MARKER), { force: true });
      await rm(build.locate(ProbeBuildFixture.SLOW_RELEASE), { force: true });
      await rm(build.locate(ProbeBuildFixture.PARTS_LOG), { force: true });
      const running = fixture.runModuleAsync(build, ["tardy", "run", "--json"]);
      await ProbeBuildFixture.waitUntilWaitingAsync(build.locate(ProbeBuildFixture.SLOW_MARKER));
      fixture.signals.emit("SIGINT");
      const interrupted = await running;
      const beforeRelease = await build.readPartsLogAsync();
      await writeFile(build.locate(ProbeBuildFixture.SLOW_RELEASE), "yes");
      Assert.isTrue(await Wait.untilAsync(async () => await build.readPartsLogAsync() === "activate slow\ndeactivate slow\n", 15_000), await build.readPartsLogAsync());
      return { ...interrupted, beforeRelease };
    };

    const clean = await interruptAsync();
    const cleanLate = clean.readLaterError();
    await writeFile(build.locate(ProbeBuildFixture.SLOW_STICKS), "yes");
    const stuck = await interruptAsync();
    let stuckLate = "";
    const isReported = await Wait.untilAsync(() => (stuckLate += stuck.readLaterError()) !== "", 15_000);

    for (const run of [clean, stuck]) {
      Assert.areEqual(6, run.code, run.error);
      Assert.areEqual("Cancelled", (JSON.parse(run.error) as { code: string }).code);
      Assert.areEqual("activate slow\n", run.beforeRelease);
    }
    Assert.areEqual("", cleanLate);
    Assert.isTrue(isReported, "The late part's failure to stop was not reported within 15 s.");
    Assert.areEqual(`${JSON.stringify({ code: "PartNotStopped", message: "A command-line part failed to stop: The slow part would not let go." })}\n`, stuckLate);
  }
}
