const { GlobalKeyboardListener } = require('node-global-key-listener');
const {
  getKeyboardShortcutAccelerator,
  getZeroChordKeyFromAccelerator,
  shortcutAcceleratorUsesZeroPrefix
} = require('../../../config');
const {
  armZeroChord,
  consumeZeroChordArm,
  getChordLetterFromEvent,
  isZeroChordActive,
  isZeroKeyEvent
} = require('./zero-chord-state');
const {
  startWindowsChordPoller,
  stopWindowsChordPoller
} = require('./windows-chord-poller');

let keyboardListener = null;
let zeroPrefixListener = null;
let windowsPoller = null;
let lastChordActionAt = 0;

function hasBlockingModifiers(down = {}) {
  return Boolean(
    down['LEFT CONTROL'] ||
    down['RIGHT CONTROL'] ||
    down['LEFT CTRL'] ||
    down['RIGHT CTRL'] ||
    down['LEFT ALT'] ||
    down['RIGHT ALT'] ||
    down['LEFT META'] ||
    down['RIGHT META']
  );
}

function runChordHandler(handler, keyName) {
  const now = Date.now();
  if (now - lastChordActionAt < 350) {
    return;
  }
  lastChordActionAt = now;

  Promise.resolve()
    .then(() => handler())
    .catch((error) => {
      console.error(`\`+ shortcut handler failed for ${keyName}:`, error);
    });
}

function registerZeroPrefixGlobalShortcuts({ handlers = {} } = {}) {
  unregisterZeroPrefixGlobalShortcuts();

  const chordHandlers = new Map();

  Object.entries(handlers).forEach(([shortcutId, handler]) => {
    if (typeof handler !== 'function' || !shortcutAcceleratorUsesZeroPrefix(shortcutId)) {
      return;
    }

    const accelerator = getKeyboardShortcutAccelerator(shortcutId);
    const chordKey = getZeroChordKeyFromAccelerator(accelerator);
    if (!chordKey) {
      return;
    }

    chordHandlers.set(chordKey.toUpperCase(), handler);
  });

  if (chordHandlers.size === 0) {
    return;
  }

  zeroPrefixListener = (event, down) => {
    if (event?.state !== 'DOWN' || hasBlockingModifiers(down)) {
      return;
    }

    if (isZeroKeyEvent(event)) {
      armZeroChord();
      return;
    }

    const keyName = getChordLetterFromEvent(event);
    const handler = chordHandlers.get(keyName);
    if (!handler) {
      return;
    }

    if (!isZeroChordActive(down)) {
      return;
    }

    consumeZeroChordArm();
    runChordHandler(handler, keyName);
    return true;
  };

  try {
    keyboardListener = new GlobalKeyboardListener({
      windows: {
        disposeDelay: -1,
        onError: (errorCode) => {
          console.error('Backtick shortcut listener error:', errorCode);
        }
      }
    });
    keyboardListener.addListener(zeroPrefixListener);
  } catch (error) {
    console.error('Failed to start backtick shortcut listener:', error);
  }

  windowsPoller = startWindowsChordPoller((letter) => {
    const handler = chordHandlers.get(letter);
    if (!handler) {
      return;
    }
    runChordHandler(handler, letter);
  });
  console.log('Registered global `+S / `+A / `+C / `+H shortcuts');
}

function attachWindowChordInput(webContents, handlers = {}) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  const chordHandlers = new Map();
  Object.entries(handlers).forEach(([shortcutId, handler]) => {
    if (typeof handler !== 'function' || !shortcutAcceleratorUsesZeroPrefix(shortcutId)) {
      return;
    }
    const chordKey = getZeroChordKeyFromAccelerator(getKeyboardShortcutAccelerator(shortcutId));
    if (chordKey) {
      chordHandlers.set(chordKey.toUpperCase(), handler);
    }
  });

  webContents.on('before-input-event', (event, input) => {
    if (input?.type !== 'keyDown' || input.isAutoRepeat || input.control || input.alt || input.meta) {
      return;
    }

    const code = String(input.code || '');
    const key = String(input.key || '');
    if (code === 'Backquote' || key === '`' || key === '~') {
      armZeroChord();
      return;
    }

    const letter = code.startsWith('Key')
      ? code.slice(3).toUpperCase()
      : code === 'ArrowLeft'
        ? 'LEFT'
        : code === 'ArrowRight'
          ? 'RIGHT'
          : code === 'ArrowUp'
            ? 'UP'
            : code === 'ArrowDown'
              ? 'DOWN'
              : /^[a-z]$/i.test(key)
                ? key.toUpperCase()
                : '';
    const handler = chordHandlers.get(letter);
    if (!handler || !isZeroChordActive()) {
      return;
    }

    consumeZeroChordArm();
    event.preventDefault();
    runChordHandler(handler, letter);
  });
}

function unregisterZeroPrefixGlobalShortcuts() {
  if (keyboardListener && zeroPrefixListener) {
    keyboardListener.removeListener(zeroPrefixListener);
  }

  if (keyboardListener) {
    keyboardListener.kill();
  }

  stopWindowsChordPoller(windowsPoller);
  keyboardListener = null;
  zeroPrefixListener = null;
  windowsPoller = null;
}

module.exports = {
  attachWindowChordInput,
  registerZeroPrefixGlobalShortcuts,
  unregisterZeroPrefixGlobalShortcuts
};
