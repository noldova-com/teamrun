/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type CommandList, type QuitReport, QuitResult } from "@noldova/teamrun-shell-protocol";

import type { CliCommandResult } from "../models/cli-command-result.js";
import type { CliFailure } from "../models/cli-failure.js";
import type { StatusReport } from "../models/status-report.js";
import { Resources } from "../resources.js";

export class CliOutput {
  private readonly output: Writable;
  private readonly error: Writable;
  private readonly isJson: boolean;

  public constructor(output: Writable, error: Writable, isJson: boolean) {
    this.output = output;
    this.error = error;
    this.isJson = isJson;
  }

  public writeHelp(help: string): void {
    if (this.isJson)
      return this.writeJson({ help });
    this.output.write(`${help}${Resources.lineEnd}`);
  }

  public writeStatus(report: StatusReport): void {
    if (this.isJson)
      return this.writeJson(report.toJson());
    const modules = report.modules.modules.map(t => Resources.formatModule(t.id, t.state, t.cause));
    this.writeLines([
      Resources.formatRuntime(report.identity.productVersion, report.identity.fingerprint),
      Resources.formatDataDirectory(report.dataDirectory),
      Resources.formatModules(modules.length === 0 ? Resources.noModules : modules.join(", ")),
      Resources.formatWork(report.work.descriptions.length === 0 ? Resources.noWork : report.work.descriptions.join("; "))
    ]);
  }

  public writeCommands(list: CommandList): void {
    if (this.isJson)
      return this.writeJson({ commands: list.commands.map(t => ({ name: t.name.text, title: t.title, module: t.name.owner })) });
    const width = Math.max(0, ...list.commands.map(t => t.name.text.length));
    const lines = list.commands.length === 0 ? [Resources.noCommands] : list.commands.map(t => `${t.name.text.padEnd(width)}  ${t.title}`);
    this.writeLines([...lines, String.empty, Resources.windowCommandsNote]);
  }

  public writeResult(value: JsonValue): void {
    if (this.isJson)
      return this.writeJson(value);
    if (!Object.isNull(value))
      this.writeLines([JSON.stringify(value, null, Resources.jsonIndent)]);
  }

  public writeCommandResult(result: CliCommandResult): void {
    if (this.isJson)
      return this.writeJson(result.value);
    if (result.text.length > 0)
      this.output.write(result.text.endsWith(Resources.lineEnd) ? result.text : `${result.text}${Resources.lineEnd}`);
  }

  public writeOpened(root: string): void {
    if (this.isJson)
      return this.writeJson({ dataDirectory: root });
    this.writeLines([Resources.formatOpened(root)]);
  }

  public writeQuit(report: QuitReport): void {
    if (this.isJson)
      return this.writeJson(report.toJson());
    this.writeLines([report.outcome === QuitResult.Quit ? Resources.quitDone : Resources.noDesktop]);
  }

  public writeFailure(failure: CliFailure, usage: string | null): void {
    if (this.isJson) {
      this.error.write(`${JSON.stringify(failure.toJson())}${Resources.lineEnd}`);
      return;
    }
    const lines = Object.isNull(usage) ? [failure.message] : [failure.message, String.empty, usage];
    this.error.write(`${lines.join(Resources.lineEnd)}${Resources.lineEnd}`);
  }

  private writeJson(value: JsonValue): void {
    this.output.write(`${JSON.stringify(value)}${Resources.lineEnd}`);
  }

  private writeLines(lines: readonly string[]): void {
    this.output.write(`${lines.join(Resources.lineEnd)}${Resources.lineEnd}`);
  }
}
