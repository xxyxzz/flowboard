const Storage = (() => {
  const KEY = 'flowboard_v1';

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('FlowBoard: could not read from localStorage', e);
      return null;
    }
  }

  function set(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('FlowBoard: could not write to localStorage', e);
      return false;
    }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { get, set, clear };
})();
