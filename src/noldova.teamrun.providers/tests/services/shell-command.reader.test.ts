/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ShellCommandReader, ShellDialect } from "@noldova/teamrun.providers";

@TestClass
export class ShellCommandReaderTests {
  @TestMethod
  @TestData("\"C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe\" -Command 'Get-ChildItem -Force'", "Get-ChildItem -Force")
  @TestData("\"C:\\Program Files\\PowerShell\\7\\pwsh.exe\" -Command 'Get-ChildItem'", "Get-ChildItem")
  @TestData("powershell.exe -NoLogo -NoProfile -c 'Get-Date'", "Get-Date")
  @TestData("pwsh -NoProfile -Command 'try { [Console]::OutputEncoding=[System.Text.Encoding]::UTF8 } catch {}\nGet-Date'", "Get-Date")
  @TestData("pwsh -Command '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\nGet-Date'", "Get-Date")
  @TestData("pwsh -Command 'try{[System.Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()}catch{}\nGet-Date'", "Get-Date")
  @TestData("powershell -Command '  TRY { [console]::outputencoding=[Text.Encoding]::UTF8; } CATCH { }\r\nGet-Date'", "Get-Date")
  @TestData("pwsh -Command '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Date'", "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Date")
  @TestData("bash -c '[Console]::OutputEncoding=x\nls'", "[Console]::OutputEncoding=x\nls")
  @TestData("pwsh -Command \"Get-Content 'a b' | % { \"'$_ }'", "Get-Content 'a b' | % { $_ }")
  @TestData("cmd.exe /d /s /c 'dir /b'", "dir /b")
  @TestData("CMD /C 'echo hi'", "echo hi")
  @TestData("/bin/bash -lc 'ls -la'", "ls -la")
  @TestData("zsh -c \"echo \\\"\\$HOME\\\" \\\\ \\x\"", "echo \"$HOME\" \\ \\x")
  @TestData("sh\t-c\techo\\ hi", "echo hi")
  @TestData("bash -c ls\\", "ls\\")
  public readsTheScriptAShellWrapperRuns(command: string, expected: string): void {
    Assert.areEqual(expected, ShellCommandReader.innerCommand(command));
  }

  @TestMethod
  @TestData("npm test")
  @TestData("ls -la /tmp")
  @TestData("  ")
  @TestData("bash -x ls")
  @TestData("bash -lc ls extra")
  @TestData("bash -c ''")
  @TestData("bash -lc 'ls")
  @TestData("bash -lc \"ls\\")
  @TestData("pwsh -File x.ps1")
  @TestData("pwsh -File x.ps1 -Command 'Get-Date'")
  @TestData("pwsh -NoProfile -Command")
  @TestData("pwsh -c 'try { [Console]::OutputEncoding=[System.Text.Encoding]::UTF8 } catch {}\n'")
  @TestData("cmd /x dir")
  @TestData("cmd /c echo hi")
  public leavesACommandThatIsNotAWrapperAsItIs(command: string): void {
    Assert.isNull(ShellCommandReader.innerCommand(command));
  }

  @TestMethod
  public readsTheDialectOfTheShellAWrapperRuns(): void {
    Assert.areEqual(ShellDialect.Posix, ShellCommandReader.dialectOf("/bin/zsh -c ls"));
    Assert.areEqual(ShellDialect.Posix, ShellCommandReader.dialectOf("bash -lc 'ls -la'"));
    Assert.areEqual(ShellDialect.PowerShell, ShellCommandReader.dialectOf("powershell.exe -NoLogo -c 'Get-Date'"));
    Assert.areEqual(ShellDialect.PowerShell, ShellCommandReader.dialectOf("PWSH -Command 'Get-Date'"));
    Assert.areEqual(ShellDialect.Cmd, ShellCommandReader.dialectOf("cmd.exe /d /s /c 'dir /b'"));
    Assert.isNull(ShellCommandReader.dialectOf("npm test"));
    Assert.isNull(ShellCommandReader.dialectOf("bash -x ls"));
  }
}
