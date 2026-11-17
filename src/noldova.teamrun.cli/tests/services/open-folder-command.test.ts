/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliCommandException } from "@noldova/desktop.cli";
import { ProjectOpenParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";
import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class OpenFolderCommandTests {
  @TestMethod
  public async opensAFolderReadFromTheCurrentFolderAndPrintsTheProject(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectOpen", () => SampleData.site.toJson());

    const result = await context.runAsync("teamrun.openFolder", { folder: relative(process.cwd(), directory.path) });

    Assert.areEqual("Opened project p1: Site (/work/site)", result.text);
    Assert.areEqual(JSON.stringify(SampleData.site.toJson()), JSON.stringify(result.value));
    Assert.areEqual(directory.path, ProjectOpenParams.fromJson(context.payloadsOf("teamrun.projectOpen")[0]).rootPath);
  }

  @TestMethod
  public async readsALeadingTildeAsTheHomeFolder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectOpen", () => SampleData.site.toJson());

    await context.runAsync("teamrun.openFolder", { folder: "~" });
    await context.runAsync("teamrun.openFolder", { folder: `~/${relative(homedir(), directory.path)}` });

    const opened = context.payloadsOf("teamrun.projectOpen").map(t => ProjectOpenParams.fromJson(t).rootPath);
    Assert.areEqual(`${homedir()}|${directory.path}`, opened.join("|"));
  }

  @TestMethod
  public async refusesAFolderThatIsMissingOrAFileWithoutOpeningAProject(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const missing = join(directory.path, "missing");
    const file = join(directory.path, "file.txt");
    writeFileSync(file, "x");
    const context = await RecordingCliContext.activateAsync();

    const absent = await Assert.throwsAsync(() => context.runAsync("teamrun.openFolder", { folder: missing }), CliCommandException);
    const notFolder = await Assert.throwsAsync(() => context.runAsync("teamrun.openFolder", { folder: file }), CliCommandException);

    Assert.areEqual(`NotFound No folder is at ${missing}.`, `${absent.code} ${absent.message}`);
    Assert.areEqual(`No folder is at ${file}.`, notFolder.message);
    Assert.areEqual(0, context.requests.length);
  }
}
