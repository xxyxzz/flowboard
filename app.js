(() => {
  // ── State ────────────────────────────────────────────────────────────────────
  const board = new Board();
  let editingTaskId  = null;
  let deletingTaskId = null;
  let activeView     = 'board';
  let searchQuery    = '';
  let priorityFilter = '';
  let dragState      = { taskId: null, sourceCol: null };

  // ── Demo data (loaded only on first visit) ───────────────────────────────────
  const DEMO_TASKS = [
    {
      title: 'Design landing page mockup',
      description: 'Create high-fidelity wireframes for the new marketing homepage. Include mobile breakpoints.',
      priority: 'high',
      tags: ['design', 'ui'],
      dueDate: offsetDate(-1),
      columnId: 'todo'
    },
    {
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions to run tests and deploy to staging on every push to main.',
      priority: 'high',
      tags: ['devops', 'backend'],
      dueDate: offsetDate(2),
      columnId: 'todo'
    },
    {
      title: 'Write unit tests for auth module',
      description: 'Cover login, logout, token refresh and edge cases. Aim for ≥80% coverage.',
      priority: 'medium',
      tags: ['testing', 'backend'],
      dueDate: offsetDate(5),
      columnId: 'todo'
    },
    {
      title: 'Refactor data fetching layer',
      description: 'Replace raw fetch calls with a centralized API client that handles errors and retries.',
      priority: 'medium',
      tags: ['frontend', 'refactor'],
      dueDate: offsetDate(7),
      columnId: 'todo'
    },
    {
      title: 'Implement user profile page',
      description: 'Avatar upload, display name, email change flow with confirmation.',
      priority: 'low',
      tags: ['frontend'],
      dueDate: offsetDate(10),
      columnId: 'inprogress'
    },
    {
      title: 'Integrate Stripe payment flow',
      description: 'Checkout, webhooks for successful payment, subscription management.',
      priority: 'high',
      tags: ['backend', 'payments'],
      dueDate: offsetDate(3),
      columnId: 'inprogress'
    },
    {
      title: 'Database schema migration',
      description: 'Add indexes on user_id and created_at columns. Run migration on staging first.',
      priority: 'medium',
      tags: ['database', 'backend'],
      dueDate: offsetDate(4),
      columnId: 'inprogress'
    },
    {
      title: 'Update README with setup guide',
      description: 'Document local dev setup, environment variables, and deployment process.',
      priority: 'low',
      tags: ['docs'],
      dueDate: null,
      columnId: 'done'
    },
    {
      title: 'Fix navbar z-index bug on mobile',
      description: 'Dropdown overlaps the hero section on viewport widths below 480px.',
      priority: 'medium',
      tags: ['bug', 'frontend'],
      dueDate: offsetDate(-3),
      columnId: 'done'
    },
    {
      title: 'Accessibility audit',
      description: 'Run axe-core on all pages, fix critical and serious violations.',
      priority: 'high',
      tags: ['a11y', 'frontend'],
      dueDate: null,
      columnId: 'done'
    }
  ];

  function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  function init() {
    const saved = Storage.get();
    if (saved && saved.tasks && saved.tasks.length > 0) {
      board.fromJSON(saved.tasks);
    } else {
      DEMO_TASKS.forEach(d => board.addTask(d));
      save();
    }

    applyTheme(saved && saved.theme ? saved.theme : 'dark');
    bindEvents();
    new PomodoroTimer({
      onSessionComplete(n) {
        showToast(`Focus session ${n} complete! Time for a break.`, 'info');
      }
    });
    renderBoard();
    updateSidebarStats();
  }

  // ── Persistence ───────────────────────────────────────────────────────────────
  function save() {
    Storage.set({ tasks: board.tasks.map(t => t.toJSON()), theme: getCurrentTheme() });
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    document.getElementById('themeIconSun').classList.toggle('hidden', !isDark);
    document.getElementById('themeIconMoon').classList.toggle('hidden', isDark);
    document.getElementById('themeLabel').textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  function toggleTheme() {
    const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    save();
  }

  // ── Rendering: Board ─────────────────────────────────────────────────────────
  function renderBoard() {
    const container = document.getElementById('boardColumns');
    container.innerHTML = '';

    const filtered = board.search(searchQuery, priorityFilter);
    const filteredIds = new Set(filtered.map(t => t.id));

    COLUMNS.forEach(col => {
      const tasks = board.getColumn(col.id).filter(t => filteredIds.has(t.id));
      container.appendChild(buildColumn(col, tasks));
    });

    const total = board.tasks.length;
    document.getElementById('taskCount').textContent =
      total === 1 ? '1 task' : total + ' tasks';

    updateSidebarStats();
  }

  function buildColumn(col, tasks) {
    const el = document.createElement('div');
    el.className = 'column';
    el.dataset.col = col.id;

    const doneTasks  = board.getColumn('done').length;
    const totalTasks = board.tasks.length;
    const progressPct = col.id === 'done' && totalTasks > 0
      ? Math.round((doneTasks / totalTasks) * 100)
      : 0;

    el.innerHTML = `
      <div class="col-header">
        <div class="col-left">
          <span class="col-dot" style="background:${col.color}"></span>
          <span class="col-title">${col.label}</span>
          <span class="col-count" id="count-${col.id}">${tasks.length}</span>
        </div>
        <button class="col-add-btn" data-col="${col.id}" title="Add task" aria-label="Add task to ${col.label}">+</button>
      </div>
      <div class="col-progress-track">
        <div class="col-progress-fill" style="width:${col.id === 'done' ? progressPct : 0}%;background:${col.color}"></div>
      </div>
      <div class="col-body" id="col-body-${col.id}" data-col="${col.id}"></div>
    `;

    const body = el.querySelector('.col-body');

    if (tasks.length === 0) {
      body.innerHTML = `
        <div class="col-empty">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="8" width="20" height="3" rx="1.5" fill="currentColor"/>
            <rect x="6" y="14" width="14" height="3" rx="1.5" fill="currentColor"/>
            <rect x="6" y="20" width="17" height="3" rx="1.5" fill="currentColor"/>
          </svg>
          <span>${col.emptyText}</span>
        </div>`;
    } else {
      tasks.forEach(task => body.appendChild(buildCard(task)));
    }

    bindColumnDrop(el, body);
    return el;
  }

  function buildCard(task) {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.draggable = true;
    el.dataset.id = task.id;

    const due = task.dueDate ? formatDueDate(task.dueDate) : null;
    const tagsHtml = task.tags.length
      ? task.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')
      : '';

    el.innerHTML = `
      <div class="card-head">
        <span class="card-title">${escapeHtml(task.title)}</span>
        <div class="card-actions">
          <button class="card-action-btn edit-btn" data-id="${task.id}" title="Edit task" aria-label="Edit ${escapeHtml(task.title)}">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="card-action-btn del" data-id="${task.id}" title="Delete task" aria-label="Delete ${escapeHtml(task.title)}">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      ${task.description ? `<p class="card-desc">${escapeHtml(task.description)}</p>` : ''}
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
      <div class="card-footer">
        <span class="card-priority p-${task.priority}">${task.priority}</span>
        ${due ? `<span class="card-due ${due.status}">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="2" width="8" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/>
            <path d="M3 1v2M7 1v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
          ${due.text}
        </span>` : ''}
      </div>
    `;

    bindCardDrag(el, task.id);

    el.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(task.id);
    });
    el.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(task.id);
    });

    return el;
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  function bindCardDrag(el, taskId) {
    el.addEventListener('dragstart', (e) => {
      dragState.taskId   = taskId;
      dragState.sourceCol = board.getTask(taskId).columnId;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
      document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
  }

  function bindColumnDrop(colEl, bodyEl) {
    colEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      colEl.classList.add('drag-over');

      document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
      const placeholder = document.createElement('div');
      placeholder.className = 'task-card drop-placeholder';

      const afterEl = getDragAfterElement(bodyEl, e.clientY);
      if (afterEl) {
        bodyEl.insertBefore(placeholder, afterEl);
      } else {
        bodyEl.appendChild(placeholder);
      }
    });

    colEl.addEventListener('dragleave', (e) => {
      if (!colEl.contains(e.relatedTarget)) {
        colEl.classList.remove('drag-over');
        bodyEl.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
      }
    });

    colEl.addEventListener('drop', (e) => {
      e.preventDefault();
      colEl.classList.remove('drag-over');

      const targetCol = colEl.dataset.col;
      if (!dragState.taskId) return;

      const placeholder = bodyEl.querySelector('.drop-placeholder');
      let beforeTaskId = null;
      if (placeholder && placeholder.nextElementSibling) {
        beforeTaskId = placeholder.nextElementSibling.dataset.id || null;
      }
      placeholder && placeholder.remove();

      board.moveTask(dragState.taskId, targetCol, beforeTaskId);
      save();
      renderBoard();
    });
  }

  function getDragAfterElement(container, y) {
    const cards = [...container.querySelectorAll('.task-card:not(.dragging):not(.drop-placeholder)')];
    return cards.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // ── Sidebar Stats ────────────────────────────────────────────────────────────
  function updateSidebarStats() {
    const s = board.getStats();
    document.getElementById('sidebarTotal').textContent   = s.total;
    document.getElementById('sidebarDone').textContent    = s.done;
    document.getElementById('sidebarOverdue').textContent = s.overdue;
  }

  // ── Analytics View ───────────────────────────────────────────────────────────
  function renderStats() {
    const stats = board.getStats();
    const grid  = document.getElementById('statsGrid');
    grid.innerHTML = '';

    grid.appendChild(makeStatCard('Total Tasks', stats.total, stats.total === 1 ? '1 task in the system' : stats.total + ' tasks tracked', 'gradient'));
    grid.appendChild(makeStatCard('Completion Rate', stats.completion + '%', stats.done + ' of ' + stats.total + ' tasks done', 'gradient'));
    grid.appendChild(makeStatCard('Overdue', stats.overdue, stats.overdue > 0 ? 'Need attention' : 'All on track ✓', 'plain'));
    grid.appendChild(makeStatCard('In Progress', stats.inprog, 'Currently being worked on', 'plain'));

    const colCard = document.createElement('div');
    colCard.className = 'stat-card';
    colCard.innerHTML = `
      <div class="stat-card-label">By Column</div>
      <div class="progress-rows">
        <div class="prow">
          <span class="prow-label">To Do</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.todo, stats.total)}%;background:#3b82f6"></div></div>
          <span class="prow-count">${stats.todo}</span>
        </div>
        <div class="prow">
          <span class="prow-label">In Progress</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.inprog, stats.total)}%;background:#f59e0b"></div></div>
          <span class="prow-count">${stats.inprog}</span>
        </div>
        <div class="prow">
          <span class="prow-label">Done</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.done, stats.total)}%;background:#22c55e"></div></div>
          <span class="prow-count">${stats.done}</span>
        </div>
      </div>`;
    grid.appendChild(colCard);

    const priCard = document.createElement('div');
    priCard.className = 'stat-card';
    priCard.innerHTML = `
      <div class="stat-card-label">By Priority</div>
      <div class="progress-rows">
        <div class="prow">
          <span class="prow-label">High</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.high, stats.total)}%;background:#ef4444"></div></div>
          <span class="prow-count">${stats.high}</span>
        </div>
        <div class="prow">
          <span class="prow-label">Medium</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.medium, stats.total)}%;background:#f59e0b"></div></div>
          <span class="prow-count">${stats.medium}</span>
        </div>
        <div class="prow">
          <span class="prow-label">Low</span>
          <div class="prow-bar"><div class="prow-fill" style="width:${pct(stats.low, stats.total)}%;background:#22c55e"></div></div>
          <span class="prow-count">${stats.low}</span>
        </div>
      </div>`;
    grid.appendChild(priCard);

    const recent = board.tasks
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentCard = document.createElement('div');
    recentCard.className = 'stat-card';
    const colLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
    const colColor = { todo: '#3b82f6', inprogress: '#f59e0b', done: '#22c55e' };
    recentCard.innerHTML = `
      <div class="stat-card-label">Recently Added</div>
      <div class="recent-list">
        ${recent.map(t => `
          <div class="recent-item">
            <span class="recent-dot" style="background:${colColor[t.columnId]}"></span>
            <span class="recent-name">${escapeHtml(t.title)}</span>
            <span class="recent-col">${colLabel[t.columnId]}</span>
          </div>`).join('')}
        ${recent.length === 0 ? '<span style="color:var(--text3);font-size:0.82rem">No tasks yet</span>' : ''}
      </div>`;
    grid.appendChild(recentCard);
  }

  function makeStatCard(label, value, hint, style) {
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.innerHTML = `
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-val ${style === 'gradient' ? 'gradient' : ''}">${value}</div>
      <div class="stat-card-hint">${hint}</div>`;
    return el;
  }

  function pct(n, total) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
  }

  // ── View Switching ────────────────────────────────────────────────────────────
  function switchView(view) {
    activeView = view;
    document.getElementById('boardView').classList.toggle('hidden', view !== 'board');
    document.getElementById('statsView').classList.toggle('hidden', view !== 'stats');
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'stats') renderStats();
  }

  // ── Task Modal ────────────────────────────────────────────────────────────────
  function openCreateModal(defaultCol) {
    editingTaskId = null;
    document.getElementById('modalTitle').textContent = 'New Task';
    document.getElementById('submitBtn').textContent  = 'Create Task';
    document.getElementById('taskForm').reset();
    clearFormErrors();

    if (defaultCol) {
      document.getElementById('taskColumn').value = defaultCol;
    }

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('taskDueDate').min = today;
    showModal('modalOverlay');
    setTimeout(() => document.getElementById('taskTitle').focus(), 80);
  }

  function openEditModal(taskId) {
    const task = board.getTask(taskId);
    if (!task) return;
    editingTaskId = taskId;

    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('submitBtn').textContent  = 'Save Changes';
    clearFormErrors();

    document.getElementById('taskTitle').value       = task.title;
    document.getElementById('taskDescription').value = task.description;
    document.getElementById('taskPriority').value    = task.priority;
    document.getElementById('taskColumn').value      = task.columnId;
    document.getElementById('taskDueDate').value     = task.dueDate || '';
    document.getElementById('taskTags').value        = task.tags.join(', ');

    showModal('modalOverlay');
    setTimeout(() => document.getElementById('taskTitle').focus(), 80);
  }

  function closeTaskModal() {
    hideModal('modalOverlay');
    editingTaskId = null;
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const titleVal = document.getElementById('taskTitle').value;
    const err = validateTitle(titleVal);
    if (err) {
      showFieldError('taskTitle', 'titleError', err);
      return;
    }

    const data = {
      title:       titleVal.trim(),
      description: document.getElementById('taskDescription').value.trim(),
      priority:    document.getElementById('taskPriority').value,
      columnId:    document.getElementById('taskColumn').value,
      dueDate:     document.getElementById('taskDueDate').value || null,
      tags:        parseTags(document.getElementById('taskTags').value)
    };

    if (editingTaskId) {
      board.updateTask(editingTaskId, data);
      showToast('Task updated successfully', 'success');
    } else {
      board.addTask(data);
      showToast('Task created!', 'success');
    }

    save();
    closeTaskModal();
    renderBoard();
  }

  // ── Delete Modal ──────────────────────────────────────────────────────────────
  function openDeleteModal(taskId) {
    const task = board.getTask(taskId);
    if (!task) return;
    deletingTaskId = taskId;
    document.getElementById('deleteTaskName').textContent = task.title;
    showModal('deleteOverlay');
  }

  function closeDeleteModal() {
    hideModal('deleteOverlay');
    deletingTaskId = null;
  }

  function confirmDelete() {
    if (!deletingTaskId) return;
    board.removeTask(deletingTaskId);
    save();
    closeDeleteModal();
    renderBoard();
    showToast('Task deleted', 'info');
  }

  // ── Modal Helpers ─────────────────────────────────────────────────────────────
  function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  }

  function showFieldError(inputId, errorId, msg) {
    const input = document.getElementById(inputId);
    const err   = document.getElementById(errorId);
    input.classList.add('error');
    err.textContent = msg;
    input.addEventListener('input', () => {
      input.classList.remove('error');
      err.textContent = '';
    }, { once: true });
  }

  function clearFormErrors() {
    document.getElementById('taskTitle').classList.remove('error');
    document.getElementById('titleError').textContent = '';
  }

  // ── Toast Notifications ───────────────────────────────────────────────────────
  function showToast(message, type) {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3200);
  }

  // ── Sidebar Collapse ──────────────────────────────────────────────────────────
  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
  }

  // ── Event Bindings ────────────────────────────────────────────────────────────
  function bindEvents() {
    // Nav
    document.getElementById('navBoard').addEventListener('click', () => switchView('board'));
    document.getElementById('navStats').addEventListener('click', () => switchView('stats'));

    // Sidebar
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // New task button
    document.getElementById('newTaskBtn').addEventListener('click', () => openCreateModal('todo'));

    // Column + buttons (event delegation on the columns container)
    document.getElementById('boardColumns').addEventListener('click', (e) => {
      const addBtn = e.target.closest('.col-add-btn');
      if (addBtn) openCreateModal(addBtn.dataset.col);
    });

    // Task form
    document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('cancelBtn').addEventListener('click', closeTaskModal);
    document.getElementById('modalClose').addEventListener('click', closeTaskModal);

    // Delete modal
    document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
    document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteClose').addEventListener('click', closeDeleteModal);

    // Overlay click to close
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) closeTaskModal();
    });
    document.getElementById('deleteOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('deleteOverlay')) closeDeleteModal();
    });

    // Search
    const handleSearch = debounce(() => {
      searchQuery = document.getElementById('searchInput').value.trim();
      renderBoard();
    }, 220);
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Priority filter
    document.getElementById('priorityFilter').addEventListener('change', (e) => {
      priorityFilter = e.target.value;
      renderBoard();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTaskModal();
        closeDeleteModal();
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        openCreateModal('todo');
      }
    });
  }

  // ── Go ────────────────────────────────────────────────────────────────────────
  init();
})();
