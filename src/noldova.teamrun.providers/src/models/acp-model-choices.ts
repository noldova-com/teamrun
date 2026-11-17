/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ProviderModel } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { AcpConfigOption } from "./acp-config-option.js";
import { AcpModelMember } from "./acp-model-member.js";

export class AcpModelChoices {
  private readonly option: AcpConfigOption;
  private readonly members: ReadonlyMap<string, AcpModelMember>;

  public constructor(option: AcpConfigOption, memberOf: (value: string, name: string) => AcpModelMember | null) {
    this.option = option;
    const grouped = option.groups.some(t => !Object.isNull(t));
    const found = option.values.map((value, index) => grouped ? AcpModelChoices.groupMemberOf(option, index) : memberOf(value, option.names[index]!));
    const members = found.map((member, index) => member ?? AcpModelChoices.defaultMemberOf(option, index, found));
    this.members = new Map(option.values.flatMap((value, index): [string, AcpModelMember][] => {
      const member = members[index]!;
      return Object.isNull(member) || !AcpModelChoices.joins(option, members, member) ? [] : [[value, member]];
    }));
  }

  public models(supportsImages: boolean | null, levels: AcpConfigOption | undefined): readonly ProviderModel[] {
    const models: ProviderModel[] = [];
    const families: Set<string> = new Set();
    for (const value of this.option.values) {
      const member = this.members.get(value);
      if (Object.isUndefined(member)) {
        models.push(new ProviderModel(value, this.option.nameOf(value), String.empty, levels?.values ?? [], value === this.option.currentValue, null, supportsImages,
          Object.isUndefined(levels) ? null : levels.currentValue, Object.fromEntries(levels?.values.map(t => [t, levels.nameOf(t)]) ?? [])));
        continue;
      }
      if (families.has(member.familyId))
        continue;
      families.add(member.familyId);
      const values = this.valuesOf(member.familyId);
      models.push(new ProviderModel(member.familyId, member.familyName, String.empty, values, values.includes(this.option.currentValue), null, supportsImages,
        values.includes(member.familyId) ? member.familyId : null, Object.fromEntries(values.map(t => [t, this.members.get(t)!.levelName])), [], null, null, null,
        this.resolve(member.familyId, null)[0]));
    }
    return models;
  }

  public resolve(model: string | null, effort: string | null): [value: string | null, takesEffort: boolean] {
    const values = this.valuesOf(model ?? this.familyOf(this.option.currentValue) ?? this.option.currentValue);
    if (values.length === 0)
      return [model, false];
    if (!Object.isNull(effort) && values.includes(effort))
      return [effort, true];
    if (values.includes(this.option.currentValue))
      return [this.option.currentValue, true];
    return [!Object.isNull(model) && values.includes(model) ? model : values[0]!, true];
  }

  public familyOf(value: string): string | null {
    return this.members.get(value)?.familyId ?? null;
  }

  private static groupMemberOf(option: AcpConfigOption, index: number): AcpModelMember | null {
    const group = option.groups[index]!;
    if (Object.isNull(group))
      return null;
    const groupName = option.groupNames[index] ?? group;
    const levels = option.names.filter((_, at) => option.groups[at] === group).map(t => AcpModelChoices.levelIn(t, groupName));
    return levels.some(t => Object.isNull(t)) ? null : new AcpModelMember(group, groupName, AcpModelChoices.levelIn(option.names[index]!, groupName)!);
  }

  private static levelIn(name: string, groupName: string): string | null {
    const prefix = `${groupName} (`.toLowerCase();
    const level = name.toLowerCase().startsWith(prefix) && name.endsWith(")") ? name.slice(prefix.length, -1) : name;
    return Resources.acpLevelNamePattern.test(level) ? level : null;
  }

  private static defaultMemberOf(option: AcpConfigOption, index: number, found: readonly (AcpModelMember | null)[]): AcpModelMember | null {
    const value = option.values[index]!;
    const name = option.names[index]!;
    return found.some(t => t?.familyId === value && t.familyName === name) ? new AcpModelMember(value, name, Resources.acpDefaultLevelName) : null;
  }

  private static joins(option: AcpConfigOption, members: readonly (AcpModelMember | null)[], member: AcpModelMember): boolean {
    const family = members.filter(t => t?.familyId === member.familyId);
    return family.length > 1 && family.every(t => t!.familyName === member.familyName)
      && !option.values.some((value, index) => value === member.familyId && Object.isNull(members[index]));
  }

  private valuesOf(familyId: string): string[] {
    return this.option.values.filter(t => this.members.get(t)?.familyId === familyId);
  }
}
