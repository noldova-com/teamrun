/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AntigravityInstructions } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class AntigravityInstructionsTests {
  private static expected(...files: readonly (readonly [string, string])[]): string {
    return "The Antigravity instruction files TeamRun loaded for this session, the person's own from their home, then the project's, since Antigravity reads none of them itself:\n\n"
      + files.map(([path, content]) => `Contents of ${path}:\n\n${content}`).join("\n\n");
  }

  @TestMethod
  public readsTheGeminiHomesFilesThenItsConfigFilesThenItsConfigRulesByName(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    mkdirSync(directory.resolve("home", ".gemini", "config", "rules", "team"), { recursive: true });
    writeFileSync(directory.resolve("home", ".gemini", "GEMINI.md"), "gemini\n@shared.md");
    writeFileSync(directory.resolve("home", ".gemini", "AGENTS.md"), "agents");
    writeFileSync(directory.resolve("home", ".gemini", "config", "GEMINI.md"), "config-gemini");
    writeFileSync(directory.resolve("home", ".gemini", "config", "AGENTS.md"), "config-agents");
    writeFileSync(directory.resolve("home", ".gemini", "config", "rules", "b.md"), "rule-b");
    writeFileSync(directory.resolve("home", ".gemini", "config", "rules", "a.md"), "---\ntrigger: always_on\n---\nrule-a");
    writeFileSync(directory.resolve("home", ".gemini", "config", "rules", "team", "c.md"), "nested-rule");
    writeFileSync(directory.resolve("home", ".gemini", "settings.json"), "{\"mcpServers\":{\"fixture\":{\"command\":\"fixture\"}}}");

    const text = AntigravityInstructions.read({ HOME: home, USERPROFILE: home });

    Assert.areEqual(AntigravityInstructionsTests.expected(
      [directory.resolve("home", ".gemini", "AGENTS.md"), "agents"],
      [directory.resolve("home", ".gemini", "GEMINI.md"), "gemini\n@shared.md"],
      [directory.resolve("home", ".gemini", "config", "AGENTS.md"), "config-agents"],
      [directory.resolve("home", ".gemini", "config", "GEMINI.md"), "config-gemini"],
      [directory.resolve("home", ".gemini", "config", "rules", "a.md"), "---\ntrigger: always_on\n---\nrule-a"],
      [directory.resolve("home", ".gemini", "config", "rules", "b.md"), "rule-b"]), text);
  }

  @TestMethod
  public readsTheGeminiHomeItsVariableNamesAndTheHomeFromUserProfileOnWindowsAndSkipsWhatCantBeRead(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("custom", "config", "rules"), { recursive: true });
    mkdirSync(directory.resolve("profile", ".gemini", "GEMINI.md"), { recursive: true });
    mkdirSync(directory.resolve("home", ".gemini"), { recursive: true });
    writeFileSync(directory.resolve("custom", "GEMINI.md"), "custom-gemini");
    writeFileSync(directory.resolve("profile", ".gemini", "AGENTS.md"), "profile-agents");
    writeFileSync(directory.resolve("home", ".gemini", "AGENTS.md"), "not-the-home-on-windows");
    mkdirSync(directory.resolve("custom", "config", "rules", "folder.md"));

    Assert.areEqual(AntigravityInstructionsTests.expected([directory.resolve("custom", "GEMINI.md"), "custom-gemini"]),
      AntigravityInstructions.read({ GEMINI_HOME: directory.resolve("custom"), HOME: directory.resolve("home") }, "linux"));
    Assert.areEqual(AntigravityInstructionsTests.expected([directory.resolve("profile", ".gemini", "AGENTS.md"), "profile-agents"]),
      AntigravityInstructions.read({ HOME: directory.resolve("home"), USERPROFILE: directory.resolve("profile") }, "win32"));
    Assert.isNull(AntigravityInstructions.read({ HOME: directory.resolve("empty"), USERPROFILE: directory.resolve("empty") }));
  }

  @TestMethod
  public readsTheProjectsFilesAndRulesFromItsRootDownToTheTurnsFolderAfterThePersonsAndNothingAboveTheRoot(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const root = directory.resolve("repo");
    const work = directory.resolve("repo", "app");
    mkdirSync(directory.resolve("home", ".gemini"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".agent", "rules", "team"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".agents", "rules"), { recursive: true });
    mkdirSync(directory.resolve("repo", "app", ".agents", "rules"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".agent", "skills", "pier"), { recursive: true });
    writeFileSync(directory.resolve("home", ".gemini", "GEMINI.md"), "person-gemini");
    writeFileSync(directory.resolve("GEMINI.md"), "above-the-root");
    writeFileSync(directory.resolve("repo", "GEMINI.md"), "root-gemini");
    writeFileSync(directory.resolve("repo", "AGENTS.md"), "root-agents");
    writeFileSync(directory.resolve("repo", ".agent", "rules", "b.md"), "agent-rule-b");
    writeFileSync(directory.resolve("repo", ".agent", "rules", "a.md"), "agent-rule-a");
    writeFileSync(directory.resolve("repo", ".agent", "rules", "team", "c.md"), "nested-rule");
    writeFileSync(directory.resolve("repo", ".agents", "rules", "a.md"), "agents-rule");
    writeFileSync(directory.resolve("repo", ".agent", "skills", "pier", "SKILL.md"), "project-skill");
    writeFileSync(directory.resolve("repo", "app", "GEMINI.md"), "app-gemini");
    writeFileSync(directory.resolve("repo", "app", ".agents", "rules", "z.md"), "app-rule");

    const text = AntigravityInstructions.read({ HOME: home, USERPROFILE: home }, "linux", work);

    Assert.areEqual(AntigravityInstructionsTests.expected(
      [directory.resolve("home", ".gemini", "GEMINI.md"), "person-gemini"],
      [join(root, "AGENTS.md"), "root-agents"],
      [join(root, "GEMINI.md"), "root-gemini"],
      [join(root, ".agent", "rules", "a.md"), "agent-rule-a"],
      [join(root, ".agent", "rules", "b.md"), "agent-rule-b"],
      [join(root, ".agents", "rules", "a.md"), "agents-rule"],
      [join(work, "GEMINI.md"), "app-gemini"],
      [join(work, ".agents", "rules", "z.md"), "app-rule"]), text);
    Assert.areEqual(AntigravityInstructionsTests.expected([join(root, "AGENTS.md"), "root-agents"], [join(root, "GEMINI.md"), "root-gemini"],
      [join(root, ".agent", "rules", "a.md"), "agent-rule-a"], [join(root, ".agent", "rules", "b.md"), "agent-rule-b"],
      [join(root, ".agents", "rules", "a.md"), "agents-rule"]), AntigravityInstructions.read({ HOME: directory.resolve("empty"), USERPROFILE: directory.resolve("empty") },
      "linux", root));
  }

  @TestMethod
  public leavesOutAProjectFileOrRuleLinkedFromOutsideTheRootAndReadsNothingAboveATurnFolderOutsideAnyRepository(): void {
    using directory = new TemporaryDirectory();
    const empty = { HOME: directory.resolve("empty"), USERPROFILE: directory.resolve("empty") };
    const root = directory.resolve("repo");
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".agent"), { recursive: true });
    mkdirSync(directory.resolve("repo", ".agents", "rules"), { recursive: true });
    mkdirSync(directory.resolve("outside", "linked"), { recursive: true });
    mkdirSync(directory.resolve("outside", "rules"), { recursive: true });
    mkdirSync(directory.resolve("plain", "work"), { recursive: true });
    writeFileSync(directory.resolve("repo", "AGENTS.md"), "root-agents");
    writeFileSync(directory.resolve("repo", ".agents", "rules", "kept.md"), "kept-rule");
    writeFileSync(directory.resolve("outside", "linked", "AGENTS.md"), "outside-agents");
    writeFileSync(directory.resolve("outside", "rules", "secret.md"), "outside-rule");
    writeFileSync(directory.resolve("plain", "GEMINI.md"), "parent-gemini");
    writeFileSync(directory.resolve("plain", "work", "GEMINI.md"), "work-gemini");
    symlinkSync(directory.resolve("outside", "linked"), directory.resolve("repo", "linked"), "junction");
    symlinkSync(directory.resolve("outside", "rules"), directory.resolve("repo", ".agent", "rules"), "junction");

    Assert.areEqual(AntigravityInstructionsTests.expected([join(root, "AGENTS.md"), "root-agents"], [join(root, ".agents", "rules", "kept.md"), "kept-rule"]),
      AntigravityInstructions.read(empty, "linux", directory.resolve("repo", "linked")));
    Assert.areEqual(AntigravityInstructionsTests.expected([directory.resolve("plain", "work", "GEMINI.md"), "work-gemini"]),
      AntigravityInstructions.read(empty, "linux", directory.resolve("plain", "work")));
  }

  @TestMethod
  public leavesOutAManualRuleOfThePersonsOrTheProjectsAndPassesEveryOtherRuleWholeWithItsFrontMatter(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const root = directory.resolve("repo");
    const rules = directory.resolve("home", ".gemini", "config", "rules");
    const project = directory.resolve("repo", ".agents", "rules");
    mkdirSync(rules, { recursive: true });
    mkdirSync(project, { recursive: true });
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    writeFileSync(join(rules, "manual.md"), "---\ntrigger: manual\n---\nperson-manual");
    writeFileSync(join(rules, "glob.md"), "---\ntrigger: glob\nglobs: \"*.ts\"\n---\nperson-glob");
    writeFileSync(join(project, "a.md"), "\uFEFF---\r\ndescription: Quoted\r\ntrigger: 'manual'\r\n---\r\nproject-manual");
    writeFileSync(join(project, "b.md"), "---\ntrigger: model_decision\ndescription: When the task is about tests\n---\nproject-decision");
    writeFileSync(join(project, "c.md"), "trigger: manual\nproject-plain");
    writeFileSync(join(project, "d.md"), "---\ntitle: Body\n---\ntrigger: manual\nproject-body");

    Assert.areEqual(AntigravityInstructionsTests.expected(
      [join(rules, "glob.md"), "---\ntrigger: glob\nglobs: \"*.ts\"\n---\nperson-glob"],
      [join(project, "b.md"), "---\ntrigger: model_decision\ndescription: When the task is about tests\n---\nproject-decision"],
      [join(project, "c.md"), "trigger: manual\nproject-plain"],
      [join(project, "d.md"), "---\ntitle: Body\n---\ntrigger: manual\nproject-body"]), AntigravityInstructions.read({ HOME: home, USERPROFILE: home }, "linux", root));
  }
}
