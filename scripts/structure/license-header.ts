/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class LicenseHeader {
  private static readonly NOTICE: readonly string[] = [
    "@license",
    "Copyright (c) Noldova.",
    "",
    "This source code is licensed under the license found in the",
    "LICENSE file in the root directory of this source tree."
  ];

  public static readonly BLOCK: string = ["/**", ...LicenseHeader.NOTICE.map(t => ` *${LicenseHeader.indent(t)}`), " */", ""].join("\n");
  public static readonly MARKUP: string = ["<!--", ...LicenseHeader.NOTICE, "-->", ""].join("\n");
  public static readonly YAML: string = [...LicenseHeader.NOTICE.map(t => `#${LicenseHeader.indent(t)}`), ""].join("\n");

  private static indent(line: string): string {
    return line === "" ? "" : ` ${line}`;
  }
}
