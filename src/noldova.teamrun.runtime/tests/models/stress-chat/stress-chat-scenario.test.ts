/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind, MessageStatus } from "@noldova/teamrun.protocol";
import { StressChatScenario } from "@noldova/teamrun.runtime/development";

@TestClass
export class StressChatScenarioTests {
  private static readonly ROOT: string = join("data", "stress-chat");
  private static readonly CLOSING: string = "This synthetic reply is finished. Open its steps and files to try their controls. **No agent made any change.**";

  @TestMethod
  public repeatsTwentyFiveScenariosInOrderWithTheirStepsAndEndings(): void {
    const expected = [
      "Short reply 3 Text", "Long prose 14 Text", "Headings and emphasis 6 Text Text", "Lists and checklists 4 Text", "Tables 5 Text",
      "TypeScript 9 Text", "Python 8 Text", "C# 8 Text", "JSON and YAML 7 Text", "SQL and shell 6 Text", "Long code lines 5 Text",
      "Tall code block 21 Text", "Plain code 4 Text", "Attached images 11 Text", "Written images 33 FileChange Text",
      "Reasoning and tool results 47 Reasoning Note Note Note Note Note Note Note Text Text", "Command output 62 Command Note Text",
      "Diff changes 38 FileChange Text", "Edit changes 29 FileChange FileChange FileChange Text", "File operations 17 FileChange Text",
      "Failed reply 7 Command Note Error", "Cancelled reply 4 Text Note", "Mentions 3 Text", "Unicode and links 5 Text Text",
      "Full showcase 95 Text Text Text Text Text Text FileChange Reasoning Note Note Note Note Note Note Note Text Command Note FileChange Text Text Text"
    ];

    const actual = StressChatScenario.all.map(t => [t.name, t.workSeconds, ...t.detailsOf(3, StressChatScenarioTests.ROOT).map(u => u.kind)].join(" "));

    Assert.areEqual(expected.join("\n"), actual.join("\n"));
    Assert.areEqual("Failed reply Failed,Cancelled reply Cancelled",
      StressChatScenario.all.filter(t => t.status !== MessageStatus.Completed).map(t => `${t.name} ${t.status}`).join(","));
    Assert.areEqual("Attached images", StressChatScenario.all.filter(t => t.hasAttachments).map(t => t.name).join(","));
    Assert.areEqual("Mentions", StressChatScenario.all.filter(t => t.hasMentions).map(t => t.name).join(","));
  }

  @TestMethod
  public writesContentAtSizeForTheTurn(): void {
    const textOf = (name: string): string => StressChatScenarioTests.detailsOf(name)[0]?.text ?? "";
    const lines = (name: string): readonly string[] => textOf(name).split("\n");

    Assert.areEqual(12, textOf("Long prose").split("\n\n").length);
    Assert.isTrue(textOf("Long prose").startsWith("Paragraph 1 of turn 3."));
    Assert.isTrue(textOf("JSON and YAML").includes("\"turn\": 3,"));
    Assert.isTrue(Math.max(...lines("Long code lines").map(t => t.length)) > 2000);
    Assert.areEqual(202, lines("Tall code block").length);
    Assert.areEqual("export const value200 = { line: 200, turn: 3 };", lines("Tall code block")[200]);
    Assert.areEqual(46, lines("Command output").length);
  }

  @TestMethod
  public tiesEachStepToItsResultAndNamesTheProjectsFiles(): void {
    const example = join(StressChatScenarioTests.ROOT, "src", "example.ts");
    const steps = StressChatScenarioTests.detailsOf("Reasoning and tool results");
    const failure = StressChatScenarioTests.detailsOf("Failed reply");
    const operations = StressChatScenarioTests.detailsOf("File operations");

    Assert.areEqual("read-3,read-3,grep-3,glob-3,websearch-3,webfetch-3,task-3", steps.slice(1, 8).map(t => StressChatScenarioTests.field(t, "toolUseId")).join(","));
    Assert.areEqual(`Read ${example}`, steps[1]?.text);
    Assert.areEqual(example, (StressChatScenarioTests.field(steps[1], "input") as { file_path: string }).file_path);
    Assert.areEqual("bash-3 false", `${StressChatScenarioTests.field(StressChatScenarioTests.detailsOf("Command output")[1], "toolUseId")} `
      + `${StressChatScenarioTests.field(StressChatScenarioTests.detailsOf("Command output")[1], "isError")}`);
    Assert.areEqual("bash-3 true", `${StressChatScenarioTests.field(failure[1], "toolUseId")} ${StressChatScenarioTests.field(failure[1], "isError")}`);
    Assert.areEqual("workingTree", StressChatScenarioTests.field(operations[0], "source"));
    Assert.areEqual("Stopped\nA synthetic stop; no process ran.", StressChatScenarioTests.detailsOf("Cancelled reply")[1]?.text);
  }

  @TestMethod
  public showsTheShowcasesPartsWithOneClosing(): void {
    const details = StressChatScenarioTests.detailsOf("Full showcase");

    Assert.areEqual("# Heading one", details[0]?.text.split("\n")[0]);
    Assert.areEqual(1, details.filter(t => t.text === StressChatScenarioTests.CLOSING).length);
    Assert.areEqual(StressChatScenarioTests.CLOSING, details.at(-1)?.text);
  }

  @TestMethod
  public completesWithNeitherAttachmentsNorMentionsUnlessTold(): void {
    const scenario = new StressChatScenario("Custom", 2, (turn, root) => [new TurnDetail(DetailKind.Text, `${turn} ${root}`, null, null)]);

    Assert.areEqual(MessageStatus.Completed, scenario.status);
    Assert.isFalse(scenario.hasAttachments);
    Assert.isFalse(scenario.hasMentions);
    Assert.areEqual("7 root", scenario.detailsOf(7, "root")[0]?.text);
  }

  private static detailsOf(name: string): readonly TurnDetail[] {
    return StressChatScenario.all.find(t => t.name === name)?.detailsOf(3, StressChatScenarioTests.ROOT) ?? [];
  }

  private static field(detail: TurnDetail | undefined, name: string): unknown {
    return (detail?.payload as Record<string, unknown> | undefined)?.[name];
  }
}
