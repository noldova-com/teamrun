/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OutputWriter } from "@noldova/teamrun-cli";

import { FakeConsole } from "../fixtures/fake-console.fixture.js";

@TestClass
export class OutputWriterTests {
  @TestMethod
  public printsTextOrJson(): void {
    const text = new FakeConsole();
    const json = new FakeConsole();
    const textWriter = new OutputWriter(text, false);
    const jsonWriter = new OutputWriter(json, true);

    textWriter.writeObjects([{ id: "a" }, { id: "b" }], t => t.readString("id"));
    textWriter.writeObjects([], t => t.readString("id"));
    textWriter.writeStrings(["x", "y"]);
    textWriter.writeStrings([]);
    textWriter.writeObject({ id: "c" }, t => t.readString("id"));
    textWriter.writeText("done", null);
    jsonWriter.writeObjects([{ id: "a" }], t => t.readString("id"));
    jsonWriter.writeStrings(["x"]);
    jsonWriter.writeObject({ id: "c" }, t => t.readString("id"));
    jsonWriter.writeText("done", { ok: true });
    textWriter.writeJsonOnly({ hidden: true });
    jsonWriter.writeJsonOnly({ shown: true });

    Assert.areEqual("a,b,(none),x,y,(none),c,done", text.lines.join(","));
    Assert.areEqual("[\n  {\n    \"id\": \"a\"\n  }\n]", json.lines[0]);
    Assert.areEqual("[\n  \"x\"\n]", json.lines[1]);
    Assert.areEqual("{\n  \"id\": \"c\"\n}", json.lines[2]);
    Assert.areEqual("{\n  \"ok\": true\n}", json.lines[3]);
    Assert.areEqual("{\n  \"shown\": true\n}", json.lines[4]);
    Assert.areEqual(8, text.lines.length);
  }
}
