function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) return { text: Math.abs(diffDays) + 'd overdue', status: 'overdue' };
  if (diffDays === 0) return { text: 'Due today', status: 'soon' };
  if (diffDays === 1) return { text: 'Tomorrow', status: 'soon' };
  if (diffDays <= 6) return { text: diffDays + 'd left', status: 'soon' };
  return {
    text: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    status: ''
  };
}

function validateTitle(title) {
  const t = title.trim();
  if (!t) return 'Title is required.';
  if (t.length < 2) return 'Must be at least 2 characters.';
  if (t.length > 80) return 'Title is too long.';
  if (/[<>{}]/.test(t)) return 'Title contains invalid characters.';
  return null;
}

function parseTags(str) {
  return str
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\-_ ]/g, '').trim())
    .filter(t => t.length > 0 && t.length <= 24)
    .slice(0, 6);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function padTwo(n) {
  return String(n).padStart(2, '0');
}
