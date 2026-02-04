/**
 * Database Utility Module
 * Handles all IndexedDB operations for Mozhii Note
 */

const DB_NAME = 'MozhiiNoteDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

/**
 * Opens or creates the database
 * @returns {Promise<IDBDatabase>} The database instance
 */
export function openDatabase() {
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
      
      // Create notes object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        
        // Create indexes for efficient querying
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('url', 'url', { unique: false });
        objectStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        objectStore.createIndex('title', 'title', { unique: false });
        
        console.log('Database schema created successfully');
      }
    };
  });
}

/**
 * Initializes the database (call on extension install)
 * @returns {Promise<void>}
 */
export async function initDatabase() {
  try {
    const db = await openDatabase();
    db.close();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Saves a note to the database
 * @param {Object} note - The note object to save
 * @returns {Promise<string>} The ID of the saved note
 */
export async function saveNote(note) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.add(note);
    
    request.onsuccess = () => {
      resolve(note.id);
    };
    
    request.onerror = () => {
      console.error('Failed to save note:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Updates an existing note
 * @param {Object} note - The note object with updated data
 * @returns {Promise<void>}
 */
export async function updateNote(note) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put(note);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to update note:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Retrieves all notes from the database
 * @returns {Promise<Array>} Array of all notes
 */
export async function getAllNotes() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      // Sort by timestamp (newest first)
      const notes = request.result.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      resolve(notes);
    };
    
    request.onerror = () => {
      console.error('Failed to get notes:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Gets a single note by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>} The note or null if not found
 */
export async function getNoteById(noteId) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(noteId);
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    
    request.onerror = () => {
      console.error('Failed to get note:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Gets all notes for a specific URL
 * @param {string} url - The page URL
 * @returns {Promise<Array>} Array of notes for that URL
 */
export async function getNotesByUrl(url) {
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
      console.error('Failed to get notes by URL:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Gets all notes with a specific tag
 * @param {string} tag - The tag to filter by
 * @returns {Promise<Array>} Array of notes with that tag
 */
export async function getNotesByTag(tag) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('tags');
    
    const request = index.getAll(tag);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      console.error('Failed to get notes by tag:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Deletes a note by ID
 * @param {string} noteId - The note ID to delete
 * @returns {Promise<void>}
 */
export async function deleteNote(noteId) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(noteId);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to delete note:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Gets all unique tags from all notes
 * @returns {Promise<Array<string>>} Array of unique tags
 */
export async function getAllTags() {
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
 * Searches notes by text content
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching notes
 */
export async function searchNotes(query) {
  const notes = await getAllNotes();
  const lowerQuery = query.toLowerCase();
  
  return notes.filter(note => 
    note.text.toLowerCase().includes(lowerQuery) ||
    note.title.toLowerCase().includes(lowerQuery) ||
    (note.comment && note.comment.toLowerCase().includes(lowerQuery)) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
  );
}

/**
 * Clears all notes from the database
 * @returns {Promise<void>}
 */
export async function clearAllNotes() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.clear();
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      console.error('Failed to clear notes:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Exports all notes as JSON
 * @returns {Promise<string>} JSON string of all notes
 */
export async function exportNotes() {
  const notes = await getAllNotes();
  return JSON.stringify(notes, null, 2);
}

/**
 * Imports notes from JSON
 * @param {string} jsonData - JSON string of notes
 * @returns {Promise<number>} Number of notes imported
 */
export async function importNotes(jsonData) {
  const notes = JSON.parse(jsonData);
  let importedCount = 0;
  
  for (const note of notes) {
    try {
      await saveNote(note);
      importedCount++;
    } catch (error) {
      // Note might already exist, try updating
      try {
        await updateNote(note);
        importedCount++;
      } catch (updateError) {
        console.error('Failed to import note:', note.id, updateError);
      }
    }
  }
  
  return importedCount;
}
