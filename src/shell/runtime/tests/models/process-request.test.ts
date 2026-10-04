/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessRequest } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ProcessRequestTests {
  private static readonly FOLDER: string = path.resolve("project");

  @TestMethod
  public keepsCopiesOfWhatItIsGiven(): void {
    const launchArguments = ["status"];
    const environment: Record<string, string> = { GIT_PAGER: "cat" };
    const inherit = ["SSH_AUTH_SOCK"];
    const controller = new AbortController();

    const request = new ProcessRequest("git", launchArguments, ProcessRequestTests.FOLDER, environment, inherit, controller.signal);
    launchArguments.push("--short");
    environment["GIT_DIR"] = ".git";
    inherit.push("HOME");

    Assert.areEqual("git", request.program);
    Assert.areEqual("status", request.arguments.join(","));
    Assert.areEqual(ProcessRequestTests.FOLDER, request.workingFolder);
    Assert.areEqual("{\"GIT_PAGER\":\"cat\"}", JSON.stringify(request.environment));
    Assert.areEqual("SSH_AUTH_SOCK", request.inherit.join(","));
    Assert.areEqual(controller.signal, request.signal);
  }

  @TestMethod
  public setsNoVariablesInheritsNoneAndHasNoSignalByDefault(): void {
    const request = new ProcessRequest("git", [], ProcessRequestTests.FOLDER);

    Assert.areEqual("{}", JSON.stringify(request.environment));
    Assert.areEqual(0, request.inherit.length);
    Assert.isTrue(Object.isUndefined(request.signal));
  }

  @TestMethod
  public rejectsAMissingProgramARelativeFolderAndVariablesThatCannotBeNamed(): void {
    const folder = ProcessRequestTests.FOLDER;

    Assert.areEqual("program", Assert.throws(() => new ProcessRequest(" ", [], folder), ArgumentException).parameterName);
    Assert.areEqual("workingFolder", Assert.throws(() => new ProcessRequest("git", [], "project"), ArgumentException).parameterName);
    const named = Assert.throws(() => new ProcessRequest("git", [], folder, { "A=B": "c" }), ArgumentException);
    Assert.areEqual("environment", named.parameterName);
    Assert.isTrue(named.message.startsWith("\"A=B\" is not an environment variable's name."), named.message);
    Assert.areEqual("environment", Assert.throws(() => new ProcessRequest("git", [], folder, { "": "c" }), ArgumentException).parameterName);
    Assert.areEqual("inherit", Assert.throws(() => new ProcessRequest("git", [], folder, {}, ["HO\0ME"]), ArgumentException).parameterName);
  }
}
