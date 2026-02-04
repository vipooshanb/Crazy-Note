/**
 * Mozhii Note - Background Service Worker
 * Handles context menu, message passing, and database operations
 */

// Database constants
const DB_NAME = 'MozhiiNoteDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Opens or creates the database
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('url', 'url', { unique: false });
        objectStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        console.log('Database schema created successfully');
      }
    };
  });
}

/**
 * Initializes the database
 */
async function initDatabase() {
  try {
    const db = await openDatabase();
    db.close();
    console.log('Mozhii Note database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

/**
 * Generates a UUID v4
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Saves a note to IndexedDB
 * @param {Object} noteData - The note data
 * @param {number} tabId - The tab ID for notifications
 */
async function saveNote(noteData, tabId) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Add metadata
    noteData.id = generateUUID();
    noteData.timestamp = new Date().toISOString();
    noteData.tags = noteData.tags || [];
    noteData.comment = noteData.comment || '';
    noteData.highlightColor = noteData.highlightColor || '#FFEB3B';
    noteData.language = noteData.language || detectLanguage(noteData.text);
    noteData.isManual = noteData.isManual || false;
    
    const request = store.add(noteData);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // Show success notification only for non-manual notes (manual notes show toast)
        if (!noteData.isManual) {
// Skip browser notification for web saves - we'll show toast instead
        }
        
        // Send message to content script to apply highlight (only for web notes)
        if (tabId && !noteData.isManual) {
          chrome.tabs.sendMessage(tabId, {
            action: 'highlightSaved',
            noteId: noteData.id
          }).catch(() => {
            // Tab might have been closed or doesn't have content script
          });
        }
        
        resolve(noteData.id);
      };
      
      request.onerror = () => {
        console.error('Failed to save note:', request.error);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Mozhii Note',
          message: 'Failed to save note. Please try again.'
        });
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in saveNote:', error);
    throw error;
  }
}

/**
 * Saves a note and shows toast + side notification via content script
 * @param {Object} noteData - The note data
 * @param {number} tabId - The tab ID
 */
async function saveNoteWithNotification(noteData, tabId) {
  try {
    const noteId = await saveNote(noteData, tabId);
    
    // Get the saved note with full data
    const savedNote = await getNoteById(noteId);
    
    // Send message to content script to show toast and side notification
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'showSaveConfirmation',
        noteData: savedNote
      }).catch(() => {
        // Fallback to browser notification if content script not available
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Mozhii Note',
          message: 'Note saved successfully!'
        });
      });
    }
    
    return noteId;
  } catch (error) {
    console.error('Error in saveNoteWithNotification:', error);
    throw error;
  }
}

/**
 * Gets all notes from the database
 * @returns {Promise<Array>}
 */
async function getAllNotes() {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const notes = request.result.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        resolve(notes);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
}

/**
 * Gets notes for a specific URL
 * @param {string} url - The page URL
 * @returns {Promise<Array>}
 */
async function getNotesByUrl(url) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('url');
      const request = index.getAll(url);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error getting notes by URL:', error);
    return [];
  }
}

/**
 * Gets a note by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>}
 */
async function getNoteById(noteId) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(noteId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error getting note:', error);
    return null;
  }
}

/**
 * Updates a note
 * @param {Object} noteData - The updated note data
 * @returns {Promise<void>}
 */
async function updateNote(noteData) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(noteData);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
}

/**
 * Deletes a note
 * @param {string} noteId - The note ID to delete
 * @returns {Promise<void>}
 */
async function deleteNote(noteId) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(noteId);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

/**
 * Gets all unique tags
 * @returns {Promise<Array<string>>}
 */
async function getAllTags() {
  const notes = await getAllNotes();
  const tagSet = new Set();
  
  notes.forEach(note => {
    if (note.tags && Array.isArray(note.tags)) {
      note.tags.forEach(tag => tagSet.add(tag));
    }
  });
  
  return Array.from(tagSet).sort();
}

/**
 * Simple language detection based on character sets
 * @param {string} text - The text to analyze
 * @returns {string} Language code
 */
function detectLanguage(text) {
  // Basic detection based on character ranges
  const patterns = {
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,  // Japanese
    zh: /[\u4E00-\u9FFF]/,                // Chinese
    ko: /[\uAC00-\uD7AF]/,                // Korean
    ar: /[\u0600-\u06FF]/,                // Arabic
    he: /[\u0590-\u05FF]/,                // Hebrew
    th: /[\u0E00-\u0E7F]/,                // Thai
    ru: /[\u0400-\u04FF]/,                // Russian/Cyrillic
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  
  return 'en'; // Default to English
}

// ============================================
// NAVIGATION FUNCTIONS
// ============================================

/**
 * Navigates to a note's location
 * @param {Object} noteData - The note with location data
 */
function jumpToNote(noteData) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      // Open in new tab if no active tab
      chrome.tabs.create({ url: noteData.url }, (tab) => {
        waitForTabLoad(tab.id, noteData);
      });
      return;
    }
    
    const currentTab = tabs[0];
    
    // Normalize URLs for comparison
    const normalizeUrl = (url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname + parsed.search;
      } catch {
        return url;
      }
    };
    
    if (normalizeUrl(currentTab.url) === normalizeUrl(noteData.url)) {
      // Same page, just restore position
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'restoreNote',
        noteData: noteData
      }).catch((error) => {
        console.error('Failed to send restore message:', error);
      });
    } else {
      // Navigate to the URL first
      chrome.tabs.update(currentTab.id, { url: noteData.url }, () => {
        waitForTabLoad(currentTab.id, noteData);
      });
    }
  });
}

/**
 * Waits for a tab to finish loading, then restores the note
 * @param {number} tabId - The tab ID
 * @param {Object} noteData - The note data
 */
function waitForTabLoad(tabId, noteData) {
  const listener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      
      // Small delay to ensure content script is ready
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'restoreNote',
          noteData: noteData
        }).catch((error) => {
          console.error('Failed to send restore message after load:', error);
        });
      }, 500);
    }
  };
  
  chrome.tabs.onUpdated.addListener(listener);
  
  // Timeout to prevent listener from staying forever
  setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(listener);
  }, 30000);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('CrazyNote installed/updated:', details.reason);
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'save-mozhii-note',
    title: 'Save as CrazyNote',
    contexts: ['selection']
  });
  
  // Initialize database
  initDatabase();
});

// Helper function to check if content script is ready
async function ensureContentScriptReady(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.status === 'ok';
  } catch (error) {
    // Content script not ready, try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return false;
    }
  }
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-mozhii-note' && tab) {
    await triggerCapture(tab);
  }
});

// Command (shortcut) handler
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'save-note' && tab) {
    await triggerCapture(tab);
  }
});

async function triggerCapture(tab) {
  // Check for restricted URLs (chrome://, edge://, about:, etc.)
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'CrazyNote',
      message: 'Note taking is not supported on this type of page.'
    });
    return;
  }

  // Ensure content script is ready
  const isReady = await ensureContentScriptReady(tab.id);
  if (!isReady) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'CrazyNote',
      message: 'Cannot save note on this page. Try refreshing the page.'
    });
    return;
  }
  
  chrome.tabs.sendMessage(tab.id, { action: 'captureNote' })
    .then((response) => {
      if (response && response.noteData) {
        // Save the note and show toast + side notification
        saveNoteWithNotification(response.noteData, tab.id);
      } else {
        // Silently ignore - user may have no text selected
        // This is not an error, just an expected state
      }
    })
    .catch((error) => {
      // Only log actual errors, not expected communication failures
      if (!error.message?.includes('Receiving end does not exist')) {
        console.error('Failed to capture note:', error);
      }
    });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations
  const handleAsync = async () => {
    try {
      switch (message.action) {
        case 'getNotes':
          return await getAllNotes();
          
        case 'getNotesByUrl':
          return await getNotesByUrl(message.url);
          
        case 'getNoteById':
          return await getNoteById(message.noteId);
          
        case 'saveNote':
          const noteId = await saveNote(message.noteData, sender.tab?.id);
          return { success: true, noteId };
          
        case 'updateNote':
          await updateNote(message.noteData);
          return { success: true };
          
        case 'deleteNote':
          await deleteNote(message.noteId);
          return { success: true };
          
        case 'getAllTags':
          return await getAllTags();
          
        case 'jumpToNote':
          jumpToNote(message.noteData);
          return { success: true };
          
        case 'openPopupWithNote':
          // Open the popout window focused on this note
          const width = 440;
          const height = 720;
          const left = 20; // Open on left side
          const top = 20;
          
          chrome.windows.create({
            url: chrome.runtime.getURL(`popup.html?popout=true&focusNote=${message.noteId}`),
            type: 'popup',
            width: width,
            height: height,
            left: left,
            top: top,
            focused: true
          });
          return { success: true };

        case 'updateNote':
          // Handle update and ensure the UI refreshes
          await updateNote(message.noteData);
          
          // If we have an active tab, refresh highlights to show any changes (like comments)
          if (sender.tab) {
             chrome.tabs.sendMessage(sender.tab.id, {
               action: 'highlightSaved',
               noteId: message.noteData.id
             }).catch(() => {});
          }
          return { success: true };
          
        default:
          console.warn('Unknown action:', message.action);
          return { error: 'Unknown action' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { error: error.message };
    }
  };
  
  handleAsync().then(sendResponse);
  return true; // Keep the message channel open for async response
});

// Handle service worker startup
self.addEventListener('activate', () => {
  console.log('Mozhii Note service worker activated');
  initDatabase();
});

console.log('Mozhii Note background script loaded');
