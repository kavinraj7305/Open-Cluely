const { spawn } = require('child_process');

const POLL_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ChordKeys {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
  public static bool Down(int vKey) {
    return (GetAsyncKeyState(vKey) & 0x8000) != 0;
  }
}
"@
$graveWas = $false
$armedUntil = [int64]0
$letterWas = @{ S = $false; A = $false; C = $false; H = $false; LEFT = $false; RIGHT = $false; UP = $false; DOWN = $false }
$letterCodes = @{ S = 0x53; A = 0x41; C = 0x43; H = 0x48; LEFT = 0x25; UP = 0x26; RIGHT = 0x27; DOWN = 0x28 }
while ($true) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $ctrl = [ChordKeys]::Down(0x11)
  $alt = [ChordKeys]::Down(0x12)
  $win = [ChordKeys]::Down(0x5B) -or [ChordKeys]::Down(0x5C)
  $grave = [ChordKeys]::Down(0xC0) -or [ChordKeys]::Down(0xE2)

  if ($grave -and -not $graveWas -and -not $ctrl -and -not $alt -and -not $win) {
    $armedUntil = $now + 2000
  }
  $graveWas = $grave

  if (-not $ctrl -and -not $alt -and -not $win) {
    foreach ($letter in @('S','A','C','H','LEFT','RIGHT','UP','DOWN')) {
      $down = [ChordKeys]::Down([int]$letterCodes[$letter])
      if ($down -and -not $letterWas[$letter] -and ($grave -or $now -lt $armedUntil)) {
        Write-Output $letter
        [Console]::Out.Flush()
        $armedUntil = 0
      }
      $letterWas[$letter] = $down
    }
  }

  Start-Sleep -Milliseconds 25
}
`.trim();

function startWindowsChordPoller(onLetter) {
  if (process.platform !== 'win32' || typeof onLetter !== 'function') {
    return null;
  }

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', POLL_SCRIPT],
    {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    String(chunk)
      .split(/\r?\n/)
      .map((line) => line.trim().toUpperCase())
      .filter((line) => ['S', 'A', 'C', 'H', 'LEFT', 'RIGHT', 'UP', 'DOWN'].includes(line))
      .forEach((letter) => onLetter(letter));
  });

  child.stderr.on('data', (chunk) => {
    const message = String(chunk || '').trim();
    if (message) {
      console.error('Windows chord poller:', message);
    }
  });

  child.on('exit', (code) => {
    console.warn('Windows chord poller exited:', code);
  });

  console.log('Started Windows global `+S/A/C/H/arrows poller');
  return child;
}

function stopWindowsChordPoller(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill();
  } catch (error) {
    console.error('Failed to stop Windows chord poller:', error);
  }
}

module.exports = {
  startWindowsChordPoller,
  stopWindowsChordPoller
};
