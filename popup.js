/**
 * Mozhii Note - Modern Popup Script
 * Handles UI interactions, note management, and modals
 */

// State
let allNotes = [];
let currentFilter = 'all';
let currentTagFilter = '';
let currentSearchQuery = '';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  updateDynamicTheme();
  showLoadingState(true);
  await loadNotes();
  await loadTags();
  setupEventListeners();
  showLoadingState(false);
  
  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check if opened in popout mode
  if (urlParams.get('popout') === 'true') {
    document.body.classList.add('popout-mode');
    // Hide popout button in popout mode
    const popoutBtn = document.getElementById('popout-btn');
    if (popoutBtn) popoutBtn.style.display = 'none';
  }
  
  // Check if we need to focus a specific note
  const focusNoteId = urlParams.get('focusNote');
  if (focusNoteId) {
    setTimeout(() => {
      const noteCard = document.querySelector(`.note-card[data-id="${focusNoteId}"]`);
      if (noteCard) {
        noteCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        noteCard.style.animation = 'highlight-pulse 2s ease infinite';
        setTimeout(() => {
          noteCard.style.animation = '';
        }, 2000);
      }
    }, 500);
  }
});

/**
 * Shows or hides the loading state
 */
function showLoadingState(show) {
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  
  if (loadingState) {
    loadingState.style.display = show ? 'flex' : 'none';
  }
  
  if (show && emptyState) {
    emptyState.style.display = 'none';
  }
}

// ============================================
// DATA LOADING
// ============================================

async function loadNotes() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getNotes' });
    allNotes = response || [];
    updateNoteCount();
    applyFilters();
  } catch (error) {
    console.error('Error loading notes:', error);
    allNotes = [];
    showToast('Failed to load notes', 'error');
  }
}

async function loadTags() {
  try {
    const tags = await chrome.runtime.sendMessage({ action: 'getAllTags' });
    const tagFilter = document.getElementById('tag-filter');
    
    if (tagFilter && tags && tags.length > 0) {
      tagFilter.innerHTML = '<option value="">🏷️ All Tags</option>';
      
      tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      applyFilters();
    }, 200));
    searchInput.focus();
  }
  
  // Filter pills (updated class name)
  document.querySelectorAll('.filter-pill').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-pill').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.dataset.filter;
      applyFilters();
    });
  });
  
  // Tag filter
  const tagFilter = document.getElementById('tag-filter');
  if (tagFilter) {
    tagFilter.addEventListener('change', (e) => {
      currentTagFilter = e.target.value;
      applyFilters();
    });
  }
  
  // Add note button (header)
  document.getElementById('add-note-btn')?.addEventListener('click', openCreateNoteModal);
  
  // Create first note button (empty state)
  document.getElementById('create-first-note')?.addEventListener('click', openCreateNoteModal);
  
  // Pop-out button
  document.getElementById('popout-btn')?.addEventListener('click', openInNewWindow);
  
  // Info button
  document.getElementById('info-btn')?.addEventListener('click', openInfoModal);
  
  // Create note modal events
  document.getElementById('close-create-modal')?.addEventListener('click', closeCreateNoteModal);
  document.getElementById('cancel-create')?.addEventListener('click', closeCreateNoteModal);
  document.getElementById('save-manual-note')?.addEventListener('click', saveManualNote);
  
  // Quick tags
  document.querySelectorAll('.quick-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      const tagValue = e.currentTarget.dataset.tag;
      const tagsInput = document.getElementById('note-tags');
      
      if (tagsInput) {
        const currentTags = tagsInput.value.trim();
        if (currentTags) {
          if (!currentTags.toLowerCase().includes(tagValue.toLowerCase())) {
            tagsInput.value = currentTags + ', ' + tagValue;
          }
        } else {
          tagsInput.value = tagValue;
        }
        e.currentTarget.classList.add('selected');
      }
    });
  });
  
  // Info modal close
  document.getElementById('close-info-modal')?.addEventListener('click', closeInfoModal);
  
  // Modal overlay clicks
  document.getElementById('create-note-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'create-note-modal') closeCreateNoteModal();
  });
  
  document.getElementById('info-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'info-modal') closeInfoModal();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreateNoteModal();
      closeInfoModal();
    }
    
    // Ctrl/Cmd + N to create new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openCreateNoteModal();
    }
  });
}

// ============================================
// FILTERING & RENDERING
// ============================================

function applyFilters() {
  let filtered = [...allNotes];
  
  // Time filter
  if (currentFilter === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filtered = filtered.filter(note => new Date(note.timestamp) >= today);
  } else if (currentFilter === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    filtered = filtered.filter(note => new Date(note.timestamp) >= weekAgo);
  }
  
  // Tag filter
  if (currentTagFilter) {
    filtered = filtered.filter(note => 
      note.tags && note.tags.includes(currentTagFilter)
    );
  }
  
  // Search filter
  if (currentSearchQuery) {
    filtered = filtered.filter(note => 
      note.text.toLowerCase().includes(currentSearchQuery) ||
      note.title?.toLowerCase().includes(currentSearchQuery) ||
      note.comment?.toLowerCase().includes(currentSearchQuery) ||
      (note.tags && note.tags.some(tag => tag.toLowerCase().includes(currentSearchQuery)))
    );
  }
  
  renderNotes(filtered);
}

function renderNotes(notes) {
  const container = document.getElementById('notes-container');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  
  // Remove existing cards
  container.querySelectorAll('.note-card').forEach(card => card.remove());
  
  if (loadingState) loadingState.style.display = 'none';
  
  if (!notes || notes.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'flex';
      
      const emptyHint = emptyState.querySelector('.empty-hint');
      const emptyOr = emptyState.querySelector('.empty-or');
      const createBtn = emptyState.querySelector('.btn-create-first');
      
      if (currentSearchQuery || currentTagFilter || currentFilter !== 'all') {
        if (emptyHint) emptyHint.innerHTML = 'No notes match your filters. Try adjusting your search.';
        if (emptyOr) emptyOr.style.display = 'none';
        if (createBtn) createBtn.style.display = 'none';
      } else {
        if (emptyHint) emptyHint.innerHTML = 'Highlight text on any webpage and right-click → <strong>"Save as CrazyNote"</strong>';
        if (emptyOr) emptyOr.style.display = 'block';
        if (createBtn) createBtn.style.display = 'flex';
      }
    }
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  const sorted = [...notes].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  sorted.forEach((note, index) => {
    const card = createNoteCard(note, index);
    container.appendChild(card);
  });
}

function createNoteCard(note, index) {
  const card = document.createElement('div');
  card.className = 'note-card';
  if (note.isManual) card.classList.add('manual-note');
  card.style.animationDelay = `${index * 40}ms`;
  
  const textPreview = note.text.length > 100 
    ? note.text.substring(0, 100) + '...' 
    : note.text;
  
  const domain = note.isManual ? (note.source || 'Manual Note') : extractDomain(note.url);
  const relativeTime = getRelativeTime(note.timestamp);
  
  const tagsHtml = note.tags && note.tags.length > 0
    ? `<div class="tags">${note.tags.map(tag => 
        `<span class="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
      ).join('')}</div>`
    : '';
  
  const commentHtml = note.comment
    ? `<div class="note-comment">💬 ${escapeHtml(truncate(note.comment, 60))}</div>`
    : '';
  
  const domainIcon = note.isManual ? '✍️' : '🌐';
  
  card.innerHTML = `
    <div class="note-content">
      <div class="note-text">${escapeHtml(textPreview)}</div>
      ${commentHtml}
      <div class="note-meta">
        <span class="domain" title="${escapeHtml(note.url || note.source || '')}">
          <span class="domain-icon">${domainIcon}</span>
          ${escapeHtml(truncate(domain, 20))}
        </span>
        <span class="timestamp" title="${new Date(note.timestamp).toLocaleString()}">
          <span class="time-icon">🕒</span>
          ${relativeTime}
        </span>
      </div>
      ${tagsHtml}
    </div>
    <div class="actions">
      ${!note.isManual ? `
        <button class="btn-jump" data-id="${note.id}" title="Go to the original page">
          <span class="btn-icon">↗️</span>
          Go to Note
        </button>
      ` : `
        <button class="btn-jump" data-id="${note.id}" title="View note" style="flex: 2;">
          <span class="btn-icon">📋</span>
          Copy Text
        </button>
      `}
      <button class="btn-delete" data-id="${note.id}" title="Delete this note">
        <span class="btn-icon">🗑️</span>
      </button>
    </div>
  `;
  
  // Event listeners
  const jumpBtn = card.querySelector('.btn-jump');
  const deleteBtn = card.querySelector('.btn-delete');
  
  if (note.isManual) {
    jumpBtn?.addEventListener('click', () => copyNoteText(note));
  } else {
    jumpBtn?.addEventListener('click', () => jumpToNote(note));
  }
  
  deleteBtn?.addEventListener('click', () => deleteNote(note.id));
  
  // Tag click to filter
  card.querySelectorAll('.tag').forEach(tagEl => {
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagFilter = document.getElementById('tag-filter');
      if (tagFilter) {
        tagFilter.value = tagEl.dataset.tag;
        currentTagFilter = tagEl.dataset.tag;
        applyFilters();
      }
    });
  });
  
  return card;
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openCreateNoteModal() {
  const modal = document.getElementById('create-note-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('note-text')?.focus();
    
    // Reset form
    document.getElementById('note-text').value = '';
    document.getElementById('note-source').value = '';
    document.getElementById('note-tags').value = '';
    document.getElementById('note-comment').value = '';
    document.querySelectorAll('.quick-tag').forEach(t => t.classList.remove('selected'));
  }
}

function closeCreateNoteModal() {
  const modal = document.getElementById('create-note-modal');
  if (modal) modal.style.display = 'none';
}

function openInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.style.display = 'flex';
    updateStats();
  }
}

function updateStats() {
  const totalNotes = allNotes.length;
  const webNotes = allNotes.filter(note => !note.isManual).length;
  const manualNotes = allNotes.filter(note => note.isManual).length;
  
  const totalEl = document.getElementById('stat-total-notes');
  const webEl = document.getElementById('stat-web-notes');
  const manualEl = document.getElementById('stat-manual-notes');
  
  if (totalEl) totalEl.textContent = totalNotes;
  if (webEl) webEl.textContent = webNotes;
  if (manualEl) manualEl.textContent = manualNotes;
}

function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) modal.style.display = 'none';
}

async function saveManualNote() {
  const text = document.getElementById('note-text')?.value.trim();
  const source = document.getElementById('note-source')?.value.trim();
  const tagsInput = document.getElementById('note-tags')?.value.trim();
  const comment = document.getElementById('note-comment')?.value.trim();
  
  if (!text) {
    showToast('Please enter note content', 'error');
    document.getElementById('note-text')?.focus();
    return;
  }
  
  const tags = tagsInput 
    ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];
  
  const noteData = {
    text: text,
    url: '',
    title: source || 'Manual Note',
    source: source,
    comment: comment,
    tags: tags,
    isManual: true,
    scrollY: 0,
    elementPath: '',
    startOffset: 0,
    endOffset: text.length,
    viewportWidth: 0,
    viewportHeight: 0
  };
  
  try {
    await chrome.runtime.sendMessage({
      action: 'saveNote',
      noteData: noteData
    });
    
    closeCreateNoteModal();
    showToast('Note saved successfully! ✨', 'success');
    await loadNotes();
    await loadTags();
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Failed to save note', 'error');
  }
}

// ============================================
// ACTIONS
// ============================================

async function jumpToNote(note) {
  try {
    await chrome.runtime.sendMessage({
      action: 'jumpToNote',
      noteData: note
    });
    window.close();
  } catch (error) {
    console.error('Error jumping to note:', error);
    showToast('Failed to navigate', 'error');
  }
}

async function copyNoteText(note) {
  try {
    await navigator.clipboard.writeText(note.text);
    showToast('Text copied to clipboard! 📋', 'success');
  } catch (error) {
    console.error('Error copying text:', error);
    showToast('Failed to copy text', 'error');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Delete this note permanently?')) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'deleteNote',
      noteId: noteId
    });
    
    showToast('Note deleted', 'success');
    await loadNotes();
    await loadTags();
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Failed to delete note', 'error');
  }
}

function openInNewWindow() {
  const width = 440;
  const height = 720;
  const left = screen.width - width - 30;
  const top = 30;
  
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html?popout=true'),
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top,
    focused: true  // Keep focused on creation
  }, (newWindow) => {
    // Store the window ID for potential future reference
    if (newWindow && newWindow.id) {
      chrome.storage.local.set({ popoutWindowId: newWindow.id });
    }
  });
  
  window.close();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateNoteCount() {
  const countEl = document.getElementById('note-count');
  if (countEl) {
    countEl.textContent = allNotes.length;
  }
}

function extractDomain(url) {
  if (!url) return 'Unknown';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function getRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.popup-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `popup-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============================================
// DYNAMIC THEME ENGINE (5-minute color cycling)
// ============================================

// Color palette for 5-minute cycles (12 slots per hour = 12 colors cycling)
const THEME_COLORS = [
    { primary: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }, // Red
    { primary: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }, // Orange
    { primary: '#eab308', gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' }, // Yellow
    { primary: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }, // Green
    { primary: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }, // Teal
    { primary: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }, // Cyan
    { primary: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }, // Blue
    { primary: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }, // Indigo
    { primary: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }, // Violet
    { primary: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' }, // Purple
    { primary: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }, // Pink
    { primary: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }  // Rose
];

function updateDynamicTheme() {
    // Calculate 5-minute slot (0-11 cycling through colors)
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const fiveMinSlot = Math.floor(totalMinutes / 5) % THEME_COLORS.length;
    
    const theme = THEME_COLORS[fiveMinSlot];
    
    if (theme) {
        document.documentElement.style.setProperty('--primary', theme.primary);
        document.documentElement.style.setProperty('--primary-gradient', theme.gradient);
        console.log(`CrazyNote theme updated (slot ${fiveMinSlot}):`, theme.primary);
    }
    
    // Schedule next update at the start of next 5-minute interval
    const nextUpdate = (5 - (now.getMinutes() % 5)) * 60 * 1000 - now.getSeconds() * 1000;
    setTimeout(updateDynamicTheme, nextUpdate);
}
