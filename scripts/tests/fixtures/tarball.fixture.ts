/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gzipSync } from "node:zlib";

export default class TarballFixture {
  public static readonly FILE: string = "0";
  public static readonly DIRECTORY: string = "5";

  private static readonly BLOCK_SIZE: number = 512;
  private static readonly OCTAL: number = 8;

  public static packFiles(files: Readonly<Record<string, string>>): Buffer {
    return TarballFixture.pack(Object.entries(files).map(([name, content]) => ({ name: `package/${name}`, content })));
  }

  public static pack(entries: readonly { readonly name: string; readonly content: string; readonly type?: string; readonly prefix?: string }[]): Buffer {
    const blocks = entries.flatMap(t => {
      const content = Buffer.from(t.content);
      const padding = Buffer.alloc((TarballFixture.BLOCK_SIZE - content.length % TarballFixture.BLOCK_SIZE) % TarballFixture.BLOCK_SIZE);
      return [TarballFixture.createHeader(t.name, content.length, t.type ?? TarballFixture.FILE, t.prefix ?? ""), content, padding];
    });
    return gzipSync(Buffer.concat([...blocks, Buffer.alloc(TarballFixture.BLOCK_SIZE * 2)]));
  }

  private static createHeader(name: string, size: number, type: string, prefix: string): Buffer {
    const header = Buffer.alloc(TarballFixture.BLOCK_SIZE);
    header.write(name, 0, 100);
    header.write("0000644", 100);
    header.write("0000000", 108);
    header.write("0000000", 116);
    header.write(size.toString(TarballFixture.OCTAL).padStart(11, "0"), 124);
    header.write("00000000000", 136);
    header.write(" ".repeat(8), 148);
    header.write(type, 156);
    header.write("ustar", 257);
    header.write("00", 263);
    header.write(prefix, 345, 155);
    const checksum = header.reduce((sum, value) => sum + value, 0);
    header.write(`${checksum.toString(TarballFixture.OCTAL).padStart(6, "0")}`, 148);
    header[154] = 0;
    return header;
  }
}
