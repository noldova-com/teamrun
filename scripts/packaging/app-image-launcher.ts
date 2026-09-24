/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export default class AppImageLauncher {
  private static readonly CONTENT: string = [
    "#!/usr/bin/env bash",
    "# @license",
    "# Copyright (c) Noldova.",
    "#",
    "# This source code is licensed under the license found in the",
    "# LICENSE file in the root directory of this source tree.",
    "",
    "set -e",
    'APPDIR="$(dirname "$(readlink -f "$0")")"',
    "export APPDIR",
    'export PATH="${APPDIR}:${APPDIR}/usr/sbin${PATH:+:${PATH}}"',
    'export XDG_DATA_DIRS="${APPDIR}/usr/share/${XDG_DATA_DIRS:+:${XDG_DATA_DIRS}}:/usr/share/gnome:/usr/local/share/:/usr/share/"',
    'export LD_LIBRARY_PATH="${APPDIR}/usr/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"',
    'export GSETTINGS_SCHEMA_DIR="${APPDIR}/usr/share/glib-2.0/schemas${GSETTINGS_SCHEMA_DIR:+:${GSETTINGS_SCHEMA_DIR}}"',
    'exec "$APPDIR/teamrun" "$@"',
    ""
  ].join("\n");

  public static async write(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, AppImageLauncher.CONTENT, { encoding: "utf8", mode: 0o755 });
  }
}
