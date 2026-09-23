/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export default class WindowsInstallerPolicy {
  private static readonly WINDOWS_INSTALLER_POLICY: string = [
    "# @license",
    "# Copyright (c) Noldova.",
    "#",
    "# This source code is licensed under the license found in the",
    "# LICENSE file in the root directory of this source tree.",
    "",
    "!macro customInit",
    "  ${If} $hasPerMachineInstallation == \"1\"",
    "  ${AndIf} $hasPerUserInstallation == \"1\"",
    "    !insertmacro GetDParameter $R0",
    "    ${If} $R0 != \"\"",
    "      ${If} $R0 == $perMachineInstallationFolder",
    "      ${AndIf} $R0 != $PerUserInstallationFolder",
    "        StrCpy $hasPerMachineInstallation \"1\"",
    "        StrCpy $hasPerUserInstallation \"0\"",
    "        !insertmacro setInstallModePerAllUsers",
    "      ${ElseIf} $R0 == $PerUserInstallationFolder",
    "      ${AndIf} $R0 != $perMachineInstallationFolder",
    "        StrCpy $hasPerMachineInstallation \"0\"",
    "        StrCpy $hasPerUserInstallation \"1\"",
    "        !insertmacro setInstallModePerUser",
    "      ${EndIf}",
    "    ${EndIf}",
    "  ${EndIf}",
    "  ${If} $hasPerMachineInstallation == \"1\"",
    "  ${AndIf} $hasPerUserInstallation == \"1\"",
    "    ${If} ${Silent}",
    "      SetErrorLevel 2",
    "      Quit",
    "    ${EndIf}",
    "  ${ElseIf} ${isUpdated}",
    "    SetSilent silent",
    "  ${EndIf}",
    "!macroend",
    "",
    "!macro customInstallMode",
    "  ${If} $hasPerMachineInstallation == \"1\"",
    "  ${AndIf} $hasPerUserInstallation == \"1\"",
    "    # An ambiguous manual reinstall keeps the existing scope selector.",
    "  ${ElseIf} $installMode == \"all\"",
    "    StrCpy $isForceMachineInstall \"1\"",
    "  ${Else}",
    "    StrCpy $isForceCurrentInstall \"1\"",
    "  ${EndIf}",
    "!macroend",
    ""
  ].join("\n");
  private static readonly UTF8_ENCODING: BufferEncoding = "utf8";

  public static async write(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, WindowsInstallerPolicy.WINDOWS_INSTALLER_POLICY, WindowsInstallerPolicy.UTF8_ENCODING);
  }
}
