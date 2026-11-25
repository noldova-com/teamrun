/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";

import "@noldova/context.core";

export class PreBundleRun {
  public static readonly FOLDER: string = "node_modules/.vite";
  public static readonly VARIABLE: string = "NOLDOVA_PRE_BUNDLE_RUN";

  private static readonly NAME: string = "noldova-pre-bundle-run";
  private static readonly KEY: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

  private readonly folder: string | null;

  public readonly name: string = PreBundleRun.NAME;
  public readonly config: () => { readonly cacheDir: string } | null = () => Object.isNull(this.folder) ? null : { cacheDir: this.folder };

  public constructor(directory: string, environment: NodeJS.ProcessEnv) {
    const key = environment[PreBundleRun.VARIABLE];
    this.folder = !Object.isUndefined(key) && PreBundleRun.KEY.test(key) ? path.join(directory, PreBundleRun.FOLDER, key) : null;
  }

  public static environment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return { ...environment, [PreBundleRun.VARIABLE]: randomUUID() };
  }
}
