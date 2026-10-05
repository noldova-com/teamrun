/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { realpathSync } from "node:fs";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessRequest } from "@noldova/teamrun-shell-runtime";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessEnvironmentTests {
  @TestMethod
  public async startsAProgramFoundOnThePathInItsFolderWithOnlyTheVariablesItIsGiven(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const runtime: NodeJS.ProcessEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([t]) => t.toUpperCase() !== "PATH")),
      PATH: path.dirname(process.execPath),
      TEAMRUN_INHERITED: "kept",
      TEAMRUN_DROPPED: "dropped"
    };
    const processes = ProcessSupervisorFixture.create(settings, process.platform, runtime);
    const name = path.basename(process.execPath, path.extname(process.execPath));

    const owned = await processes.startAsync(
      ProcessSupervisorFixture.MODULE,
      new ProcessRequest(name, [ProgramFixture.file, ProgramFixture.ENVIRONMENT], folder.path, { TEAMRUN_SET: "set" }, ["TEAMRUN_INHERITED", "TEAMRUN_MISSING"]));
    const running = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()}`);
    const recorded = settings.database.readAll(ProcessSupervisorFixture.RECORDS);
    const runningBefore = owned.hasExited;
    let errors = "";
    owned.errors.setEncoding("utf8");
    owned.errors.on("data", (t: string) => {
      errors += t;
    });
    const errorsEnded = once(owned.errors, "end");
    const output = JSON.parse(await ProgramFixture.readAllAsync(owned)) as { folder: string; path: string; kept: [string, string][] };
    const exit = await owned.exited;
    await errorsEnded;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(process.execPath, owned.program);
    Assert.areEqual(`notes ${process.execPath} ${owned.processId} ${owned.started.getTime()}`, running.join(","));
    Assert.areEqual(JSON.stringify([{ module: "notes", program: process.execPath, process_id: owned.processId }]), JSON.stringify(recorded));
    Assert.isFalse(runningBefore);
    Assert.areEqual(realpathSync(folder.path), realpathSync(output.folder));
    Assert.areEqual(path.dirname(process.execPath), output.path);
    Assert.areEqual("[[\"TEAMRUN_INHERITED\",\"kept\"],[\"TEAMRUN_SET\",\"set\"]]", JSON.stringify(output.kept));
    Assert.areEqual("environment", errors.trim());
    Assert.isTrue(exit.isClean);
    Assert.isTrue(owned.hasExited);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }
}
