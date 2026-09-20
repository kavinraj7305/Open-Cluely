const ZERO_CHORD_ARM_MS = 2000;
const BACKTICK_VKEYS = new Set([0xC0, 0xE2]);
const BACKTICK_NAMES = new Set([
  '`',
  '~',
  'BACKTICK',
  'GRAVE',
  'GRAVE ACCENT',
  'OEM_3',
  'OEM_102',
  'SECTION',
  'VK_OEM_3',
  'VK_OEM_102',
  'KEY_GRAVE',
  'BACKQUOTE'
]);

let zeroChordArmedUntil = 0;

function armZeroChord() {
  zeroChordArmedUntil = Date.now() + ZERO_CHORD_ARM_MS;
}

function isZeroChordArmed() {
  return Date.now() < zeroChordArmedUntil;
}

function consumeZeroChordArm() {
  if (!isZeroChordArmed()) {
    return false;
  }

  zeroChordArmedUntil = 0;
  return true;
}

function collectKeyLabels(event = {}, extraKeys = []) {
  const labels = [];
  const push = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized) {
      labels.push(normalized);
    }
  };

  push(event.name);
  push(event.key);
  push(event.code);
  push(event.rawKey?.name);
  push(event.rawKey?._nameRaw);
  extraKeys.forEach(push);
  return labels;
}

function isZeroKeyEvent(event = {}) {
  const vKey = Number(event.vKey);
  if (BACKTICK_VKEYS.has(vKey)) {
    return true;
  }

  return collectKeyLabels(event).some((label) => BACKTICK_NAMES.has(label) || label.includes('OEM_3') || label.includes('GRAVE'));
}

function isZeroKeyHeld(down = {}) {
  return Object.entries(down || {}).some(([keyName, isDown]) => {
    if (!isDown) {
      return false;
    }

    return isZeroKeyEvent({ name: keyName });
  });
}

function isZeroChordActive(down = {}) {
  return isZeroKeyHeld(down) || isZeroChordArmed();
}

function getChordLetterFromEvent(event = {}) {
  const labels = collectKeyLabels(event);
  for (const label of labels) {
    if (/^[A-Z]$/.test(label)) {
      return label;
    }

    if (label === 'LEFT ARROW' || label === 'ARROWLEFT' || label === 'VK_LEFT') {
      return 'LEFT';
    }
    if (label === 'RIGHT ARROW' || label === 'ARROWRIGHT' || label === 'VK_RIGHT') {
      return 'RIGHT';
    }
    if (label === 'UP ARROW' || label === 'ARROWUP' || label === 'VK_UP') {
      return 'UP';
    }
    if (label === 'DOWN ARROW' || label === 'ARROWDOWN' || label === 'VK_DOWN') {
      return 'DOWN';
    }

    if (label === 'LEFT' || label === 'RIGHT' || label === 'UP' || label === 'DOWN') {
      return label;
    }
  }

  return '';
}

module.exports = {
  ZERO_CHORD_ARM_MS,
  armZeroChord,
  consumeZeroChordArm,
  getChordLetterFromEvent,
  isZeroChordActive,
  isZeroChordArmed,
  isZeroKeyEvent,
  isZeroKeyHeld
};
