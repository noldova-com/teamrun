/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetachedStartRequest } from "@noldova/teamrun-shell-desktop";

@TestClass
export class DetachedStartRequestTests {
  @TestMethod
  public travelsAsJson(): void {
    const launchArguments = ["entry.js", "--data-dir", "C:\\data"];
    const request = new DetachedStartRequest("C:\\TeamRun\\TeamRun.exe", launchArguments, "C:\\data\\logs\\start.log", { ELECTRON_RUN_AS_NODE: "1", UNSET: undefined });
    launchArguments.push("changed");

    const copy = DetachedStartRequest.fromJson(JSON.parse(JSON.stringify(request.toJson())));

    Assert.areEqual("C:\\TeamRun\\TeamRun.exe", copy.executable);
    Assert.areEqual("entry.js|--data-dir|C:\\data", copy.launchArguments.join("|"));
    Assert.areEqual("C:\\data\\logs\\start.log", copy.errorFile);
    Assert.areEqual("{\"ELECTRON_RUN_AS_NODE\":\"1\"}", JSON.stringify(copy.environment));
  }

  @TestMethod
  public requiresAProgramAndAnErrorFile(): void {
    Assert.areEqual("executable", Assert.throws(() => new DetachedStartRequest(" ", [], "start.log", {}), ArgumentException).parameterName);
    Assert.areEqual("errorFile", Assert.throws(() => new DetachedStartRequest("node", [], "", {}), ArgumentException).parameterName);
    Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [1], errorFile: "start.log", environment: {} }), JsonException);
    Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log" }), JsonException);
    const exception = Assert.throws(() => DetachedStartRequest.fromJson({ executable: "node", arguments: [], errorFile: "start.log", environment: { PATH: 1 } }), JsonException);
    Assert.areEqual("$.environment.PATH: An environment variable's value must be text.", exception.message);
    Assert.throws(() => DetachedStartRequest.fromJson("node"), JsonException);
  }
}
