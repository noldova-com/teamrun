/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Provider } from "@noldova/teamrun.protocol";

import type { IAcpLevelReader } from "../../interfaces/i-acp-level.reader.js";
import type { AcpLaunch } from "../../models/acp-launch.js";
import { Resources } from "../../resources.js";

export class OpencodeLevelReader implements IAcpLevelReader {
  private readonly launcher: (provider: Provider | null, environment: NodeJS.ProcessEnv) => AcpLaunch;

  public constructor(launcher: (provider: Provider | null, environment: NodeJS.ProcessEnv) => AcpLaunch) {
    this.launcher = launcher;
  }

  public launch(provider: Provider | null, environment: NodeJS.ProcessEnv): AcpLaunch {
    return this.launcher(provider, environment);
  }

  public read(output: string): ReadonlyMap<string, readonly string[]> {
    const levels = new Map<string, readonly string[]>();
    const heads = [...output.matchAll(Resources.opencodeModelLinePattern)];
    heads.forEach((head, index) => {
      const variants = OpencodeLevelReader.variantsOf(output.slice(head.index + head[0].length, heads[index + 1]?.index ?? output.length));
      if (!Object.isNull(variants))
        levels.set(head[0].trim(), variants);
    });
    return levels;
  }

  private static variantsOf(block: string): readonly string[] | null {
    try {
      const model = JsonReader.parse(block);
      if (!model.hasField(Resources.opencodeVariantsField))
        return null;
      const variants = Object.keys(model.readObject(Resources.opencodeVariantsField).toJson());
      return variants.length === 0 ? variants : [...variants, Resources.opencodeDefaultVariant];
    }
    catch {
      return null;
    }
  }
}
