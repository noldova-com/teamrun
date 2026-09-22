/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ProjectsCommandTests {
  @TestMethod
  public async listsProjects(): Promise<void> {
    await using host = await CliTestHost.create();
    const project = await host.openProject();

    const code = await host.run("projects");

    Assert.areEqual(0, code);
    Assert.areEqual(`${project.id}  repo  ${project.rootPath}`, host.console.lastLine);
  }
}
