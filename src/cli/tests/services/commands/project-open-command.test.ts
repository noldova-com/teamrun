/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { isAbsolute } from "node:path";


import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ProjectOpenCommandTests {
  @TestMethod
  public async opensAProjectByAbsolutePath(): Promise<void> {
    await using host = await CliTestHost.create();

    const project = await host.openProject("alpha");
    const text = await host.run("project-open", host.directory.resolve("alpha"));

    Assert.isTrue(isAbsolute(project.rootPath));
    Assert.areEqual("alpha", project.name);
    Assert.areEqual(0, text);
    Assert.areEqual(`${project.id}  alpha  ${project.rootPath}`, host.console.lastLine);
  }
}
