/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TotalsException from "./totals.exception.ts";

export default class JsonFields {
  private readonly value: object;
  private readonly source: string;
  private readonly place: readonly string[];

  public constructor(value: unknown, source: string, place: readonly string[] = []) {
    this.source = source;
    this.place = place;
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new TotalsException(`${this.subject} is not a JSON object.`);
    this.value = value;
  }

  public static parse(text: string, source: string): JsonFields {
    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new TotalsException(`${source} is not JSON.`, { cause: error });
    }
    return new JsonFields(value, source);
  }

  public count(name: string): number {
    const value: unknown = Reflect.get(this.value, name);
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      throw new TotalsException(`${this.subject} has no count ${name}.`);
    return value;
  }

  public text(name: string): string {
    const value: unknown = Reflect.get(this.value, name);
    if (typeof value !== "string")
      throw new TotalsException(`${this.subject} has no text ${name}.`);
    return value;
  }

  public list(name: string): readonly unknown[] {
    const value: unknown = Reflect.get(this.value, name);
    if (!Array.isArray(value))
      throw new TotalsException(`${this.subject} has no list ${name}.`);
    return value;
  }

  public texts(name: string): readonly string[] {
    const values = this.list(name);
    if (values.some(t => typeof t !== "string"))
      throw new TotalsException(`${this.subject} has a list ${name} that is not all text.`);
    return values.map(t => String(t));
  }

  public objects(name: string): readonly JsonFields[] {
    return this.list(name).map((t, i) => new JsonFields(t, this.source, [...this.place, `${name} ${i + 1}`]));
  }

  public object(name: string): JsonFields {
    return new JsonFields(Reflect.get(this.value, name), this.source, [...this.place, name]);
  }

  public has(name: string): boolean {
    return Reflect.has(this.value, name) && Reflect.get(this.value, name) !== null;
  }

  private get subject(): string {
    return this.place.length === 0 ? this.source : `${[this.source, ...this.place].join(", ")},`;
  }
}
