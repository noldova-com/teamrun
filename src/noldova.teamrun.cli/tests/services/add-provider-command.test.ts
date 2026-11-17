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
import { ProviderCreateParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";
import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class AddProviderCommandTests {
  @TestMethod
  public async addsAProviderWithItsProfileFolderReadFromTheCurrentFolder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerCreate", () => SampleData.provider.toJson());

    const result = await context.runAsync("teamrun.addProvider", { kind: "codex", label: "Work", profileFolder: relative(process.cwd(), directory.path) });

    Assert.areEqual("Added provider a1: Work (codex)", result.text);
    Assert.areEqual(JSON.stringify(SampleData.provider.toJson()), JSON.stringify(result.value));
    const params = ProviderCreateParams.fromJson(context.payloadsOf("teamrun.providerCreate")[0]);
    Assert.areEqual(`codex|Work|${directory.path}`, [params.kind, params.label, params.profileDir].join("|"));
  }

  @TestMethod
  public async readsALeadingTildeAsTheHomeFolder(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerCreate", () => SampleData.provider.toJson());

    await context.runAsync("teamrun.addProvider", { kind: "codex", label: "Work", profileFolder: "~" });

    Assert.areEqual(homedir(), ProviderCreateParams.fromJson(context.payloadsOf("teamrun.providerCreate")[0]).profileDir);
  }

  @TestMethod
  public async refusesAProfileFolderThatIsMissingOrAFileWithoutAddingAProvider(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const missing = join(directory.path, "missing");
    const file = join(directory.path, "file.txt");
    writeFileSync(file, "x");
    const context = await RecordingCliContext.activateAsync();

    const absent = await Assert.throwsAsync(() => context.runAsync("teamrun.addProvider", { kind: "codex", label: "Work", profileFolder: missing }), CliCommandException);
    const notFolder = await Assert.throwsAsync(() => context.runAsync("teamrun.addProvider", { kind: "codex", label: "Work", profileFolder: file }), CliCommandException);

    Assert.areEqual(`NotFound No folder is at ${missing}.`, `${absent.code} ${absent.message}`);
    Assert.areEqual(`No folder is at ${file}.`, notFolder.message);
    Assert.areEqual(0, context.requests.length);
  }
}
