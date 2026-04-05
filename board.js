const COLUMNS = [
  {
    id: 'todo',
    label: 'To Do',
    color: '#3b82f6',
    emptyText: 'Nothing here yet — add a task to get started'
  },
  {
    id: 'inprogress',
    label: 'In Progress',
    color: '#f59e0b',
    emptyText: 'Pick a task from To Do and drag it here'
  },
  {
    id: 'done',
    label: 'Done',
    color: '#22c55e',
    emptyText: 'Completed tasks will land here'
  }
];

function Task(data) {
  this.id          = data.id          || generateId();
  this.title       = data.title       || '';
  this.description = data.description || '';
  this.priority    = data.priority    || 'medium';
  this.tags        = data.tags        || [];
  this.dueDate     = data.dueDate     || null;
  this.columnId    = data.columnId    || 'todo';
  this.createdAt   = data.createdAt   || new Date().toISOString();
  this.order       = typeof data.order === 'number' ? data.order : 0;
}

Task.prototype.toJSON = function () {
  return {
    id:          this.id,
    title:       this.title,
    description: this.description,
    priority:    this.priority,
    tags:        this.tags,
    dueDate:     this.dueDate,
    columnId:    this.columnId,
    createdAt:   this.createdAt,
    order:       this.order
  };
};

function Board() {
  this.tasks = [];
}

Board.prototype.addTask = function (data) {
  const sameCol = this.tasks.filter(t => t.columnId === (data.columnId || 'todo'));
  data.order = sameCol.length;
  const task = new Task(data);
  this.tasks.push(task);
  return task;
};

Board.prototype.getTask = function (id) {
  return this.tasks.find(t => t.id === id) || null;
};

Board.prototype.updateTask = function (id, updates) {
  const task = this.getTask(id);
  if (!task) return false;
  Object.assign(task, updates);
  return true;
};

Board.prototype.removeTask = function (id) {
  const idx = this.tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  this.tasks.splice(idx, 1);
  return true;
};

Board.prototype.getColumn = function (columnId) {
  return this.tasks
    .filter(t => t.columnId === columnId)
    .sort((a, b) => a.order - b.order);
};

Board.prototype.moveTask = function (taskId, toColumnId, beforeTaskId) {
  const task = this.getTask(taskId);
  if (!task) return;

  task.columnId = toColumnId;

  const col = this.getColumn(toColumnId).filter(t => t.id !== taskId);
  const targetIdx = beforeTaskId
    ? col.findIndex(t => t.id === beforeTaskId)
    : col.length;

  col.splice(targetIdx === -1 ? col.length : targetIdx, 0, task);
  col.forEach((t, i) => { t.order = i; });
};

Board.prototype.search = function (query, priority) {
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(safe, 'i');
  return this.tasks.filter(task => {
    const matchText = !query ||
      re.test(task.title) ||
      re.test(task.description) ||
      task.tags.some(tag => re.test(tag));
    const matchPri = !priority || task.priority === priority;
    return matchText && matchPri;
  });
};

Board.prototype.getStats = function () {
  const tasks = this.tasks;
  const total   = tasks.length;
  const done    = tasks.filter(t => t.columnId === 'done').length;
  const inprog  = tasks.filter(t => t.columnId === 'inprogress').length;
  const todo    = tasks.filter(t => t.columnId === 'todo').length;
  const high    = tasks.filter(t => t.priority === 'high').length;
  const medium  = tasks.filter(t => t.priority === 'medium').length;
  const low     = tasks.filter(t => t.priority === 'low').length;
  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.columnId === 'done') return false;
    return new Date(t.dueDate + 'T00:00:00') < today;
  }).length;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, inprog, todo, high, medium, low, overdue, completion };
};

Board.prototype.fromJSON = function (arr) {
  this.tasks = arr.map(d => new Task(d));
};
