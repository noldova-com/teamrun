/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import type { IConsole } from "../interfaces/i-console.js";
import { Resources } from "../resources.js";

export class OutputWriter {
  private readonly console: IConsole;
  private readonly json: boolean;

  public constructor(console: IConsole, json: boolean) {
    this.console = console;
    this.json = json;
  }

  public writeObjects(payload: JsonValue, format: (item: JsonReader) => string): void {
    if (this.json) {
      this.writeJson(payload);
      return;
    }

    const items = JsonReader.fromValue({ [Resources.itemsField]: payload }).readObjectArray(Resources.itemsField);
    if (items.length === 0)
      this.console.write(Resources.emptyList);
    for (const item of items)
      this.console.write(format(item));
  }

  public writeStrings(payload: JsonValue): void {
    if (this.json) {
      this.writeJson(payload);
      return;
    }

    const items = JsonReader.fromValue({ [Resources.itemsField]: payload }).readStringArray(Resources.itemsField);
    if (items.length === 0)
      this.console.write(Resources.emptyList);
    for (const item of items)
      this.console.write(item);
  }

  public writeObject(payload: JsonValue, format: (item: JsonReader) => string): void {
    if (this.json)
      this.writeJson(payload);
    else
      this.console.write(format(JsonReader.fromValue(payload)));
  }

  public writeText(text: string, payload: JsonValue): void {
    if (this.json)
      this.writeJson(payload);
    else
      this.console.write(text);
  }

  public writeJsonOnly(payload: JsonValue): void {
    if (this.json)
      this.writeJson(payload);
  }

  private writeJson(payload: JsonValue): void {
    this.console.write(JSON.stringify(payload, null, Resources.jsonIndent));
  }
}
