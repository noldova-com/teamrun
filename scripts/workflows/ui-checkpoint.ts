/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import JsonFields from "../totals/json-fields.ts";
import type IUiCheckpointSettings from "./interfaces/ui-checkpoint-settings.ts";

export default class UiCheckpoint {
  private static readonly ANNOTATION: string = "checkpoint";
  private static readonly TITLE_SEPARATOR: string = " › ";
  private static readonly NOT_READ: string = "Not read";
  private static readonly TABLE_HEADER: string = "| Workflow | Checkpoint | Theme | Mode | Fonts (interface / code) | Sizes (panel / message / code) | Zoom | Viewport | Pixel ratio |\n|---|---|---|---|---|---|---|---|---|\n";

  public readonly workflow: string;
  public readonly name: string;
  public readonly settings: IUiCheckpointSettings | null;
  public readonly settingsProblem: string;
  public readonly colorScheme: string;
  public readonly zoom: number;
  public readonly width: number;
  public readonly height: number;
  public readonly pixelRatio: number;

  public constructor(workflow: string, record: JsonFields) {
    const settings = record.has("settings") ? record.object("settings") : null;
    const viewport = record.object("viewport");
    this.workflow = workflow;
    this.name = record.text("name");
    this.settings = settings === null ? null : {
      theme: settings.text("theme"),
      mode: settings.text("mode"),
      interfaceFont: settings.text("interfaceFont"),
      codeFont: settings.text("codeFont"),
      panelSize: settings.number("panelSize"),
      messageSize: settings.number("messageSize"),
      codeSize: settings.number("codeSize")
    };
    this.settingsProblem = settings === null ? record.text("settingsProblem") : "";
    this.colorScheme = record.text("colorScheme");
    this.zoom = record.number("zoom");
    this.width = viewport.count("width");
    this.height = viewport.count("height");
    this.pixelRatio = record.number("pixelRatio");
  }

  public static readAll(report: JsonFields, source: string): readonly UiCheckpoint[] {
    return report.objects("suites").flatMap(t => UiCheckpoint.collect(t, [], source));
  }

  public static formatSection(checkpoints: readonly UiCheckpoint[]): string {
    if (checkpoints.length === 0)
      return "";
    return `\n<details><summary>Screenshot checkpoints (${checkpoints.length})</summary>\n\n${UiCheckpoint.TABLE_HEADER}${checkpoints.map(t => t.formatRow()).join("")}\n</details>\n`;
  }

  public formatRow(): string {
    const settings = this.settings;
    const cells = [
      this.workflow,
      this.name,
      settings === null ? `${UiCheckpoint.NOT_READ}: ${this.settingsProblem}` : settings.theme,
      settings === null ? this.colorScheme : `${settings.mode} → ${this.colorScheme}`,
      settings === null ? UiCheckpoint.NOT_READ : `${settings.interfaceFont} / ${settings.codeFont}`,
      settings === null ? UiCheckpoint.NOT_READ : `${settings.panelSize} / ${settings.messageSize} / ${settings.codeSize}`,
      String(this.zoom),
      `${this.width} × ${this.height}`,
      String(this.pixelRatio)
    ];
    return `| ${cells.map(t => UiCheckpoint.escape(t)).join(" | ")} |\n`;
  }

  private static collect(suite: JsonFields, titles: readonly string[], source: string): readonly UiCheckpoint[] {
    const path = [...titles, suite.text("title")];
    const specs = suite.has("specs") ? suite.objects("specs") : [];
    const suites = suite.has("suites") ? suite.objects("suites") : [];
    return [
      ...specs.flatMap(t => t.objects("tests").flatMap(u => u.objects("results").flatMap(v => UiCheckpoint.read(v, [...path, t.text("title")].join(UiCheckpoint.TITLE_SEPARATOR), source)))),
      ...suites.flatMap(t => UiCheckpoint.collect(t, path, source))
    ];
  }

  private static read(result: JsonFields, workflow: string, source: string): readonly UiCheckpoint[] {
    const checkpoints = (result.has("annotations") ? result.objects("annotations") : []).filter(t => t.text("type") === UiCheckpoint.ANNOTATION);
    if (checkpoints.length === 0)
      return [];
    const retry = result.count("retry");
    const name = retry === 0 ? workflow : `${workflow} (retry ${retry})`;
    return checkpoints.map(t => new UiCheckpoint(name, JsonFields.parse(t.text("description"), `${source}, ${name}, checkpoint`)));
  }

  private static escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll("\n", " ");
  }
}
