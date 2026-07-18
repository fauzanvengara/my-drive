/* ============================================
   DATABASE LAYER (IndexedDB)
   ============================================ */
class Database {
  constructor() {
    this.dbName = 'MyDriveDB';
    this.version = 2;
    this.db = null;
  }

  /* Open database and create object stores */
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('folderId', 'folderId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('folders')) {
          const store = db.createObjectStore('folders', { keyPath: 'id' });
          store.createIndex('parentId', 'parentId', { unique: false });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Generic transaction helper */
  _tx(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /* Add or update a record */
  put(storeName, data) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, 'readwrite').put(data);
      req.onsuccess = () => resolve(data);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Get a record by key */
  get(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Get all records from a store */
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Get records by index value */
  getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Delete a record */
  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* Count records in a store */
  count(storeName) {
    return new Promise((resolve, reject) => {
      const req = this._tx(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }
}

/* ============================================
   AUTH MODULE (Simulated JWT)
   ============================================ */
class Auth {
  constructor() {
    /* Default admin credentials (in production, these would be server-side) */
    this.adminUser = 'admin';
    this.adminPassHash = this._simpleHash('admin123');
    this.tokenKey = 'mydrive_token';
    this.tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /* Simple hash function (bcrypt simulation for client-side demo) */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h$' + Math.abs(hash).toString(36) + '$' + str.length;
  }

  /* Attempt login */
  login(username, password) {
    if (username === this.adminUser && this._simpleHash(password) === this.adminPassHash) {
      const token = 'jwt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const payload = {
        token,
        user: username,
        exp: Date.now() + this.tokenExpiry
      };
      localStorage.setItem(this.tokenKey, JSON.stringify(payload));
      return { success: true, token };
    }
    return { success: false, error: 'Invalid username or password' };
  }

  /* Check if logged in with valid token */
  isAuthenticated() {
    try {
      const data = JSON.parse(localStorage.getItem(this.tokenKey));
      return data && data.token && data.exp > Date.now();
    } catch { return false; }
  }

  /* Logout */
  logout() {
    localStorage.removeItem(this.tokenKey);
  }
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatDateFull(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* File type detection by extension and MIME */
function getFileType(name, mime) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    image: { exts: ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff'], mime: 'image/', icon: 'image', color: '#22C55E', label: 'Image' },
    video: { exts: ['mp4','webm','mov','avi','mkv','flv','wmv','m4v'], mime: 'video/', icon: 'videocam', color: '#EF4444', label: 'Video' },
    audio: { exts: ['mp3','wav','ogg','flac','aac','m4a','wma'], mime: 'audio/', icon: 'music_note', color: '#A855F7', label: 'Audio' },
    pdf:   { exts: ['pdf'], mime: 'application/pdf', icon: 'picture_as_pdf', color: '#EF4444', label: 'PDF' },
    zip:   { exts: ['zip','rar','7z','tar','gz','bz2','xz'], mime: ['application/zip','application/x-rar','application/x-7z','application/gzip'], icon: 'folder_zip', color: '#F59E0B', label: 'Archive' },
    doc:   { exts: ['doc','docx','xls','xlsx','ppt','pptx','txt','rtf','csv','json','xml','html','css','js','ts','py','java','cpp','c','md','yaml','yml','sql','sh','bat','php','rb','go','rs','swift','kt'], mime: 'text/', icon: 'description', color: '#3B82F6', label: 'Document' }
  };
  for (const [, v] of Object.entries(map)) {
    if (v.exts.includes(ext)) return { icon: v.icon, color: v.color, label: v.label };
    if (Array.isArray(v.mime) ? v.mime.some(m => (mime || '').includes(m)) : (mime || '').startsWith(v.mime)) return { icon: v.icon, color: v.color, label: v.label };
  }
  return { icon: 'insert_drive_file', color: '#64748B', label: 'File' };
}

/* Folder colors palette */
const FOLDER_COLORS = [
  { name: 'Teal', value: '#0D9488' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Amber', value: '#F59E0B' }
];

/* Toast notification system */
function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="material-symbols-outlined">${icons[type]}</span>${message}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ============================================
   APPLICATION STATE
   ============================================ */
const state = {
  view: 'home',         // Current view: home, myfiles, recent, folders, shared, settings
  currentFolderId: null, // Current folder being browsed (null = root)
  viewMode: 'grid',     // grid or list
  searchQuery: '',
  isDark: false,
  fabOpen: false,
  contextTarget: null,   // { type: 'file'|'folder', id: string }
};

/* ============================================
   APP INITIALIZATION & GLOBALS
   ============================================ */
let db, auth;

async function initApp() {
  db = new Database();
  auth = new Auth();

  await db.open();
  await seedSampleData();

  /* Restore preferences */
  state.isDark = localStorage.getItem('mydrive_theme') === 'dark';
  state.viewMode = localStorage.getItem('mydrive_viewmode') || 'grid';
  applyTheme();
  updateViewToggle();

  /* Update auth button state */
  updateAuthButton();

  /* Bind global events */
  bindEvents();

  /* Initial render */
  render();
}

/* Seed some sample data on first run */
async function seedSampleData() {
  const folderCount = await db.count('folders');
  if (folderCount > 0) return; // Already seeded

  const now = Date.now();
  const folders = [
    { id: uid(), name: 'Documents', parentId: null, color: '#3B82F6', isDriveLink: false, driveUrl: '', createdAt: now - 86400000 * 5, updatedAt: now - 86400000 * 5 },
    { id: uid(), name: 'Photos', parentId: null, color: '#22C55E', isDriveLink: false, driveUrl: '', createdAt: now - 86400000 * 4, updatedAt: now - 86400000 * 4 },
    { id: uid(), name: 'Projects', parentId: null, color: '#F97316', isDriveLink: false, driveUrl: '', createdAt: now - 86400000 * 3, updatedAt: now - 86400000 * 3 },
    { id: uid(), name: 'Work', parentId: null, color: '#A855F7', isDriveLink: false, driveUrl: '', createdAt: now - 86400000 * 2, updatedAt: now - 86400000 * 2 },
    { id: uid(), name: 'Design Assets', parentId: null, color: '#EC4899', isDriveLink: false, driveUrl: '', createdAt: now - 86400000, updatedAt: now - 86400000 },
    { id: uid(), name: 'Team Resources', parentId: null, color: '#0D9488', isDriveLink: true, driveUrl: 'https://drive.google.com/drive/folders/example', createdAt: now - 86400000 * 6, updatedAt: now - 86400000 * 6 },
  ];
  /* Add a subfolder */
  const projectsId = folders[2].id;
  folders.push({ id: uid(), name: 'Web App', parentId: projectsId, color: '#F97316', isDriveLink: false, driveUrl: '', createdAt: now - 86400000 * 2, updatedAt: now - 86400000 * 2 });

  for (const f of folders) await db.put('folders', f);

  /* Sample files (with small generated blobs) */
  const sampleFiles = [
    { name: 'Project Brief.pdf', type: 'application/pdf', size: 245760, folderId: folders[0].id },
    { name: 'Meeting Notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 52480, folderId: folders[0].id },
    { name: 'Budget 2024.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 102400, folderId: folders[0].id },
    { name: 'Vacation.jpg', type: 'image/jpeg', size: 3145728, folderId: folders[1].id },
    { name: 'Screenshot.png', type: 'image/png', size: 892416, folderId: folders[1].id },
    { name: 'Portrait.webp', type: 'image/webp', size: 524288, folderId: folders[1].id },
    { name: 'Demo.mp4', type: 'video/mp4', size: 15728640, folderId: folders[2].id },
    { name: 'README.md', type: 'text/markdown', size: 4096, folderId: projectsId + 'x' ? folders[6].id : projectsId, folderId: folders[6].id },
    { name: 'Presentation.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 5242880, folderId: folders[3].id },
    { name: 'Archive.zip', type: 'application/zip', size: 10485760, folderId: folders[4].id },
    { name: 'Logo.svg', type: 'image/svg+xml', size: 8192, folderId: folders[4].id },
  ];

  for (const sf of sampleFiles) {
    const blob = new Blob(['Sample file content: ' + sf.name], { type: sf.type });
    await db.put('files', {
      id: uid(),
      name: sf.name,
      type: sf.type,
      size: sf.size,
      data: blob,
      folderId: sf.folderId,
      createdAt: now - Math.random() * 86400000 * 7,
      updatedAt: now - Math.random() * 86400000 * 3
    });
  }
}

/* ============================================
   EVENT BINDING
   ============================================ */
function bindEvents() {
  /* Sidebar navigation */
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      state.view = item.dataset.view;
      if (state.view === 'myfiles') state.currentFolderId = null;
      state.searchQuery = '';
      document.getElementById('search-input').value = '';
      closeSidebar();
      render();
    });
  });

  /* Mobile menu toggle */
  document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  /* Search input with debounce */
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      if (state.searchQuery && state.view === 'home') state.view = 'myfiles';
      render();
    }, 200);
  });

  /* View toggle */
  document.getElementById('view-toggle').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('mydrive_viewmode', state.viewMode);
    updateViewToggle();
    render();
  });

  /* Theme toggle */
  document.getElementById('theme-toggle').addEventListener('click', () => {
    state.isDark = !state.isDark;
    localStorage.setItem('mydrive_theme', state.isDark ? 'dark' : 'light');
    applyTheme();
  });

  /* Auth button */
  document.getElementById('auth-btn').addEventListener('click', () => {
    if (auth.isAuthenticated()) {
      auth.logout();
      updateAuthButton();
      toast('Logged out successfully', 'info');
      render();
    } else {
      showLoginModal();
    }
  });

  /* FAB toggle */
  document.getElementById('fab').addEventListener('click', () => {
    if (!auth.isAuthenticated()) {
      showLoginModal();
      return;
    }
    state.fabOpen = !state.fabOpen;
    document.getElementById('fab').classList.toggle('open', state.fabOpen);
    document.getElementById('fab-menu').classList.toggle('open', state.fabOpen);
  });

  /* FAB menu items */
  document.querySelectorAll('.fab-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      closeFab();
      const action = item.dataset.action;
      if (action === 'new-folder') showNewFolderModal();
      else if (action === 'upload-files') document.getElementById('file-input').click();
      else if (action === 'upload-folder') document.getElementById('folder-input').click();
      else if (action === 'add-link') showDriveLinkModal();
    });
  });

  /* File inputs */
  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('folder-input').addEventListener('change', handleFolderUpload);

  /* Close modals on overlay click */
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  /* Close context menu on click outside */
  document.addEventListener('click', () => closeContextMenu());
  document.addEventListener('contextmenu', (e) => {
    /* Only prevent default inside the content area for our items */
    if (e.target.closest('.file-card, .file-list-item, .tree-item')) {
      e.preventDefault();
    }
  });

  /* Keyboard shortcuts */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeContextMenu();
      closeFab();
    }
  });

  /* Global drag-and-drop on content area */
  const content = document.getElementById('content');
  content.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  content.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!auth.isAuthenticated()) {
      toast('Please login to upload files', 'error');
      return;
    }
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFiles(files, state.currentFolderId);
      render();
    }
  });
}

/* ============================================
   SIDEBAR & THEME HELPERS
   ============================================ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
function closeFab() {
  state.fabOpen = false;
  document.getElementById('fab').classList.remove('open');
  document.getElementById('fab-menu').classList.remove('open');
}
function applyTheme() {
  document.documentElement.dataset.theme = state.isDark ? 'dark' : 'light';
  const icon = document.querySelector('#theme-toggle .material-symbols-outlined');
  icon.textContent = state.isDark ? 'light_mode' : 'dark_mode';
}
function updateViewToggle() {
  const icon = document.querySelector('#view-toggle .material-symbols-outlined');
  icon.textContent = state.viewMode === 'grid' ? 'view_list' : 'grid_view';
}
function updateAuthButton() {
  const btn = document.getElementById('auth-btn');
  const loggedIn = auth.isAuthenticated();
  btn.classList.toggle('logged-in', loggedIn);
  btn.querySelector('span:last-child').textContent = loggedIn ? 'Logout' : 'Login';
  btn.querySelector('.material-symbols-outlined').textContent = loggedIn ? 'logout' : 'person';
}

/* ============================================
   MODAL SYSTEM
   ============================================ */
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
  /* Focus first input if exists */
  setTimeout(() => {
    const inp = document.querySelector('#modal .form-input, #modal .form-textarea');
    if (inp) inp.focus();
  }, 100);
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/* Login modal */
function showLoginModal() {
  openModal(`
    <div class="modal-header">
      <h2>Admin Login</h2>
      <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Username</label>
        <input type="text" class="form-input" id="login-user" placeholder="Enter username" autocomplete="username">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" class="form-input" id="login-pass" placeholder="Enter password" autocomplete="current-password">
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="handleLogin()">Sign In</button>
      </div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-tertiary);text-align:center">Default: admin / admin123</p>
    </div>
  `);
  /* Enter key to submit */
  document.getElementById('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
}

async function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const result = auth.login(user, pass);
  if (result.success) {
    closeModal();
    updateAuthButton();
    toast('Welcome back, ' + user + '!', 'success');
    render();
  } else {
    toast(result.error, 'error');
  }
}

/* New folder modal */
function showNewFolderModal(parentId) {
  const pid = parentId || state.currentFolderId;
  let selectedColor = FOLDER_COLORS[0].value;
  const colorDots = FOLDER_COLORS.map(c =>
    `<div class="color-dot ${c.value === selectedColor ? 'selected' : ''}" data-color="${c.value}" style="background:${c.value}" title="${c.name}"></div>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2>New Folder</h2>
      <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Folder Name</label>
        <input type="text" class="form-input" id="folder-name-input" placeholder="Untitled folder">
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker" id="folder-color-picker">${colorDots}</div>
      </div>
      <input type="hidden" id="folder-parent-id" value="${pid || ''}">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="handleCreateFolder()">Create</button>
      </div>
    </div>
  `);

  /* Color picker interaction */
  document.getElementById('folder-color-picker').addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    document.querySelectorAll('#folder-color-picker .color-dot').forEach(d => d.classList.remove('selected'));
    dot.classList.add('selected');
    selectedColor = dot.dataset.color;
  });

  document.getElementById('folder-name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCreateFolder(); });
}

async function handleCreateFolder() {
  const name = document.getElementById('folder-name-input').value.trim();
  if (!name) { toast('Please enter a folder name', 'error'); return; }
  const colorDot = document.querySelector('#folder-color-picker .color-dot.selected');
  const color = colorDot ? colorDot.dataset.color : FOLDER_COLORS[0].value;
  const parentId = document.getElementById('folder-parent-id').value || null;

  await db.put('folders', {
    id: uid(),
    name,
    parentId,
    color,
    isDriveLink: false,
    driveUrl: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  closeModal();
  toast(`Folder "${name}" created`, 'success');
  render();
}

/* Google Drive link modal */
function showDriveLinkModal() {
  let selectedColor = FOLDER_COLORS[5].value;
  const colorDots = FOLDER_COLORS.map(c =>
    `<div class="color-dot ${c.value === selectedColor ? 'selected' : ''}" data-color="${c.value}" style="background:${c.value}" title="${c.name}"></div>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2>Add Google Drive Link</h2>
      <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" class="form-input" id="link-name-input" placeholder="e.g. Team Shared Files">
      </div>
      <div class="form-group">
        <label>Google Drive Folder URL</label>
        <input type="url" class="form-input" id="link-url-input" placeholder="https://drive.google.com/drive/folders/...">
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker" id="link-color-picker">${colorDots}</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="handleCreateLink()">Add Link</button>
      </div>
    </div>
  `);

  document.getElementById('link-color-picker').addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    document.querySelectorAll('#link-color-picker .color-dot').forEach(d => d.classList.remove('selected'));
    dot.classList.add('selected');
  });

  document.getElementById('link-url-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCreateLink(); });
}

async function handleCreateLink() {
  const name = document.getElementById('link-name-input').value.trim();
  const url = document.getElementById('link-url-input').value.trim();
  if (!name) { toast('Please enter a name', 'error'); return; }
  if (!url || !url.includes('drive.google.com')) { toast('Please enter a valid Google Drive URL', 'error'); return; }
  const colorDot = document.querySelector('#link-color-picker .color-dot.selected');
  const color = colorDot ? colorDot.dataset.color : FOLDER_COLORS[5].value;

  await db.put('folders', {
    id: uid(),
    name,
    parentId: null,
    color,
    isDriveLink: true,
    driveUrl: url,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  closeModal();
  toast(`Link "${name}" added`, 'success');
  render();
}

/* Upload modal */
function showUploadModal(files) {
  const items = Array.from(files).map((f, i) => `
    <div class="upload-item" id="upload-item-${i}">
      <div style="flex:1;min-width:0">
        <div class="upload-item-name">${f.name}</div>
        <div class="progress-bar"><div class="progress-bar-fill" id="upload-progress-${i}" style="width:0%"></div></div>
      </div>
      <div class="upload-item-status uploading" id="upload-status-${i}">0%</div>
    </div>
  `).join('');

  openModal(`
    <div class="modal-header">
      <h2>Uploading ${files.length} file${files.length > 1 ? 's' : ''}</h2>
      <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="modal-body">
      <div class="upload-progress-list">${items}</div>
      <div class="btn-group" style="margin-top:16px">
        <button class="btn btn-primary btn-full" id="upload-done-btn" style="display:none" onclick="closeModal();render();">Done</button>
      </div>
    </div>
  `);

  /* Simulate upload progress */
  processUploads(files, state.currentFolderId);
}

async function processUploads(files, folderId) {
  let allDone = true;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progressEl = document.getElementById(`upload-progress-${i}`);
    const statusEl = document.getElementById(`upload-status-${i}`);
    if (!progressEl || !statusEl) continue;

    try {
      /* Simulate progress (in reality, local storage is instant) */
      for (let p = 0; p <= 90; p += Math.random() * 30 + 10) {
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        if (!document.getElementById(`upload-progress-${i}`)) return; // Modal closed
        progressEl.style.width = Math.min(p, 90) + '%';
        statusEl.textContent = Math.round(Math.min(p, 90)) + '%';
      }

      /* Actually save to IndexedDB */
      await db.put('files', {
        id: uid(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: file,
        folderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      progressEl.style.width = '100%';
      statusEl.textContent = 'Done';
      statusEl.className = 'upload-item-status done';
    } catch (err) {
      statusEl.textContent = 'Error';
      statusEl.className = 'upload-item-status error';
      allDone = false;
    }
  }
  const doneBtn = document.getElementById('upload-done-btn');
  if (doneBtn) doneBtn.style.display = 'block';
  if (allDone) toast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`, 'success');
}

/* Handle file input change */
function handleFileUpload(e) {
  const files = e.target.files;
  if (files.length > 0) showUploadModal(files);
  e.target.value = ''; // Reset so same files can be re-uploaded
}

/* Handle folder input change */
function handleFolderUpload(e) {
  const files = e.target.files;
  if (files.length > 0) showUploadModal(files);
  e.target.value = '';
}

/* Upload files directly (e.g., from drag-drop) */
async function uploadFiles(files, folderId) {
  showUploadModal(files);
  /* processUploads handles the DB writes */
}

/* Rename modal */
function showRenameModal(type, id) {
  const store = type === 'folder' ? 'folders' : 'files';
  db.get(store, id).then(item => {
    if (!item) return;
    openModal(`
      <div class="modal-header">
        <h2>Rename ${type === 'folder' ? 'Folder' : 'File'}</h2>
        <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" class="form-input" id="rename-input" value="${item.name}">
        </div>
        <input type="hidden" id="rename-type" value="${type}">
        <input type="hidden" id="rename-id" value="${id}">
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="handleRename()">Rename</button>
        </div>
      </div>
    `);
    document.getElementById('rename-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRename(); });
    /* Select the name without extension for files */
    setTimeout(() => {
      const inp = document.getElementById('rename-input');
      if (type === 'file') {
        const dotIdx = item.name.lastIndexOf('.');
        inp.setSelectionRange(0, dotIdx > 0 ? dotIdx : item.name.length);
      } else {
        inp.select();
      }
    }, 100);
  });
}

async function handleRename() {
  const name = document.getElementById('rename-input').value.trim();
  const type = document.getElementById('rename-type').value;
  const id = document.getElementById('rename-id').value;
  if (!name) { toast('Name cannot be empty', 'error'); return; }

  const item = await db.get(type === 'folder' ? 'folders' : 'files', id);
  if (item) {
    item.name = name;
    item.updatedAt = Date.now();
    await db.put(type === 'folder' ? 'folders' : 'files', item);
  }
  closeModal();
  toast(`Renamed to "${name}"`, 'success');
  render();
}

/* Delete confirmation */
function showDeleteModal(type, id) {
  const store = type === 'folder' ? 'folders' : 'files';
  db.get(store, id).then(item => {
    if (!item) return;
    const msg = type === 'folder'
      ? `This will delete "<strong>${item.name}</strong>" and all its contents. This action cannot be undone.`
      : `This will delete "<strong>${item.name}</strong>". This action cannot be undone.`;
    openModal(`
      <div class="modal-header">
        <h2>Delete ${type === 'folder' ? 'Folder' : 'File'}</h2>
        <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body">
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">${msg}</p>
        <input type="hidden" id="delete-type" value="${type}">
        <input type="hidden" id="delete-id" value="${id}">
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-danger" onclick="handleDelete()">Delete</button>
        </div>
      </div>
    `);
  });
}

async function handleDelete() {
  const type = document.getElementById('delete-type').value;
  const id = document.getElementById('delete-id').value;

  if (type === 'folder') {
    /* Recursively delete folder contents */
    await deleteFolderRecursive(id);
  } else {
    await db.delete('files', id);
  }
  closeModal();
  toast('Deleted successfully', 'success');
  /* If we deleted the current folder, go to parent */
  if (type === 'folder' && id === state.currentFolderId) {
    const folder = await db.get('folders', id);
    state.currentFolderId = folder ? folder.parentId : null;
    if (state.view !== 'myfiles') state.view = 'myfiles';
  }
  render();
}

async function deleteFolderRecursive(folderId) {
  /* Delete all files in this folder */
  const files = await db.getByIndex('files', 'folderId', folderId);
  for (const f of files) await db.delete('files', f.id);
  /* Delete all subfolders recursively */
  const subfolders = await db.getByIndex('folders', 'parentId', folderId);
  for (const sub of subfolders) await deleteFolderRecursive(sub.id);
  /* Delete the folder itself */
  await db.delete('folders', folderId);
}

/* Move file to folder modal */
async function showMoveModal(type, id) {
  const allFolders = await db.getAll('folders');
  const item = await db.get(type === 'folder' ? 'folders' : 'files', id);
  if (!item) return;

  const folderOptions = allFolders
    .filter(f => f.id !== id && !f.isDriveLink)
    .map(f => `<option value="${f.id}" ${item.folderId === f.id ? 'selected' : ''}>${f.name}</option>`)
    .join('');

  openModal(`
    <div class="modal-header">
      <h2>Move to Folder</h2>
      <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Destination</label>
        <select class="form-input" id="move-destination" style="cursor:pointer">
          <option value="">Root (My Files)</option>
          ${folderOptions}
        </select>
      </div>
      <input type="hidden" id="move-type" value="${type}">
      <input type="hidden" id="move-id" value="${id}">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="handleMove()">Move</button>
      </div>
    </div>
  `);
}

async function handleMove() {
  const type = document.getElementById('move-type').value;
  const id = document.getElementById('move-id').value;
  const dest = document.getElementById('move-destination').value || null;

  const store = type === 'folder' ? 'folders' : 'files';
  const item = await db.get(store, id);
  if (item) {
    if (type === 'folder') item.parentId = dest;
    else item.folderId = dest;
    item.updatedAt = Date.now();
    await db.put(store, item);
  }
  closeModal();
  toast('Moved successfully', 'success');
  render();
}

/* ============================================
   CONTEXT MENU
   ============================================ */
function showContextMenu(e, type, id) {
  e.preventDefault();
  e.stopPropagation();
  state.contextTarget = { type, id };

  const isFolder = type === 'folder';
  const items = isFolder ? `
    <div class="ctx-item" data-action="open"><span class="material-symbols-outlined">folder_open</span>Open</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" data-action="rename"><span class="material-symbols-outlined">edit</span>Rename</div>
    <div class="ctx-item" data-action="move"><span class="material-symbols-outlined">drive_file_move_outline</span>Move to...</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" data-action="delete"><span class="material-symbols-outlined">delete</span>Delete</div>
  ` : `
    <div class="ctx-item" data-action="download"><span class="material-symbols-outlined">download</span>Download</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" data-action="rename"><span class="material-symbols-outlined">edit</span>Rename</div>
    <div class="ctx-item" data-action="move"><span class="material-symbols-outlined">drive_file_move_outline</span>Move to...</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" data-action="delete"><span class="material-symbols-outlined">delete</span>Delete</div>
  `;

  const menu = document.getElementById('context-menu');
  menu.innerHTML = items;
  menu.classList.add('open');

  /* Position the menu */
  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - 250);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function closeContextMenu() {
  document.getElementById('context-menu').classList.remove('open');
  state.contextTarget = null;
}

/* Context menu action handler */
document.getElementById('context-menu').addEventListener('click', (e) => {
  const item = e.target.closest('.ctx-item');
  if (!item || !state.contextTarget) return;
  e.stopPropagation();

  const action = item.dataset.action;
  const { type, id } = state.contextTarget;
  closeContextMenu();

  if (action === 'open') navigateToFolder(id);
  else if (action === 'download') downloadFile(id);
  else if (action === 'rename') showRenameModal(type, id);
  else if (action === 'move') showMoveModal(type, id);
  else if (action === 'delete') showDeleteModal(type, id);
});

/* ============================================
   FILE DOWNLOAD
   ============================================ */
async function downloadFile(id) {
  const file = await db.get('files', id);
  if (!file || !file.data) { toast('File not found', 'error'); return; }
  const url = URL.createObjectURL(file.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloading ${file.name}`, 'info');
}

/* ============================================
   NAVIGATION
   ============================================ */
function navigateToFolder(folderId) {
  /* Check if it's a Drive link */
  db.get('folders', folderId).then(folder => {
    if (folder && folder.isDriveLink) {
      window.open(folder.driveUrl, '_blank', 'noopener');
      return;
    }
    state.view = 'myfiles';
    state.currentFolderId = folderId;
    state.searchQuery = '';
    document.getElementById('search-input').value = '';
    render();
  });
}

function navigateToParent() {
  if (!state.currentFolderId) return;
  db.get('folders', state.currentFolderId).then(folder => {
    if (folder) {
      state.currentFolderId = folder.parentId;
    } else {
      state.currentFolderId = null;
    }
    render();
  });
}

/* ============================================
   MAIN RENDER FUNCTION
   ============================================ */
async function render() {
  /* Update active nav */
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === state.view);
  });

  /* Render folder tree in sidebar */
  renderFolderTree();

  /* Render breadcrumbs */
  renderBreadcrumbs();

  /* Render main content based on view */
  const content = document.getElementById('content');
  switch (state.view) {
    case 'home': content.innerHTML = await renderDashboard(); break;
    case 'myfiles': content.innerHTML = await renderFileView(); break;
    case 'recent': content.innerHTML = await renderRecentView(); break;
    case 'folders': content.innerHTML = await renderAllFoldersView(); break;
    case 'shared': content.innerHTML = await renderSharedLinksView(); break;
    case 'settings': content.innerHTML = renderSettingsView(); break;
    default: content.innerHTML = await renderDashboard();
  }

  /* Bind content-level events after render */
  bindContentEvents();
}

/* ============================================
   FOLDER TREE (Sidebar)
   ============================================ */
async function renderFolderTree() {
  const folders = await db.getAll('folders');
  const rootFolders = folders.filter(f => !f.parentId && !f.isDriveLink);

  function buildTree(parentId) {
    const children = folders.filter(f => f.parentId === parentId && !f.isDriveLink);
    if (children.length === 0) return '';
    return `<div class="tree-children">${children.map(f => {
      const isActive = state.currentFolderId === f.id && state.view === 'myfiles';
      const subTree = buildTree(f.id);
      return `<div class="tree-item ${isActive ? 'active' : ''}" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}">
        <span class="material-symbols-outlined" style="color:${f.color}">folder</span>
        <span style="overflow:hidden;text-overflow:ellipsis">${f.name}</span>
      </div>${subTree}`;
    }).join('')}</div>`;
  }

  const treeHTML = rootFolders.map(f => {
    const isActive = state.currentFolderId === f.id && state.view === 'myfiles';
    const subTree = buildTree(f.id);
    return `<div class="tree-item ${isActive ? 'active' : ''}" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}">
      <span class="material-symbols-outlined" style="color:${f.color}">folder</span>
      <span style="overflow:hidden;text-overflow:ellipsis">${f.name}</span>
    </div>${subTree}`;
  }).join('');

  document.getElementById('folder-tree').innerHTML = treeHTML || '<p style="padding:8px 12px;font-size:12px;color:var(--text-tertiary)">No folders yet</p>';
}

/* ============================================
   BREADCRUMBS
   ============================================ */
async function renderBreadcrumbs() {
  const container = document.getElementById('breadcrumbs');
  if (state.view !== 'myfiles' || !state.currentFolderId) {
    const labels = { home: 'Home', myfiles: 'My Files', recent: 'Recent', folders: 'All Folders', shared: 'Shared Links', settings: 'Settings' };
    container.innerHTML = `<span class="crumb current">${labels[state.view] || 'My Drive'}</span>`;
    return;
  }

  const crumbs = [];
  let fid = state.currentFolderId;
  while (fid) {
    const folder = await db.get('folders', fid);
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    fid = folder.parentId;
  }
  crumbs.unshift({ id: null, name: 'My Files' });

  container.innerHTML = crumbs.map((c, i) => {
    const isLast = i === crumbs.length - 1;
    return `${i > 0 ? '<span class="crumb-sep">/</span>' : ''}<span class="crumb ${isLast ? 'current' : ''}" data-crumb-id="${c.id}">${c.name}</span>`;
  }).join('');
}

/* ============================================
   DASHBOARD VIEW
   ============================================ */
async function renderDashboard() {
  const allFiles = await db.getAll('files');
  const allFolders = await db.getAll('folders');
  const realFolders = allFolders.filter(f => !f.isDriveLink);
  const totalSize = allFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const recentFiles = [...allFiles].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  const recentHTML = recentFiles.length > 0 ? recentFiles.map(f => {
    const ft = getFileType(f.name, f.type);
    return `<div class="recent-item" data-action="download" data-file-id="${f.id}">
      <div class="recent-file-icon" style="background:${ft.color}15;color:${ft.color}">
        <span class="material-symbols-outlined" style="font-size:20px">${ft.icon}</span>
      </div>
      <div class="recent-file-info">
        <div class="recent-file-name">${f.name}</div>
        <div class="recent-file-meta">${formatDate(f.createdAt)}</div>
      </div>
      <div class="recent-file-size">${formatSize(f.size)}</div>
    </div>`;
  }).join('') : '<p style="padding:16px;color:var(--text-tertiary);font-size:14px">No files yet</p>';

  return `<div class="dashboard slide-up">
    <div class="dashboard-header">
      <h1>Welcome to My Drive</h1>
      <p>Your personal cloud storage. Upload, organize, and share your files.</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(59,130,246,0.1);color:#3B82F6">
          <span class="material-symbols-outlined">insert_drive_file</span>
        </div>
        <div class="stat-value">${allFiles.length}</div>
        <div class="stat-label">Total Files</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(249,115,22,0.1);color:#F97316">
          <span class="material-symbols-outlined">folder</span>
        </div>
        <div class="stat-value">${realFolders.length}</div>
        <div class="stat-label">Total Folders</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(168,85,247,0.1);color:#A855F7">
          <span class="material-symbols-outlined">cloud</span>
        </div>
        <div class="stat-value">${formatSize(totalSize)}</div>
        <div class="stat-label">Storage Used</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(5,150,105,0.1);color:#059669">
          <span class="material-symbols-outlined">link</span>
        </div>
        <div class="stat-value">${allFolders.filter(f => f.isDriveLink).length}</div>
        <div class="stat-label">Shared Links</div>
      </div>
    </div>
    <div class="section-title">
      <span class="material-symbols-outlined" style="font-size:20px;color:var(--accent)">schedule</span>
      Recent Uploads
    </div>
    <div class="recent-list">${recentHTML}</div>
  </div>`;
}

/* ============================================
   FILE VIEW (My Files)
   ============================================ */
async function renderFileView() {
  let folders, files;

  if (state.searchQuery) {
    /* Search mode: find matching folders and files globally */
    const allFolders = await db.getAll('folders');
    const allFiles = await db.getAll('files');
    folders = allFolders.filter(f => !f.isDriveLink && f.name.toLowerCase().includes(state.searchQuery));
    files = allFiles.filter(f => f.name.toLowerCase().includes(state.searchQuery));
  } else {
    /* Normal mode: show contents of current folder */
    folders = (await db.getByIndex('folders', 'parentId', state.currentFolderId)).filter(f => !f.isDriveLink);
    files = await db.getByIndex('files', 'folderId', state.currentFolderId);
  }

  /* Sort: folders first, then by name */
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  const total = folders.length + files.length;
  const title = state.searchQuery ? `Search results for "${state.searchQuery}"` : (state.currentFolderId ? '' : 'My Files');
  const subtitle = state.searchQuery ? `${total} item${total !== 1 ? 's' : ''} found` : `${total} item${total !== 1 ? 's' : ''}`;

  if (total === 0) {
    const emptyMsg = state.searchQuery ? 'No files or folders match your search.' : 'This folder is empty.';
    const emptyIcon = state.searchQuery ? 'search_off' : 'folder_open';
    return `<div class="file-toolbar">
      ${title ? `<h2>${title}</h2>` : ''}
      <div class="toolbar-actions">
        <span style="font-size:13px;color:var(--text-tertiary)">${subtitle}</span>
      </div>
    </div>
    <div class="empty-state fade-in">
      <span class="material-symbols-outlined">${emptyIcon}</span>
      <h3>${state.searchQuery ? 'No results' : 'Nothing here yet'}</h3>
      <p>${emptyMsg}</p>
    </div>`;
  }

  let contentHTML;
  if (state.viewMode === 'grid') {
    contentHTML = renderGridView(folders, files);
  } else {
    contentHTML = renderListView(folders, files);
  }

  return `<div class="file-toolbar">
    ${title ? `<h2>${title}</h2>` : ''}
    <div class="toolbar-actions">
      <span style="font-size:13px;color:var(--text-tertiary)">${subtitle}</span>
    </div>
  </div>${contentHTML}`;
}

function renderGridView(folders, files) {
  const folderCards = folders.map((f, i) => `
    <div class="file-card" data-action="open-folder" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}" draggable="true" style="animation-delay:${i * 0.03}s">
      <div class="file-card-checkbox" data-select="folder" data-id="${f.id}"></div>
      <div class="file-card-preview">
        <span class="material-symbols-outlined" style="font-size:56px;color:${f.color}">folder</span>
      </div>
      <div class="file-card-name" title="${f.name}">${f.name}</div>
      <div class="file-card-meta">${f.isDriveLink ? 'Google Drive Link' : 'Folder'}</div>
    </div>
  `).join('');

  const fileCards = files.map((f, i) => {
    const ft = getFileType(f.name, f.type);
    const isImage = ft.label === 'Image';
    return `<div class="file-card" data-action="download" data-file-id="${f.id}" data-context-type="file" data-context-id="${f.id}" draggable="true" style="animation-delay:${(folders.length + i) * 0.03}s">
      <div class="file-card-checkbox" data-select="file" data-id="${f.id}"></div>
      <div class="file-card-preview">
        ${isImage ? `<img data-thumbnail="${f.id}" alt="${f.name}">` : `<span class="material-symbols-outlined" style="font-size:48px;color:${ft.color}">${ft.icon}</span>`}
      </div>
      <div class="file-card-name" title="${f.name}">${f.name}</div>
      <div class="file-card-meta">${formatSize(f.size)} &middot; ${formatDate(f.createdAt)}</div>
    </div>`;
  }).join('');

  return `<div class="file-grid">${folderCards}${fileCards}</div>`;
}

function renderListView(folders, files) {
  const headerHTML = `<div class="file-list-header">
    <div></div><div>Name</div><div>Size</div><div>Modified</div><div></div>
  </div>`;

  const folderRows = folders.map((f, i) => `
    <div class="file-list-item" data-action="open-folder" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}" draggable="true" style="animation-delay:${i * 0.02}s">
      <div class="file-list-icon" style="background:${f.color}15;color:${f.color}">
        <span class="material-symbols-outlined" style="font-size:22px">folder</span>
      </div>
      <div class="file-list-name">${f.name}</div>
      <div class="file-list-size">Folder</div>
      <div class="file-list-date">${formatDate(f.updatedAt)}</div>
      <button class="file-list-more" data-context-type="folder" data-context-id="${f.id}" title="More actions">
        <span class="material-symbols-outlined" style="font-size:20px">more_vert</span>
      </button>
    </div>
  `).join('');

  const fileRows = files.map((f, i) => {
    const ft = getFileType(f.name, f.type);
    return `<div class="file-list-item" data-action="download" data-file-id="${f.id}" data-context-type="file" data-context-id="${f.id}" draggable="true" style="animation-delay:${(folders.length + i) * 0.02}s">
      <div class="file-list-icon" style="background:${ft.color}15;color:${ft.color}">
        <span class="material-symbols-outlined" style="font-size:22px">${ft.icon}</span>
      </div>
      <div class="file-list-name">${f.name}</div>
      <div class="file-list-size">${formatSize(f.size)}</div>
      <div class="file-list-date">${formatDate(f.createdAt)}</div>
      <button class="file-list-more" data-context-type="file" data-context-id="${f.id}" title="More actions">
        <span class="material-symbols-outlined" style="font-size:20px">more_vert</span>
      </button>
    </div>`;
  }).join('');

  return `${headerHTML}<div>${folderRows}${fileRows}</div>`;
}

/* ============================================
   RECENT VIEW
   ============================================ */
async function renderRecentView() {
  const allFiles = await db.getAll('files');
  const recent = [...allFiles].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);

  if (recent.length === 0) {
    return `<div class="file-toolbar"><h2>Recent</h2></div>
    <div class="empty-state fade-in">
      <span class="material-symbols-outlined">schedule</span>
      <h3>No recent files</h3>
      <p>Files you upload will appear here.</p>
    </div>`;
  }

  /* Use list view for recent */
  const rows = recent.map((f, i) => {
    const ft = getFileType(f.name, f.type);
    return `<div class="file-list-item" data-action="download" data-file-id="${f.id}" data-context-type="file" data-context-id="${f.id}" style="animation-delay:${i * 0.02}s">
      <div class="file-list-icon" style="background:${ft.color}15;color:${ft.color}">
        <span class="material-symbols-outlined" style="font-size:22px">${ft.icon}</span>
      </div>
      <div class="file-list-name">${f.name}</div>
      <div class="file-list-size">${formatSize(f.size)}</div>
      <div class="file-list-date">${formatDate(f.createdAt)}</div>
      <button class="file-list-more" data-context-type="file" data-context-id="${f.id}" title="More actions">
        <span class="material-symbols-outlined" style="font-size:20px">more_vert</span>
      </button>
    </div>`;
  }).join('');

  return `<div class="file-toolbar"><h2>Recent</h2><div class="toolbar-actions"><span style="font-size:13px;color:var(--text-tertiary)">${recent.length} files</span></div></div>
  <div class="file-list-header"><div></div><div>Name</div><div>Size</div><div>Modified</div><div></div></div>
  <div>${rows}</div>`;
}

/* ============================================
   ALL FOLDERS VIEW
   ============================================ */
async function renderAllFoldersView() {
  const allFolders = await db.getAll('folders');
  const realFolders = allFolders.filter(f => !f.isDriveLink);

  if (realFolders.length === 0) {
    return `<div class="file-toolbar"><h2>All Folders</h2></div>
    <div class="empty-state fade-in">
      <span class="material-symbols-outlined">folder_copy</span>
      <h3>No folders</h3>
      <p>Create folders to organize your files.</p>
    </div>`;
  }

  const cards = realFolders.map((f, i) => `
    <div class="file-card" data-action="open-folder" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}" style="animation-delay:${i * 0.03}s">
      <div class="file-card-preview">
        <span class="material-symbols-outlined" style="font-size:56px;color:${f.color}">folder</span>
      </div>
      <div class="file-card-name" title="${f.name}">${f.name}</div>
      <div class="file-card-meta">${formatDate(f.createdAt)}</div>
    </div>
  `).join('');

  return `<div class="file-toolbar"><h2>All Folders</h2><div class="toolbar-actions"><span style="font-size:13px;color:var(--text-tertiary)">${realFolders.length} folders</span></div></div>
  <div class="file-grid">${cards}</div>`;
}

/* ============================================
   SHARED LINKS VIEW
   ============================================ */
async function renderSharedLinksView() {
  const allFolders = await db.getAll('folders');
  const links = allFolders.filter(f => f.isDriveLink);

  if (links.length === 0) {
    return `<div class="file-toolbar"><h2>Shared Links</h2></div>
    <div class="empty-state fade-in">
      <span class="material-symbols-outlined">link_off</span>
      <h3>No shared links</h3>
      <p>Add Google Drive folder links to access them from here.</p>
    </div>`;
  }

  const cards = links.map((f, i) => `
    <div class="file-card" data-action="open-link" data-folder-id="${f.id}" data-context-type="folder" data-context-id="${f.id}" style="animation-delay:${i * 0.03}s">
      <div class="file-card-preview" style="position:relative">
        <span class="material-symbols-outlined" style="font-size:56px;color:${f.color}">folder</span>
        <span class="material-symbols-outlined" style="position:absolute;top:8px;right:8px;font-size:18px;color:var(--text-tertiary)">open_in_new</span>
      </div>
      <div class="file-card-name" title="${f.name}">${f.name}</div>
      <div class="file-card-meta">Google Drive Link</div>
    </div>
  `).join('');

  return `<div class="file-toolbar"><h2>Shared Links</h2><div class="toolbar-actions"><span style="font-size:13px;color:var(--text-tertiary)">${links.length} links</span></div></div>
  <div class="file-grid">${cards}</div>`;
}

/* ============================================
   SETTINGS VIEW
   ============================================ */
function renderSettingsView() {
  return `<div class="slide-up">
    <div class="file-toolbar"><h2>Settings</h2></div>
    <div class="settings-section">
      <h3>Appearance</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <h4>Dark Mode</h4>
            <p>Switch between light and dark themes</p>
          </div>
          <button class="toggle ${state.isDark ? 'on' : ''}" id="settings-dark-toggle" aria-label="Toggle dark mode"></button>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <h4>Default View</h4>
            <p>Choose grid or list view for files</p>
          </div>
          <div style="display:flex;gap:4px">
            <button class="icon-btn ${state.viewMode === 'grid' ? 'active' : ''}" id="settings-grid-btn" title="Grid view"><span class="material-symbols-outlined">grid_view</span></button>
            <button class="icon-btn ${state.viewMode === 'list' ? 'active' : ''}" id="settings-list-btn" title="List view"><span class="material-symbols-outlined">view_list</span></button>
          </div>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <h3>Storage</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <h4>Clear All Data</h4>
            <p>Delete all files, folders, and settings from this browser</p>
          </div>
          <button class="btn btn-danger" id="clear-data-btn" style="height:36px;font-size:13px;padding:0 16px">Clear Data</button>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <h3>About</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <h4>My Drive</h4>
            <p>Version 1.0.0 &middot; A Google Drive-inspired file manager</p>
          </div>
          <span class="material-symbols-outlined" style="color:var(--text-tertiary)">info</span>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <h4>Storage Backend</h4>
            <p>IndexedDB (browser-local storage)</p>
          </div>
          <span class="material-symbols-outlined" style="color:var(--text-tertiary)">storage</span>
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================
   CONTENT EVENT BINDING (after render)
   ============================================ */
function bindContentEvents() {
  const content = document.getElementById('content');

  /* Click delegation for file/folder cards and list items */
  content.addEventListener('click', handleContentClick);
  content.addEventListener('contextmenu', handleContentContextMenu);

  /* Drag and drop for moving files between folders */
  content.querySelectorAll('[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
  });

  /* Breadcrumb clicks */
  document.querySelectorAll('.crumb[data-crumb-id]').forEach(crumb => {
    crumb.addEventListener('click', () => {
      state.currentFolderId = crumb.dataset.crumbId || null;
      render();
    });
  });

  /* Sidebar folder tree clicks */
  document.querySelectorAll('.tree-item[data-folder-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-context-type]') && e.button === 2) return;
      navigateToFolder(item.dataset.folderId);
      closeSidebar();
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, 'folder', item.dataset.contextId);
    });
  });

  /* Load image thumbnails */
  content.querySelectorAll('img[data-thumbnail]').forEach(img => {
    db.get('files', img.dataset.thumbnail).then(file => {
      if (file && file.data) {
        const url = URL.createObjectURL(file.data);
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
      }
    });
  });

  /* Settings-specific bindings */
  const darkToggle = document.getElementById('settings-dark-toggle');
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      state.isDark = !state.isDark;
      localStorage.setItem('mydrive_theme', state.isDark ? 'dark' : 'light');
      applyTheme();
      render();
    });
  }
  const gridBtn = document.getElementById('settings-grid-btn');
  if (gridBtn) {
    gridBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      localStorage.setItem('mydrive_viewmode', 'grid');
      updateViewToggle();
      render();
    });
  }
  const listBtn = document.getElementById('settings-list-btn');
  if (listBtn) {
    listBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      localStorage.setItem('mydrive_viewmode', 'list');
      updateViewToggle();
      render();
    });
  }
  const clearBtn = document.getElementById('clear-data-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      openModal(`
        <div class="modal-header">
          <h2>Clear All Data</h2>
          <button class="modal-close" onclick="closeModal()"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body">
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">This will permanently delete all files, folders, and links. This action <strong>cannot be undone</strong>.</p>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="handleClearData()">Clear Everything</button>
          </div>
        </div>
      `);
    });
  }
}

async function handleClearData() {
  const files = await db.getAll('files');
  for (const f of files) await db.delete('files', f.id);
  const folders = await db.getAll('folders');
  for (const f of folders) await db.delete('folders', f.id);
  closeModal();
  state.currentFolderId = null;
  toast('All data cleared', 'info');
  render();
}

/* Content click handler */
function handleContentClick(e) {
  /* More button (list view) */
  const moreBtn = e.target.closest('.file-list-more');
  if (moreBtn) {
    e.stopPropagation();
    const rect = moreBtn.getBoundingClientRect();
    showContextMenu({ preventDefault: () => {}, stopPropagation: () => {}, clientX: rect.left, clientY: rect.bottom + 4 }, moreBtn.dataset.contextType, moreBtn.dataset.contextId);
    return;
  }

  /* Checkbox selection */
  const checkbox = e.target.closest('.file-card-checkbox');
  if (checkbox) {
    e.stopPropagation();
    checkbox.classList.toggle('checked');
    const icon = checkbox.classList.contains('checked') ? 'check' : '';
    checkbox.innerHTML = icon ? '<span class="material-symbols-outlined" style="font-size:16px">check</span>' : '';
    return;
  }

  /* Card / list item click */
  const card = e.target.closest('[data-action]');
  if (!card) return;
  const action = card.dataset.action;

  if (action === 'open-folder') {
    navigateToFolder(card.dataset.folderId);
  } else if (action === 'open-link') {
    db.get('folders', card.dataset.folderId).then(f => {
      if (f && f.driveUrl) window.open(f.driveUrl, '_blank', 'noopener');
    });
  } else if (action === 'download') {
    downloadFile(card.dataset.fileId);
  }
}

/* Content context menu handler */
function handleContentContextMenu(e) {
  const target = e.target.closest('[data-context-type]');
  if (!target) return;
  showContextMenu(e, target.dataset.contextType, target.dataset.contextId);
}

/* ============================================
   DRAG AND DROP (File moving)
   ============================================ */
let dragData = null;

function handleDragStart(e) {
  const el = e.currentTarget;
  const type = el.dataset.contextType;
  const id = el.dataset.contextId;
  if (!type || !id) return;
  dragData = { type, id };
  el.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
}

function handleDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  dragData = null;
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  const el = e.currentTarget;
  if (!dragData || el.dataset.contextType !== 'folder' || el.dataset.contextId === dragData.id) return;
  e.dataTransfer.dropEffect = 'move';
  el.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragData) return;

  const destFolderId = e.currentTarget.dataset.contextId;
  if (!destFolderId || destFolderId === dragData.id) return;

  /* Prevent dropping a folder into its own descendant */
  if (dragData.type === 'folder') {
    let checkId = destFolderId;
    while (checkId) {
      if (checkId === dragData.id) return; // Circular reference
      const f = await db.get('folders', checkId);
      checkId = f ? f.parentId : null;
    }
  }

  const store = dragData.type === 'folder' ? 'folders' : 'files';
  const item = await db.get(store, dragData.id);
  if (item) {
    if (dragData.type === 'folder') item.parentId = destFolderId;
    else item.folderId = destFolderId;
    item.updatedAt = Date.now();
    await db.put(store, item);
    toast(`Moved to folder`, 'success');
    render();
  }
  dragData = null;
}

/* ============================================
   INITIALIZATION
   ============================================ */
initApp().catch(err => console.error('Failed to initialize app:', err));
