/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageNaming from "../packages/package-naming.ts";

export default class ModuleNameMatcher {
  private static readonly PACKAGE_END: RegExp = /[^@a-z0-9/-][\s\S]*$/;
  private static readonly NAME_SEPARATOR: string = ".";

  private readonly moduleIds: readonly string[];
  private readonly packagePrefixes: readonly string[];
  private readonly patterns: ReadonlyMap<string, RegExp>;

  public constructor(moduleIds: readonly string[]) {
    const longestFirst = [...moduleIds].sort((first, second) => second.length - first.length);
    this.moduleIds = moduleIds;
    this.packagePrefixes = longestFirst.map(t => PackageNaming.locateModulePrefix(t, false));
    this.patterns = new Map(longestFirst.map(t => [t, new RegExp(`(?<![a-z0-9-])modules/${t}(?![a-z0-9-])|(?<![a-z0-9])tr-${t}(?![a-z0-9])`)]));
  }

  public findInLiteral(value: string): string | null {
    const id = this.moduleIds.find(t => value === t || value.startsWith(`${t}${ModuleNameMatcher.NAME_SEPARATOR}`));
    return id === undefined ? this.findInText(value) : ModuleNameMatcher.formatModule(id);
  }

  public findInText(text: string): string | null {
    for (const prefix of this.packagePrefixes) {
      const start = text.indexOf(prefix);
      if (start !== -1)
        return `the module package "${text.slice(start).replace(ModuleNameMatcher.PACKAGE_END, "")}"`;
    }

    for (const [id, pattern] of this.patterns)
      if (pattern.test(text))
        return ModuleNameMatcher.formatModule(id);
    return null;
  }

  private static formatModule(id: string): string {
    return `module "${id}"`;
  }
}
