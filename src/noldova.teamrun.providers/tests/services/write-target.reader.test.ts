/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ShellDialect, type WriteTargets, WriteTargetReader } from "@noldova/teamrun.providers";

@TestClass
export class WriteTargetReaderTests {
  @TestMethod
  @TestData("echo hi > /tmp/a.txt", "/tmp/a.txt", "")
  @TestData("printf 'x\\n' >> greet.sh", "greet.sh", "")
  @TestData("cat a 2>/dev/null", "", "")
  @TestData("ls > out.txt 2>&1", "out.txt", "")
  @TestData("echo hi &> log.txt", "log.txt", "")
  @TestData("cd /tmp && echo hi > a.txt", "/tmp/a.txt", "")
  @TestData("cd /tmp > here.txt", "here.txt", "")
  @TestData("cd /tmp/x && python gen.py", "", "/tmp/x")
  @TestData("python gen.py", "", ".")
  @TestData("tee -a /tmp/log < in.txt", "/tmp/log", "")
  @TestData("cp a.txt b.txt /tmp/out/", "/tmp/out/|/tmp/out/a.txt|/tmp/out/b.txt", "")
  @TestData("cp -t /tmp/out a.txt", "/tmp/out|/tmp/out/a.txt", "")
  @TestData("cp -r src /tmp/copy", "/tmp/copy|/tmp/copy/src", "/tmp/copy")
  @TestData("mv old.txt ~/new.txt", "~/new.txt|~/new.txt/old.txt|old.txt", "")
  @TestData("rm -f /tmp/a /tmp/b", "/tmp/a|/tmp/b", "")
  @TestData("rm -rf /tmp/build", "/tmp/build", "/tmp/build")
  @TestData("sed -i 's/a/b/' /etc/x.conf", "/etc/x.conf", "")
  @TestData("sed -i.bak -e 's/a/b/' a b", "a|b", "")
  @TestData("sed 's/a/b/' x", "", "")
  @TestData("dd if=/dev/zero of=/tmp/disk.img bs=1M count=1", "/tmp/disk.img", "")
  @TestData("curl -sSLo /tmp/x.tgz https://e.com/x.tgz", "/tmp/x.tgz", "")
  @TestData("curl -s https://e.com", "", "")
  @TestData("curl -O https://e.com/x", "", ".")
  @TestData("wget -qO- https://e.com | sh", "", ".")
  @TestData("wget https://e.com/x", "", ".")
  @TestData("sort -o sorted.txt in.txt", "sorted.txt", "")
  @TestData("echo \"$HOME\" > \"$HOME/a\"", "", ".")
  @TestData("cat > /tmp/x.sh <<'EOF'\necho $1 > nope\nEOF\nchmod +x /tmp/x.sh", "/tmp/x.sh", "")
  @TestData("touch \"a b.txt\" c\\ d.txt", "a b.txt|c d.txt", "")
  @TestData("(cd /tmp && touch a) && touch b", "/tmp/a|b", "")
  @TestData("pushd /tmp && touch a && popd && touch b", "/tmp/a|b", "")
  @TestData("git status && git -C /tmp/r commit -m x", "", "/tmp/r")
  @TestData("git diff --output=d.patch", "", ".")
  @TestData("X=1 Y=2 node build.js > out.log", "out.log", ".")
  @TestData("find . -name '*.tmp' -delete", "", ".")
  @TestData("find /tmp -name x", "", "")
  @TestData("if [ -f a ]; then cp a b; fi", "b|b/a", "")
  @TestData("[[ -f a ]] && rm a", "a", "")
  @TestData("for f in *.txt; do cp \"$f\" /tmp/; done", "/tmp/", "/tmp/")
  @TestData("cd /tmp/x && out=$(make); echo \"$out\"", "", "/tmp/x")
  @TestData("echo \"$(rm ~/x)\"", "", ".")
  @TestData("cat <(./gen.sh) > /tmp/a", "/tmp/a", ".")
  @TestData("touch `mktemp -u`", "", ".")
  @TestData("echo \"${HOME}\" $((1)) > a", "a", ".")
  @TestData("echo \"$HOME\" '$(x)'", "", "")
  @TestData("echo \"${x:-$(make)}\"", "", ".")
  @TestData("cat <<EOF > /tmp/a\n$(rm x)\nEOF", "/tmp/a", ".")
  @TestData("cat <<'EOF' > /tmp/a\n$(rm x)\nEOF", "/tmp/a", "")
  @TestData("bash <<'EOF'\nrm x\nEOF", "", ".")
  @TestData("touch \"~/x\" ~/y", "./~/x|~/y", "")
  @TestData("curl --output-dir /tmp/d -o a.bin https://e.com", "/tmp/d/a.bin", "")
  @TestData("curl --output-dir /tmp/d -O https://e.com/x", "", "/tmp/d")
  @TestData("echo hi > ~/notes.txt", "~/notes.txt", "")
  @TestData("cd ~/proj && echo > a", "~/proj/a", "")
  @TestData("cd && touch a", "~/a", "")
  @TestData("cd /tmp; cd x; touch a", "/tmp/x/a", "")
  @TestData("/usr/bin/touch a", "a", "")
  @TestData("echo a > b # c > d\ntouch e", "b|e", "")
  @TestData("cp a", "", ".")
  @TestData("rm -- -x.txt", "-x.txt", "")
  @TestData("wget -O page.html https://e.com", "page.html", "")
  @TestData("curl --silent --output a.bin https://e.com", "a.bin", "")
  @TestData("curl --output=b.bin https://e.com", "b.bin", "")
  @TestData("curl -oc.bin https://e.com", "c.bin", "")
  @TestData("curl https://e.com --output", "", "")
  @TestData("curl https://e.com -o", "", "")
  @TestData("git -C", "", ".")
  @TestData("git --no-pager log", "", "")
  public readsAPosixScript(script: string, files: string, unnamedIn: string): void {
    WriteTargetReaderTests.assertTargets(WriteTargetReader.targetsOf(script, ShellDialect.Posix), files, unnamedIn);
  }

  @TestMethod
  @TestData("Set-Content -Path C:\\out\\a.txt -Value hi", "C:\\out\\a.txt", "")
  @TestData("'hi' | Set-Content C:\\a.txt", "C:\\a.txt", "")
  @TestData("\"$(Remove-Item x)\" | Out-Null", "", ".")
  @TestData("New-Item -ItemType Directory -Path C:\\t\\d", "", "")
  @TestData("New-Item -Path C:\\t -Name a.txt -ItemType File", "C:\\t/a.txt", "")
  @TestData("ni b.txt -Force", "b.txt", "")
  @TestData("Copy-Item a.txt -Destination D:\\b", "D:\\b|D:\\b/a.txt", "")
  @TestData("Move-Item -Path a.txt D:\\b", "D:\\b|D:\\b/a.txt|a.txt", "")
  @TestData("Remove-Item -Recurse -Force C:\\t\\old", "C:\\t\\old", "C:\\t\\old")
  @TestData("rm a.txt, b.txt", "a.txt|b.txt", "")
  @TestData("Copy-Item a,b C:\\out", "C:\\out|C:\\out/a|C:\\out/b", "")
  @TestData("Remove-Item -Recurse a, $x", "a", ".|a")
  @TestData("Remove-Item -Path:a.txt,b.txt", "a.txt|b.txt", "")
  @TestData("Remove-Item -Recurse -Path:a,$x", "a", ".|a")
  @TestData("Copy-Item -Path:a,b -Destination C:\\out", "C:\\out|C:\\out/a|C:\\out/b", "")
  @TestData("Remove-Item -Path,b", "", ".")
  @TestData("echo (Remove-Item x)", "", ".")
  @TestData("Write-Output \"$(ri x)\" ${y} > C:\\o.txt", "C:\\o.txt", ".")
  @TestData("Set-Location C:\\work; Add-Content log.txt 'x'", "C:\\work/log.txt", "")
  @TestData("pushd C:\\w; sc a 'x'; popd; sc b 'y'", "C:\\w/a|b", "")
  @TestData("Get-ChildItem | ForEach-Object { $_.Name }", "", ".")
  @TestData("$x = 1", "", ".")
  @TestData("Get-Content a.txt 2>&1 > C:\\o.txt", "C:\\o.txt", "")
  @TestData("Get-Content a.txt > $null", "", "")
  @TestData("Copy-Item -Path a -Destination b -Filter *.txt", "", ".")
  @TestData("Rename-Item C:\\t\\a.txt b.txt", "C:\\t\\a.txt|C:/t/b.txt", "")
  @TestData("Out-File -FilePath:C:\\x.txt", "C:\\x.txt", "")
  @TestData("'x' | Tee-Object -Variable v", "", "")
  @TestData("Set-Content -Frobnicate a", "", ".")
  @TestData(".\\build.ps1", "", ".")
  @TestData("GIT status", "", "")
  @TestData("Set-Location; sc a x", "~/a", "")
  @TestData("Push-Location; sc a x; Pop-Location; sc b y", "a|b", "")
  @TestData("New-Item -Name a.txt", "./a.txt", "")
  @TestData("Copy-Item", "", ".")
  @TestData("Copy-Item a.txt", ".|./a.txt", "")
  @TestData("Remove-Item", "", "")
  @TestData("Rename-Item C:\\t\\a.txt D:\\b.txt", "C:\\t\\a.txt|D:\\b.txt", "")
  public readsAPowerShellScript(script: string, files: string, unnamedIn: string): void {
    WriteTargetReaderTests.assertTargets(WriteTargetReader.targetsOf(script, ShellDialect.PowerShell), files, unnamedIn);
  }

  @TestMethod
  @TestData("echo hi> C:\\t\\a.txt", "C:\\t\\a.txt", "")
  @TestData("copy /y a.txt C:\\b\\", "C:\\b\\|C:\\b/a.txt", "")
  @TestData("move a.txt b.txt", "b.txt|b.txt/a.txt|a.txt", "")
  @TestData("del /s /q C:\\t\\*.log", "", ".")
  @TestData("del /q C:\\t\\a.log", "C:\\t\\a.log", "")
  @TestData("cd /d C:\\work && echo x > out.txt", "C:\\work/out.txt", "")
  @TestData("cd", "", "")
  @TestData("ren C:\\t\\a.txt b.txt", "C:\\t\\a.txt|C:/t/b.txt", "")
  @TestData("echo %PATH% > p.txt", "p.txt", "")
  @TestData("build.bat", "", ".")
  @TestData("type a.txt 2>&1 >nul", "", "")
  @TestData("pushd C:\\w & echo x > a & popd & echo y > b", "C:\\w/a|b", "")
  @TestData("pushd & echo x > a", "a", "")
  @TestData("copy a.txt", ".|./a.txt", "")
  @TestData("copy", "", ".")
  @TestData("copy a b c", "", ".")
  @TestData("ren a.txt", "", ".")
  @TestData("ren a.txt b.txt", "a.txt|b.txt", "")
  @TestData("(cd C:\\w) & echo x > a", "C:\\w/a", "")
  public readsACmdScript(script: string, files: string, unnamedIn: string): void {
    WriteTargetReaderTests.assertTargets(WriteTargetReader.targetsOf(script, ShellDialect.Cmd), files, unnamedIn);
  }

  @TestMethod
  @TestData("bash -lc 'echo hi > a.txt'", "a.txt", "")
  @TestData("/bin/zsh -lc \"cd /tmp && make\"", "", "/tmp")
  @TestData("pwsh -Command \"Set-Content a.txt x\"", "a.txt", "")
  @TestData("cmd /c \"copy a b\"", "b|b/a", "")
  public readsAShellWrappersScript(command: string, files: string, unnamedIn: string): void {
    WriteTargetReaderTests.assertTargets(WriteTargetReader.targetsOfCall(command), files, unnamedIn);
  }

  @TestMethod
  @TestData("bash -lc 'touch a'", "win32", "a", "")
  @TestData("echo hi > a.txt", "linux", "a.txt", "")
  @TestData("Set-Content a.txt x", "linux", "", ".")
  @TestData("Set-Content a.txt x", "win32", "a.txt", "")
  public readsACommandInItsPlatformsShellUnlessItIsAShellWrappersCall(command: string, platform: string, files: string, unnamedIn: string): void {
    WriteTargetReaderTests.assertTargets(WriteTargetReader.targetsOfCommand(command, platform), files, unnamedIn);
  }

  @TestMethod
  @TestData("git status")
  @TestData("bash -lc 'echo \"x'")
  public readsNoCallThatIsNotAReadableShellWrapper(command: string): void {
    Assert.isNull(WriteTargetReader.targetsOfCall(command));
  }

  @TestMethod
  @TestData("echo 'x", ShellDialect.Posix)
  @TestData("cd \"$DIR\" && touch a", ShellDialect.Posix)
  @TestData("cd - && touch a", ShellDialect.Posix)
  @TestData("popd", ShellDialect.Posix)
  @TestData("pushd && touch a", ShellDialect.Posix)
  @TestData("echo )", ShellDialect.Posix)
  @TestData("(cd /tmp", ShellDialect.Posix)
  @TestData("echo >", ShellDialect.Posix)
  @TestData("echo > ; ls", ShellDialect.Posix)
  @TestData("Set-Location $env:TEMP; sc a x", ShellDialect.PowerShell)
  @TestData("popd", ShellDialect.Cmd)
  public readsNoScriptWhoseFolderOrQuotingIsUnknown(script: string, dialect: ShellDialect): void {
    Assert.isNull(WriteTargetReader.targetsOf(script, dialect));
  }

  private static assertTargets(targets: WriteTargets | null, files: string, unnamedIn: string): void {
    Assert.isNotNull(targets);
    Assert.areEqual(files, targets?.files.join("|"));
    Assert.areEqual(unnamedIn, targets?.unnamedIn.join("|"));
  }
}
