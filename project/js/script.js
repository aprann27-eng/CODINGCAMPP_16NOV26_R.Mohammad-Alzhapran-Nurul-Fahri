/**
 * To-Do List Life Dashboard
 * script.js — single Vanilla JS file
 *
 * Sections:
 *   1. Local Storage helpers
 *   2. Theme (Light / Dark mode)
 *   3. User Name & Greeting
 *   4. Live Clock & Date
 *   5. Focus Timer (Pomodoro)
 *   6. To-Do List
 *   7. Quick Links
 *   8. App init
 */

'use strict';

/* ================================================================
   1. LOCAL STORAGE HELPERS
================================================================ */

/** Read and JSON-parse a key; return fallback if missing/corrupt. */
function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** JSON-stringify and save a value. */
function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ================================================================
   2. THEME — Light / Dark mode
================================================================ */

const THEME_KEY   = 'dashboard_theme';
const themeToggle = document.getElementById('theme-toggle');
const themeIcon   = document.getElementById('theme-icon');

/** Apply theme to <html data-theme="..."> and update icon. */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

/** Toggle between light and dark, then persist. */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storageSet(THEME_KEY, next);
}

/** Load theme preference from storage on startup. */
function initTheme() {
  const saved = storageGet(THEME_KEY, 'light');
  applyTheme(saved);
}

themeToggle.addEventListener('click', toggleTheme);

/* ================================================================
   3. USER NAME & GREETING TEXT
================================================================ */

const NAME_KEY       = 'dashboard_username';
const nameModal      = document.getElementById('name-modal');
const modalNameInput = document.getElementById('modal-name-input');
const modalSaveBtn   = document.getElementById('modal-save-btn');
const modalNameError = document.getElementById('modal-name-error');
const editNameBtn    = document.getElementById('edit-name-btn');
const greetingText   = document.getElementById('greeting-text');

/** Return greeting prefix based on current hour. */
function getGreetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Render greeting heading with optional name. */
function renderGreeting() {
  const name = storageGet(NAME_KEY, '');
  const prefix = getGreetingPrefix();
  greetingText.textContent = name ? `${prefix}, ${name} 👋` : prefix;
}

/** Show the name modal (first visit or edit). */
function openNameModal() {
  const existing = storageGet(NAME_KEY, '');
  modalNameInput.value = existing;
  modalNameError.classList.add('hidden');
  nameModal.classList.remove('hidden');
  modalNameInput.focus();
}

/** Hide the name modal. */
function closeNameModal() {
  nameModal.classList.add('hidden');
}

/** Save name from modal input. */
function saveName() {
  const name = modalNameInput.value.trim();
  if (!name) {
    modalNameError.classList.remove('hidden');
    modalNameInput.focus();
    return;
  }
  storageSet(NAME_KEY, name);
  closeNameModal();
  renderGreeting();
}

/** Check if this is the first visit (no name saved). */
function initUserName() {
  const saved = storageGet(NAME_KEY, '');
  if (!saved) {
    openNameModal();
  }
  renderGreeting();
}

/* Modal events */
modalSaveBtn.addEventListener('click', saveName);
modalNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveName();
});
editNameBtn.addEventListener('click', openNameModal);

/* ================================================================
   4. LIVE CLOCK & DATE
================================================================ */

const greetingDate = document.getElementById('greeting-date');
const greetingTime = document.getElementById('greeting-time');

/** Format a Date to "Thursday, 19 November 2026". */
function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/** Format a Date to "HH:MM:SS". */
function formatTime(date) {
  return date.toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Update the displayed date and time, and refresh the greeting prefix. */
function tickClock() {
  const now = new Date();
  greetingDate.textContent = formatDate(now);
  greetingTime.textContent = formatTime(now);
  // Re-render greeting prefix so it updates if the user crosses an hour boundary
  renderGreeting();
}

/** Start the clock — ticks every second. */
function initClock() {
  tickClock();
  setInterval(tickClock, 1000);
}

/* ================================================================
   5. FOCUS TIMER (Pomodoro)
================================================================ */

const POMODORO_MINUTES = 25;
const POMODORO_SECONDS = POMODORO_MINUTES * 60; // 1500 seconds

const timerDisplay = document.getElementById('timer-display');
const timerStart   = document.getElementById('timer-start');
const timerStop    = document.getElementById('timer-stop');
const timerReset   = document.getElementById('timer-reset');

let timerInterval   = null;  // setInterval reference
let timerRemaining  = POMODORO_SECONDS;
let timerRunning    = false;

/** Format seconds as MM:SS. */
function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Update the timer display element. */
function renderTimer() {
  timerDisplay.textContent = formatTimer(timerRemaining);
}

/** Update button states based on running/stopped. */
function updateTimerButtons() {
  timerStart.disabled = timerRunning;
  timerStop.disabled  = !timerRunning;
}

/** Called each second the timer is running. */
function timerTick() {
  if (timerRemaining <= 0) {
    clearInterval(timerInterval);
    timerInterval  = null;
    timerRunning   = false;
    timerRemaining = 0;
    renderTimer();
    updateTimerButtons();
    timerDisplay.classList.remove('running');
    notifyTimerDone();
    return;
  }
  timerRemaining -= 1;
  renderTimer();
}

/**
 * Notify the user that the Pomodoro session finished.
 * Strategy:
 *   1. If the Notification API is available and permission is granted  → show native notification only.
 *   2. If permission is not yet decided                                → request it, then show native
 *      notification if granted, or fall back to alert if denied/dismissed.
 *   3. If the Notification API is unavailable or permission is denied  → fall back to alert.
 * The alert() is never shown alongside a native notification.
 */
function notifyTimerDone() {
  // No Notification API available — go straight to alert fallback.
  if (!('Notification' in window)) {
    alert('⏰ Pomodoro session complete! Time is up. Take a break!');
    return;
  }

  if (Notification.permission === 'granted') {
    // Permission already granted — native notification only, no alert.
    new Notification('⏰ Pomodoro Done!', {
      body: 'Time is up! Great work. Take a short break.',
    });
  } else if (Notification.permission === 'denied') {
    // User has permanently blocked notifications — alert fallback.
    alert('⏰ Pomodoro session complete! Time is up. Take a break!');
  } else {
    // Permission not yet decided — ask, then act based on the answer.
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        new Notification('⏰ Pomodoro Done!', {
          body: 'Time is up! Great work. Take a short break.',
        });
      } else {
        // Denied or dismissed — alert fallback.
        alert('⏰ Pomodoro session complete! Time is up. Take a break!');
      }
    });
  }
}

/** Start the timer. */
function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerDisplay.classList.add('running');
  timerInterval = setInterval(timerTick, 1000);
  updateTimerButtons();
}

/** Stop (pause) the timer. */
function stopTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerDisplay.classList.remove('running');
  updateTimerButtons();
}

/** Reset the timer to 25:00. */
function resetTimer() {
  stopTimer();
  timerRemaining = POMODORO_SECONDS;
  renderTimer();
  updateTimerButtons();
}

/** Initialise timer UI. */
function initTimer() {
  renderTimer();
  updateTimerButtons();
}

timerStart.addEventListener('click', startTimer);
timerStop.addEventListener('click', stopTimer);
timerReset.addEventListener('click', resetTimer);

/* ================================================================
   6. TO-DO LIST
================================================================ */

const TASKS_KEY    = 'dashboard_tasks';
const taskForm     = document.getElementById('task-form');
const taskInput    = document.getElementById('task-input');
const taskError    = document.getElementById('task-error');
const taskList     = document.getElementById('task-list');
const taskTotal    = document.getElementById('task-total');
const taskDone     = document.getElementById('task-done');

/** Load tasks array from storage. */
function loadTasks() {
  return storageGet(TASKS_KEY, []);
}

/** Persist tasks array to storage. */
function saveTasks(tasks) {
  storageSet(TASKS_KEY, tasks);
}

/** Update the task stat counters. */
function renderTaskStats(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter((t) => t.done).length;
  taskTotal.textContent = `${total} task${total !== 1 ? 's' : ''}`;
  taskDone.textContent  = `${completed} completed`;
}

/**
 * Build a single task <li> element.
 * @param {object} task - { id, text, done }
 */
function buildTaskElement(task) {
  const li = document.createElement('li');
  li.className  = `task-item${task.done ? ' done' : ''}`;
  li.dataset.id = task.id;

  // ── Checkbox ──
  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked   = task.done;
  checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.done ? 'incomplete' : 'complete'}`);
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // ── Label (click also toggles) ──
  const label = document.createElement('span');
  label.className   = 'task-label';
  label.textContent = task.text;
  label.setAttribute('title', task.text);
  label.addEventListener('click', () => toggleTask(task.id));

  // ── Edit button ──
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-icon';
  editBtn.textContent = '✏️';
  editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
  editBtn.addEventListener('click', () => startEditTask(task.id, li, label, editBtn));

  // ── Delete button ──
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = '🗑';
  deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  // ── Actions wrapper ──
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(label);
  li.appendChild(actions);

  return li;
}

/** Re-render the entire task list from storage. */
function renderTasks() {
  const tasks = loadTasks();
  taskList.innerHTML = '';
  tasks.forEach((task) => {
    taskList.appendChild(buildTaskElement(task));
  });
  renderTaskStats(tasks);
}

/** Add a new task; returns false if duplicate detected. */
function addTask(text) {
  const tasks = loadTasks();
  const normalised = text.trim().toLowerCase();

  // Prevent duplicate (case-insensitive)
  const isDuplicate = tasks.some((t) => t.text.toLowerCase() === normalised);
  if (isDuplicate) {
    showTaskError(`⚠️ "${text.trim()}" already exists in your list.`);
    return false;
  }

  const newTask = {
    id:   Date.now().toString(),
    text: text.trim(),
    done: false,
  };

  tasks.push(newTask);
  saveTasks(tasks);
  renderTasks();
  return true;
}

/** Toggle done/undone for a task by id. */
function toggleTask(id) {
  const tasks = loadTasks().map((t) => {
    if (t.id === id) return { ...t, done: !t.done };
    return t;
  });
  saveTasks(tasks);
  renderTasks();
}

/** Delete a task by id. */
function deleteTask(id) {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
  renderTasks();
}

/**
 * Enter inline-edit mode for a task.
 * Swaps the label for a text input; Save on Enter, click Save button, or blur.
 *
 * Double-execution prevention:
 *   Both the Save button (click) and the input (blur) call commitEdit.
 *   When the user clicks Save, the input fires blur first, which would
 *   commit the edit and re-render the DOM before the click handler runs —
 *   leaving the click handler with no live node to act on.
 *   A `committed` flag ensures commitEdit only executes once regardless of
 *   which event fires first.
 */
function startEditTask(id, li, labelEl, editBtnEl) {
  const tasks = loadTasks();
  const task  = tasks.find((t) => t.id === id);
  if (!task) return;

  // Replace label with input
  const input = document.createElement('input');
  input.type      = 'text';
  input.className = 'task-edit-input';
  input.value     = task.text;
  input.maxLength = 120;
  li.replaceChild(input, labelEl);

  // Replace edit button with save button
  const saveBtn = document.createElement('button');
  saveBtn.className   = 'btn btn-icon';
  saveBtn.textContent = '💾';
  saveBtn.setAttribute('aria-label', 'Save edit');
  editBtnEl.replaceWith(saveBtn);

  input.focus();
  input.select();

  // Guard flag — prevents blur and click from both executing commitEdit.
  let committed = false;

  /** Commit the edit exactly once. */
  function commitEdit() {
    if (committed) return;

    const newText = input.value.trim();
    if (!newText) {
      input.focus();
      return;
    }

    // Check duplicate — allow keeping the same text
    const tasks2      = loadTasks();
    const normalised  = newText.toLowerCase();
    const isDuplicate = tasks2.some(
      (t) => t.id !== id && t.text.toLowerCase() === normalised
    );

    if (isDuplicate) {
      showTaskError(`⚠️ "${newText}" already exists in your list.`);
      input.focus();
      return;
    }

    committed = true; // Set before DOM changes so a re-entrant blur is ignored.
    const updated = tasks2.map((t) => (t.id === id ? { ...t, text: newText } : t));
    saveTasks(updated);
    renderTasks();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      committed = true; // Prevent blur from saving after Escape.
      renderTasks();    // Cancel edit — restore original label.
    }
  });
  input.addEventListener('blur', commitEdit);
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    commitEdit();
  });
}

/** Show or hide the task-level error message. */
function showTaskError(msg) {
  taskError.textContent = msg;
  taskError.classList.remove('hidden');
}

function clearTaskError() {
  taskError.textContent = '';
  taskError.classList.add('hidden');
}

/** Handle task form submission. */
function handleTaskSubmit(e) {
  e.preventDefault();
  clearTaskError();
  const text = taskInput.value.trim();

  if (!text) {
    showTaskError('⚠️ Please enter a task name.');
    taskInput.focus();
    return;
  }

  if (addTask(text)) {
    taskInput.value = '';
    taskInput.focus();
  }
}

taskForm.addEventListener('submit', handleTaskSubmit);

/* ================================================================
   7. QUICK LINKS
================================================================ */

const LINKS_KEY      = 'dashboard_links';
const linkForm       = document.getElementById('link-form');
const linkNameInput  = document.getElementById('link-name-input');
const linkUrlInput   = document.getElementById('link-url-input');
const linkError      = document.getElementById('link-error');
const linksList      = document.getElementById('links-list');

/** Load links array from storage. */
function loadLinks() {
  return storageGet(LINKS_KEY, []);
}

/** Persist links array to storage. */
function saveLinks(links) {
  storageSet(LINKS_KEY, links);
}

/** Validate a URL string — must start with http:// or https://. */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Build a favicon URL from a website URL. */
function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
}

/** Build a single link <li> element. */
function buildLinkElement(link) {
  const li = document.createElement('li');
  li.className  = 'link-item';
  li.dataset.id = link.id;

  // Favicon image (silent failure if not found)
  const img = document.createElement('img');
  img.className = 'link-favicon';
  img.src       = faviconUrl(link.url);
  img.alt       = '';
  img.onerror   = () => { img.style.display = 'none'; };

  // Link anchor
  const anchor = document.createElement('a');
  anchor.href          = link.url;
  anchor.target        = '_blank';
  anchor.rel           = 'noopener noreferrer';
  anchor.textContent   = link.name;
  anchor.setAttribute('title', link.url);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className   = 'btn btn-danger';
  deleteBtn.textContent = '🗑';
  deleteBtn.setAttribute('aria-label', `Delete link: ${link.name}`);
  deleteBtn.addEventListener('click', () => deleteLink(link.id));

  li.appendChild(img);
  li.appendChild(anchor);
  li.appendChild(deleteBtn);

  return li;
}

/** Re-render the links list from storage. */
function renderLinks() {
  const links = loadLinks();
  linksList.innerHTML = '';
  if (links.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'links-empty'; // styled in style.css — no inline cssText
    empty.textContent = 'No links yet. Add one above!';
    linksList.appendChild(empty);
    return;
  }
  links.forEach((link) => {
    linksList.appendChild(buildLinkElement(link));
  });
}

/** Add a new quick link. */
function addLink(name, url) {
  const links   = loadLinks();
  const newLink = { id: Date.now().toString(), name, url };
  links.push(newLink);
  saveLinks(links);
  renderLinks();
}

/** Delete a quick link by id. */
function deleteLink(id) {
  const links = loadLinks().filter((l) => l.id !== id);
  saveLinks(links);
  renderLinks();
}

/** Show link-form error. */
function showLinkError(msg) {
  linkError.textContent = msg;
  linkError.classList.remove('hidden');
}

function clearLinkError() {
  linkError.textContent = '';
  linkError.classList.add('hidden');
}

/** Handle link form submission. */
function handleLinkSubmit(e) {
  e.preventDefault();
  clearLinkError();

  const name = linkNameInput.value.trim();
  const url  = linkUrlInput.value.trim();

  if (!name) {
    showLinkError('⚠️ Please enter a site name.');
    linkNameInput.focus();
    return;
  }

  if (!url) {
    showLinkError('⚠️ Please enter a URL.');
    linkUrlInput.focus();
    return;
  }

  // Auto-prepend https:// if the user omitted the scheme
  const normalised = url.startsWith('http') ? url : `https://${url}`;

  if (!isValidUrl(normalised)) {
    showLinkError('⚠️ Please enter a valid URL (e.g. https://example.com).');
    linkUrlInput.focus();
    return;
  }

  addLink(name, normalised);
  linkNameInput.value = '';
  linkUrlInput.value  = '';
  linkNameInput.focus();
}

linkForm.addEventListener('submit', handleLinkSubmit);

/* ================================================================
   8. APP INIT — run everything on DOMContentLoaded
================================================================ */

function init() {
  initTheme();
  initUserName();
  initClock();
  initTimer();
  renderTasks();
  renderLinks();
}

document.addEventListener('DOMContentLoaded', init);
