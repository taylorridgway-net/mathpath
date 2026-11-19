// Saving to the browser's own storage, so a closed tab or a sleeping
// Chromebook doesn't lose work. Every call is wrapped: storage can be blocked
// (private windows, school policies), and the app must keep working without it.

export function loadLocal(key) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}
