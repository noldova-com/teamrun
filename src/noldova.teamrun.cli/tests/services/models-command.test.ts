/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliCommandException } from "@noldova/desktop.cli";
import { ProviderListModelsParams, ProviderModel, ProviderModelList } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class ModelsCommandTests {
  @TestMethod
  public async listsTheModelsOfTheProviderGivenFromItsKindsCatalog(): Promise<void> {
    const models = [new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, null), new ProviderModel("gpt-5-mini", "GPT-5 mini", "", null, false, null, null)];
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerList", () => [SampleData.provider.toJson()])
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList(models, true).toJson());

    const result = await context.runAsync("teamrun.listModels", { providerId: "a1" });

    Assert.areEqual("gpt-5  GPT-5  efforts: low, high  default\ngpt-5-mini  GPT-5 mini  no efforts", result.text);
    Assert.areEqual(JSON.stringify(models.map(t => t.toJson())), JSON.stringify(result.value));
    const params = ProviderListModelsParams.fromJson(context.payloadsOf("teamrun.providerModelCatalog")[0]);
    Assert.areEqual("codex a1 false", `${params.kind} ${params.providerId} ${params.refresh}`);
  }

  @TestMethod
  public async printsNoneForAProviderThatListsNoModels(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerList", () => [SampleData.provider.toJson()])
      .answer("teamrun.providerModelCatalog", () => new ProviderModelList([], false).toJson());

    const result = await context.runAsync("teamrun.listModels", { providerId: "a1" });

    Assert.areEqual("(none)", result.text);
    Assert.areEqual("[]", JSON.stringify(result.value));
  }

  @TestMethod
  public async refusesAProviderIdNoProviderHasWithoutReadingACatalog(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerList", () => [SampleData.provider.toJson()]);

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.listModels", { providerId: "a9" }), CliCommandException);

    Assert.areEqual("NotFound No provider has the id a9.", `${error.code} ${error.message}`);
    Assert.areEqual(0, context.payloadsOf("teamrun.providerModelCatalog").length);
  }
}
