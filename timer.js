function PomodoroTimer(callbacks) {
  const WORK_SECS  = 25 * 60;
  const BREAK_SECS = 5  * 60;
  const CIRCUMFERENCE = 289.03; // 2 * Math.PI * 46

  let phase     = 'work';
  let remaining = WORK_SECS;
  let sessions  = 0;
  let running   = false;
  let intervalId = null;

  const arcEl      = document.getElementById('timerArc');
  const displayEl  = document.getElementById('timerDisplay');
  const phaseEl    = document.getElementById('timerPhase');
  const sessionEl  = document.getElementById('timerSession');
  const startBtn   = document.getElementById('timerStart');
  const iconPlay   = startBtn.querySelector('.icon-play');
  const iconPause  = startBtn.querySelector('.icon-pause');

  function render() {
    const total = phase === 'work' ? WORK_SECS : BREAK_SECS;
    const ratio = remaining / total;
    const offset = CIRCUMFERENCE * (1 - ratio);

    arcEl.style.strokeDashoffset = offset;
    arcEl.classList.toggle('break', phase === 'break');

    displayEl.textContent = padTwo(Math.floor(remaining / 60)) + ':' + padTwo(remaining % 60);
    phaseEl.textContent   = phase === 'work' ? 'Focus' : 'Break';
    sessionEl.textContent = 'Session ' + (sessions + 1);
  }

  function switchPhase() {
    if (phase === 'work') {
      sessions += 1;
      phase = 'break';
      remaining = BREAK_SECS;
      if (typeof callbacks.onSessionComplete === 'function') {
        callbacks.onSessionComplete(sessions);
      }
    } else {
      phase = 'work';
      remaining = WORK_SECS;
    }
    if (typeof callbacks.onPhaseChange === 'function') {
      callbacks.onPhaseChange(phase);
    }
    render();
  }

  function tick() {
    remaining -= 1;
    if (typeof callbacks.onTick === 'function') {
      callbacks.onTick({ phase, remaining, sessions });
    }
    render();
    if (remaining <= 0) {
      switchPhase();
    }
  }

  function start() {
    if (running) return;
    running = true;
    intervalId = setInterval(tick, 1000);
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    startBtn.title = 'Pause timer';
    startBtn.setAttribute('aria-label', 'Pause timer');
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(intervalId);
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
    startBtn.title = 'Start timer';
    startBtn.setAttribute('aria-label', 'Start timer');
  }

  function reset() {
    pause();
    phase = 'work';
    remaining = WORK_SECS;
    render();
  }

  function skip() {
    switchPhase();
  }

  function toggle() {
    running ? pause() : start();
  }

  document.getElementById('timerStart').addEventListener('click', toggle);
  document.getElementById('timerReset').addEventListener('click', reset);
  document.getElementById('timerSkip').addEventListener('click', skip);

  render();

  return { start, pause, reset, skip, toggle };
}
