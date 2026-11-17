/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpConfigOption } from "@noldova/teamrun.providers";

@TestClass
export class AcpConfigOptionTests {
  @TestMethod
  public readsTheSelectOptionsOfAnAnswerAndNamesTheirValues(): void {
    Assert.isNull(AcpConfigOption.readAll(JsonReader.fromValue({ sessionId: "s-1" })));
    Assert.isNull(AcpConfigOption.readAll(JsonReader.fromValue({ configOptions: null })));
    const options = AcpConfigOption.readAll(JsonReader.fromValue({ configOptions: [
      { id: "model", name: "Model", category: "model", type: "select", currentValue: "a", options: [{ value: "a", name: "Model A" }, { value: "b" }] },
      { id: "auto", name: "Auto", type: "boolean", currentValue: true },
      { id: "plan", name: "Plan", type: "select", currentValue: "off", options: [{ value: "off" }] }
    ] }))!;
    Assert.areEqual("model,plan", options.map(t => t.id).join(","));
    const [model, plan] = options;
    Assert.areEqual("model", model?.category);
    Assert.areEqual("a", model?.currentValue);
    Assert.areEqual("a,b", model?.values.join(","));
    Assert.areEqual("Model A,b", model?.names.join(","));
    Assert.areEqual("Model A", model?.nameOf("a"));
    Assert.areEqual("c", model?.nameOf("c"));
    Assert.isNull(plan?.category);
    const changed = model!.withValue("b");
    Assert.areEqual("b", changed.currentValue);
    Assert.areEqual("model:model:a,b:Model A,b", [changed.id, changed.category, changed.values.join(","), changed.names.join(",")].join(":"));
    Assert.areEqual("a", model?.currentValue);
  }

  @TestMethod
  public readsTheValuesOfGroupedOptionsFromEveryGroupInOrder(): void {
    const [model] = AcpConfigOption.readAll(JsonReader.fromValue({ configOptions: [
      { id: "model", name: "Model", category: "model", type: "select", currentValue: "b", options: [
        { group: "first", name: "First", options: [{ value: "a", name: "Model A" }, { value: "b" }] },
        { group: "second", name: "Second", options: [] },
        { group: "third", name: "Third", options: [{ value: "c", name: "Model C" }] }
      ] }
    ] }))!;
    Assert.areEqual("a,b,c", model?.values.join(","));
    Assert.areEqual("Model A,b,Model C", model?.names.join(","));
    Assert.areEqual("b", model?.currentValue);
  }

  @TestMethod
  public keepsEachValuesGroupAndLogsOnlyTheValuesNamesAndGroups(): void {
    const [model] = AcpConfigOption.readAll(JsonReader.fromValue({ configOptions: [{ id: "model", category: "model", type: "select", currentValue: "x-high",
      description: "not logged", options: [{ group: "x", name: "X", options: [{ value: "x-low", name: "Low" }, { value: "x-high", name: "High" }] },
        { group: "y", options: [{ value: "y-one" }] }, { value: "z", name: "Z", description: "not logged" }] }] }))!;

    Assert.areEqual("x,x,y,null", model!.groups.map(String).join(","));
    Assert.areEqual("X,X,null,null", model!.groupNames.map(String).join(","));
    Assert.areEqual("x,x,y,null", model!.withValue("z").groups.map(String).join(","));
    Assert.areEqual(JSON.stringify({ id: "model", category: "model", currentValue: "x-high", options: [
      { value: "x-low", name: "Low", group: "x", groupName: "X" }, { value: "x-high", name: "High", group: "x", groupName: "X" },
      { value: "y-one", name: "y-one", group: "y", groupName: null }, { value: "z", name: "Z", group: null, groupName: null }] }), JSON.stringify(model!.toLog()));
    Assert.areEqual("null,null", new AcpConfigOption("e", null, "a", ["a", "b"], ["A", "B"]).groups.map(String).join(","));
  }
}
