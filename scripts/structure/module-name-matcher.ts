/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ModuleNameMatcher {
  private static readonly MODULE_PACKAGE: RegExp = /@noldova\/teamrun-modules-[a-z0-9-]*/;
  private static readonly NAME_SEPARATOR: string = ".";

  private readonly moduleIds: readonly string[];
  private readonly patterns: ReadonlyMap<string, RegExp>;

  public constructor(moduleIds: readonly string[]) {
    this.moduleIds = moduleIds;
    this.patterns = new Map([...moduleIds].sort((first, second) => second.length - first.length).map(t => [t, new RegExp(`(?<![a-z0-9-])modules/${t}(?![a-z0-9-])|(?<![a-z0-9])tr-${t}(?![a-z0-9])`)]));
  }

  public findInLiteral(value: string): string | null {
    const id = this.moduleIds.find(t => value === t || value.startsWith(`${t}${ModuleNameMatcher.NAME_SEPARATOR}`));
    return id === undefined ? this.findInText(value) : ModuleNameMatcher.formatModule(id);
  }

  public findInText(text: string): string | null {
    const modulePackage = ModuleNameMatcher.MODULE_PACKAGE.exec(text);
    if (modulePackage !== null)
      return `the module package "${modulePackage[0]}"`;

    for (const [id, pattern] of this.patterns)
      if (pattern.test(text))
        return ModuleNameMatcher.formatModule(id);
    return null;
  }

  private static formatModule(id: string): string {
    return `module "${id}"`;
  }
}
