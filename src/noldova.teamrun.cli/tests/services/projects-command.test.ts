/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliPartException } from "@noldova/teamrun.cli";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class ProjectsCommandTests {
  @TestMethod
  public async listsEachProjectsIdNameAndFolder(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectList", () => SampleData.listed.map(t => t.toJson()));
    const signal = new AbortController().signal;

    const result = await context.runAsync("teamrun.listProjects", {}, signal);

    Assert.areEqual("p1  Site  /work/site\np2  Docs  /work/docs", result.text);
    Assert.areEqual(JSON.stringify([SampleData.site.toJson(), SampleData.docs.toJson()]), JSON.stringify(result.value));
    Assert.areEqual(null, context.payloadsOf("teamrun.projectList")[0]);
    Assert.isTrue(context.signals[0] === signal);
  }

  @TestMethod
  public async saysNoneForAnEmptyList(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectList", () => []);

    Assert.areEqual("(none)", (await context.runAsync("teamrun.listProjects")).text);
  }

  @TestMethod
  public async refusesAnAnswerThatIsNotAList(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectList", () => ({ projects: [] }));

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.listProjects"), CliPartException);
    Assert.areEqual("The runtime part answered teamrun.projectList with something other than a list.", error.message);
    Assert.areEqual("CliPartException", error.name);
    Assert.areEqual("teamrun.projectList", error.method);
  }
}
