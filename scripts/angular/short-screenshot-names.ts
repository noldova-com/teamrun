/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { basename, dirname, extname, join } from "node:path";

import type { IScreenshotCommandContext } from "./interfaces/i-screenshot-command-context.ts";
import type { IScreenshotOptions } from "./interfaces/i-screenshot-options.ts";
import type { ISavedScreenshot } from "./interfaces/i-saved-screenshot.ts";

export class ShortScreenshotNames {
  public static readonly NAME_LIMIT: number = 255;
  private static readonly TAKE: string = "__vitest_takeScreenshot";
  private static readonly HASH: string = "sha256";
  private static readonly HASH_LENGTH: number = 16;
  private static readonly SEPARATOR: string = "-";
  private static readonly BASE64: BufferEncoding = "base64";

  public readonly screenshot: (context: IScreenshotCommandContext, name: string, options?: IScreenshotOptions) => Promise<string | ISavedScreenshot> =
    (context, name, options = {}) => this.takeAsync(context, name, options);

  public static shorten(path: string): string {
    const name = basename(path);
    if (Buffer.byteLength(name) <= ShortScreenshotNames.NAME_LIMIT)
      return path;
    const extension = extname(name);
    const hash = createHash(ShortScreenshotNames.HASH).update(name).digest("hex").slice(0, ShortScreenshotNames.HASH_LENGTH);
    const room = ShortScreenshotNames.NAME_LIMIT - Buffer.byteLength(`${ShortScreenshotNames.SEPARATOR}${hash}${extension}`);
    let cut = "";
    for (const character of name.slice(0, name.length - extension.length)) {
      if (Buffer.byteLength(cut + character) > room)
        break;
      cut += character;
    }
    return join(dirname(path), `${cut}${ShortScreenshotNames.SEPARATOR}${hash}${extension}`);
  }

  private async takeAsync(context: IScreenshotCommandContext, name: string, options: IScreenshotOptions): Promise<string | ISavedScreenshot> {
    const save = options.save ?? true;
    const base64 = save ? options.base64 : true;
    const target = options.path ?? name;
    const short = ShortScreenshotNames.shorten(target);
    const sent = options.path === undefined ? { ...options, save, base64 } : { ...options, save, base64, path: short };
    const taken = await context.triggerCommand(ShortScreenshotNames.TAKE, options.path === undefined ? short : name, sent);
    if (short !== target)
      context.project.vitest.logger.log(`Screenshot of "${basename(target)}": ${taken.path}`);
    if (!save)
      return taken.buffer.toString(ShortScreenshotNames.BASE64);
    return base64 === true ? { path: taken.path, base64: taken.buffer.toString(ShortScreenshotNames.BASE64) } : taken.path;
  }
}
