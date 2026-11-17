/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderModel } from "@noldova/teamrun.protocol";
import { AcpConfigOption, AcpModelChoices, AcpModelMember, AntigravityAgent } from "@noldova/teamrun.providers";

import { AntigravitySessionModesRecording } from "../fixtures/antigravity-session-modes.recording.js";

@TestClass
export class AcpModelChoicesTests {
  private static readonly agent: AntigravityAgent = new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp");

  @TestMethod
  public groupsAntigravitysFlatChoicesThatNameTheirLevelInBothIdAndNameAsOneModelOnTheSessionsLevelWithNoDefaultMarked(): void {
    const choices = AcpModelChoicesTests.choices("gemini-flash-medium", [["gemini-flash-high", "Gemini Flash (High)"], ["gemini-flash-medium", "Gemini Flash (Medium)"],
      ["gemini-flash-low", "Gemini Flash (Low)"], ["gemini-pro-high", "Gemini Pro (High)"]]);
    const models = choices.models(true, undefined);

    Assert.areEqual("gemini-flash:Gemini Flash:gemini-flash-high,gemini-flash-medium,gemini-flash-low:null:gemini-flash-medium:true|gemini-pro-high:Gemini Pro (High)::null:null:false",
      AcpModelChoicesTests.describe(models));
    Assert.areEqual("High,Medium,Low", Object.values(models[0]!.effortNames).join(","));
    Assert.areEqual("gemini-flash-low:true|gemini-flash-medium:true|gemini-flash-medium:true|gemini-pro-high:false", [choices.resolve("gemini-flash", "gemini-flash-low"),
      choices.resolve("gemini-flash", null), choices.resolve(null, "elsewhere"), choices.resolve("gemini-pro-high", null)].map(t => t.join(":")).join("|"));
    Assert.areEqual("gemini-flash|null", [choices.familyOf("gemini-flash-low"), String(choices.familyOf("other"))].join("|"));
  }

  @TestMethod
  public runsAnAntigravityFamilyOtherThanTheSessionsOnItsFirstLevelAndMarksNoDefault(): void {
    const choices = AcpModelChoicesTests.choices("gemini-flash-low", [["gemini-flash-high", "Gemini Flash (High)"], ["gemini-flash-low", "Gemini Flash (Low)"],
      ["gemini-pro-high", "Gemini Pro (High)"], ["gemini-pro-low", "Gemini Pro (Low)"]]);

    Assert.areEqual("gemini-flash:Gemini Flash:gemini-flash-high,gemini-flash-low:null:gemini-flash-low:true|"
      + "gemini-pro:Gemini Pro:gemini-pro-high,gemini-pro-low:null:gemini-pro-high:false", AcpModelChoicesTests.describe(choices.models(true, undefined)));
    Assert.areEqual("gemini-pro-high:true|gemini-flash-low:true", [choices.resolve("gemini-pro", null), choices.resolve("gemini-flash", null)]
      .map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public offersAntigravitysRecordedFlashAsOneModelWithItsHighMediumAndLowLevelsInItsOrderOnTheSessionsLevelWithNoDefaultMarked(): void {
    const [model] = AcpConfigOption.readAll(JsonReader.fromValue(JsonReader.toJsonValue(AntigravitySessionModesRecording.sessionNew)))!;
    const models = new AcpModelChoices(model!, (value, name) => AcpModelChoicesTests.agent.memberOf(value, name)).models(true, undefined);

    Assert.areEqual("gemini-3.8-flash:Gemini 3.8 Flash:gemini-3.8-flash-high,gemini-3.8-flash-medium,gemini-3.8-flash-low:null:gemini-3.8-flash-high:true",
      AcpModelChoicesTests.describe(models));
    Assert.areEqual("High,Medium,Low", Object.values(models[0]!.effortNames).join(","));
  }

  @TestMethod
  public takesAGroupOfLevelsAsAModelOnTheSessionsLevelOrItsFirstWithNoDefaultMarkedAndKeepsAVendorsGroupAOneChoiceGroupAndAnUngroupedChoiceAsModelsOfTheirOwn(): void {
    const option = new AcpConfigOption("model", "model", "flash-high", ["flash-low", "flash-high", "pro-low", "pro-high", "one", "solo-high", "gemini-fast", "gemini-pro"],
      ["Low", "High", "Low", "High", "One", "Solo (High)", "Gemini Fast", "Gemini Pro"], ["flash", "flash", "pro", "pro", "bare", null, "gemini", "gemini"],
      ["Flash", "Flash", null, null, "Bare", null, "Gemini", "Gemini"]);
    const choices = new AcpModelChoices(option, () => {
      throw new Error("A grouped option takes no naming rule.");
    });
    const models = choices.models(true, undefined);

    Assert.areEqual("flash:Flash:flash-low,flash-high:null:flash-high:true|pro:pro:pro-low,pro-high:null:pro-low:false|one:One::null:null:false|"
      + "solo-high:Solo (High)::null:null:false|gemini-fast:Gemini Fast::null:null:false|gemini-pro:Gemini Pro::null:null:false",
      AcpModelChoicesTests.describe(models));
    Assert.areEqual("Low,High", Object.values(models[0]!.effortNames).join(","));
    Assert.areEqual("pro-low:true|pro-high:true", [choices.resolve("pro", null), choices.resolve("pro", "pro-high")].map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public joinsLevelsOnlyWhenTheirNamesShareTheBaseAndTakesAPlainChoiceWithTheirIdAndNameAsTheDefaultLevel(): void {
    const choices = AcpModelChoicesTests.choices("alpha", [["alpha", "Alpha"], ["alpha-high", "Alpha (High)"], ["alpha-low", "Alpha (Low)"], ["mixed-high", "Alpha (High)"],
      ["mixed-low", "Beta (Low)"], ["taken-high", "Taken (High)"], ["taken-low", "Taken (Low)"], ["taken", "Other"]]);
    const models = choices.models(true, undefined);

    Assert.areEqual("alpha:Alpha:alpha,alpha-high,alpha-low:alpha:alpha:true|mixed-high:Alpha (High)::null:null:false|mixed-low:Beta (Low)::null:null:false|"
      + "taken-high:Taken (High)::null:null:false|taken-low:Taken (Low)::null:null:false|taken:Other::null:null:false", AcpModelChoicesTests.describe(models));
    Assert.areEqual("Standard,High,Low", Object.values(models[0]!.effortNames).join(","));
    Assert.areEqual("alpha-low:true|alpha:true|mixed-low:false", [choices.resolve("alpha", "alpha-low"), choices.resolve("alpha", null), choices.resolve("mixed-low", null)]
      .map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public opensAFamilyOtherThanTheSessionsOnItsStandardLevelWhateverItsFirstLevel(): void {
    const choices = AcpModelChoicesTests.choices("beta-high", [["alpha-high", "Alpha (High)"], ["alpha", "Alpha"], ["alpha-low", "Alpha (Low)"], ["beta", "Beta"],
      ["beta-high", "Beta (High)"]]);

    Assert.areEqual("alpha:Alpha:alpha-high,alpha,alpha-low:alpha:alpha:false|beta:Beta:beta,beta-high:beta:beta-high:true",
      AcpModelChoicesTests.describe(choices.models(true, undefined)));
    Assert.areEqual("alpha:true|alpha-low:true", [choices.resolve("alpha", null), choices.resolve("alpha", "alpha-low")].map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public runsTheSessionsLevelInItsOwnFamilyWhenNothingIsChosenAndMarksTheStandardLevelAsTheDefault(): void {
    const choices = AcpModelChoicesTests.choices("alpha-high", [["alpha", "Alpha"], ["alpha-high", "Alpha (High)"], ["alpha-low", "Alpha (Low)"]]);

    Assert.areEqual("alpha:Alpha:alpha,alpha-high,alpha-low:alpha:alpha-high:true", AcpModelChoicesTests.describe(choices.models(true, undefined)));
    Assert.areEqual("alpha-high:true|alpha-low:true|alpha-high:true", [choices.resolve("alpha", null), choices.resolve("alpha", "alpha-low"),
      choices.resolve(null, null)].map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public joinsAGroupOnlyWhenEachOfItsChoicesIsNamedByALevelAloneOrAfterTheGroupsName(): void {
    const option = new AcpConfigOption("model", "model", "gemini-flash-high", ["google-flash-high", "google-pro-high", "claude-sonnet", "claude-opus", "gemini-flash-low",
      "gemini-flash-high", "mixed-low", "mixed-big"], ["Gemini Flash (High)", "Gemini Pro (High)", "Claude Sonnet", "Claude Opus", "Gemini Flash (Low)",
      "gemini flash (XHigh)", "Low", "Mixed Big"], ["google", "google", "anthropic", "anthropic", "flash", "flash", "mixed", "mixed"],
      ["Google", "Google", "Anthropic", "Anthropic", "Gemini Flash", "Gemini Flash", "Mixed", "Mixed"]);
    const choices = new AcpModelChoices(option, () => {
      throw new Error("A grouped option takes no naming rule.");
    });
    const models = choices.models(true, undefined);

    Assert.areEqual("google-flash-high:Gemini Flash (High)::null:null:false|google-pro-high:Gemini Pro (High)::null:null:false|claude-sonnet:Claude Sonnet::null:null:false|"
      + "claude-opus:Claude Opus::null:null:false|flash:Gemini Flash:gemini-flash-low,gemini-flash-high:null:gemini-flash-high:true|mixed-low:Low::null:null:false|"
      + "mixed-big:Mixed Big::null:null:false", AcpModelChoicesTests.describe(models));
    Assert.areEqual("Low,XHigh", Object.values(models[4]!.effortNames).join(","));
    Assert.areEqual("google-pro-high:false|gemini-flash-low:true", [choices.resolve("google-pro-high", null), choices.resolve("flash", "gemini-flash-low")]
      .map(t => t.join(":")).join("|"));
  }

  @TestMethod
  public keepsAsTheirOwnModelsTheChoicesWhoseIdOrNameDoesntNameTheSameLevel(): void {
    const choices = AcpModelChoicesTests.choices("claude-sonnet", [["claude-sonnet", "Claude Sonnet 4.6 (Thinking)"], ["gpt-oss-medium", "GPT-OSS 120B"],
      ["gemini-x-high", "Gemini X (Low)"], ["argon", "Gemini 4 Argon (High)"]]);
    const levels = new AcpConfigOption("effort", "thought_level", "medium", ["low", "medium"], ["Low", "Medium"]);

    Assert.areEqual("claude-sonnet:Claude Sonnet 4.6 (Thinking):low,medium:medium:null:true|gpt-oss-medium:GPT-OSS 120B:low,medium:medium:null:false|"
      + "gemini-x-high:Gemini X (Low):low,medium:medium:null:false|argon:Gemini 4 Argon (High):low,medium:medium:null:false", AcpModelChoicesTests.describe(choices.models(null, levels)));
    Assert.areEqual("gpt-oss-medium:false|null:false", [choices.resolve("gpt-oss-medium", "low"), choices.resolve(null, null)].map(t => `${String(t[0])}:${String(t[1])}`).join("|"));
  }

  @TestMethod
  public takesOnlyFilledPartsForAMember(): void {
    Assert.areEqual("familyId", Assert.throws(() => new AcpModelMember(" ", "Name", "High"), ArgumentException).parameterName);
    Assert.areEqual("familyName", Assert.throws(() => new AcpModelMember("id", "", "High"), ArgumentException).parameterName);
    Assert.areEqual("levelName", Assert.throws(() => new AcpModelMember("id", "Name", " "), ArgumentException).parameterName);
  }

  private static choices(current: string, values: readonly [string, string][]): AcpModelChoices {
    return new AcpModelChoices(new AcpConfigOption("model", "model", current, values.map(t => t[0]), values.map(t => t[1])),
      (value, name) => AcpModelChoicesTests.agent.memberOf(value, name));
  }

  private static describe(models: readonly ProviderModel[]): string {
    return models.map(t => [t.id, t.displayName, t.effortLevels?.join(","), String(t.defaultEffort), String(t.configuredEffort), String(t.isDefault)].join(":")).join("|");
  }
}
