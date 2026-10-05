/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class OwnedProcessTests {
  @TestMethod
  public async stopsAProgramAndWhatItStartedAndReportsHowItExited(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, ProgramFixture.WAIT]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    const stopping = owned.stopAsync();
    const exit = await owned.stopAsync();

    Assert.areEqual(stopping, owned.stopAsync());
    Assert.areEqual(process.platform === "win32" ? "0 null" : "null SIGTERM", `${exit.code} ${exit.signal}`);
    Assert.isFalse(ProgramFixture.isRunning(child));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsAnErrorOnAProgramsInputInTheLog(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));

    owned.input.emit("error", new Error("write EPIPE"));
    await owned.stopAsync();

    Assert.isTrue(settings.diagnostics.text.startsWith(`The module notes's program ${process.execPath} (process ${owned.processId}): Error: write EPIPE`), settings.diagnostics.text);
  }
}
