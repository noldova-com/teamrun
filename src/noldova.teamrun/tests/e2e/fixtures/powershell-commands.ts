/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class PowershellCommands {
  public static say(text: string): string {
    return `'${text}'`;
  }

  public static write(file: string, value: string): string {
    return `[System.IO.File]::WriteAllText('${file}', [string](${value}))`;
  }

  public static move(from: string, to: string): string {
    return `if ([System.IO.File]::Exists('${to}')) { [System.IO.File]::Replace('${from}', '${to}', [NullString]::Value) } else { [System.IO.File]::Move('${from}', '${to}') }`;
  }

  public static pause(milliseconds: number): string {
    return `[System.Threading.Thread]::Sleep(${String(milliseconds)})`;
  }
}
