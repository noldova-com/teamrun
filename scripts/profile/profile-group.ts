/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProfileException } from "./profile.exception.ts";
import type { ProfileNode } from "./profile.node.ts";

export class ProfileGroup {
  public static readonly KNOWN: readonly ProfileGroup[] = [
    new ProfileGroup("keep", ["keep"]),
    new ProfileGroup("overlay", ["reposition", "show", "boundsFor"]),
    new ProfileGroup("highlight", ["tokens", "tokensAsync", "loadLanguageAsync", "createOnigScanner", "tokenizeLine2"])
  ];
  private static readonly NAMED: RegExp = /^([\w-]+)=([\w$]+(?:\+[\w$]+)*)$/;
  private static readonly FUNCTION_SEPARATOR: string = "+";

  public readonly name: string;
  public readonly functionNames: ReadonlySet<string>;

  public constructor(name: string, functionNames: readonly string[]) {
    this.name = name;
    this.functionNames = new Set(functionNames);
  }

  public static parse(text: string): ProfileGroup {
    const known = ProfileGroup.KNOWN.find(t => t.name === text);
    if (known !== undefined)
      return known;
    const named = ProfileGroup.NAMED.exec(text);
    if (named === null)
      throw new ProfileException(`"${text}" is neither a known group, ${ProfileGroup.KNOWN.map(t => t.name).join(", ")}, nor <name>=<function>+<function>.`);
    return new ProfileGroup(named[1]!, named[2]!.split(ProfileGroup.FUNCTION_SEPARATOR));
  }

  public includes(node: ProfileNode): boolean {
    return this.functionNames.has(node.functionName);
  }
}
