/**
 * CrazyNote - Content Script
 * Handles text selection, highlighting, and context restoration
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.crazyNoteInitialized) {
    return;
  }
  window.crazyNoteInitialized = true;
  
  // ============================================
  // XPATH UTILITIES
  // ============================================
  
  /**
   * Generates an XPath expression for a given DOM element
   * @param {Element} element - The DOM element
   * @returns {string} XPath expression
   */
  function getXPath(element) {
    if (!element) return '';
    
    // If element has an ID, use it for a shorter path
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    // If we've reached the document body, return base path
    if (element === document.body) {
      return '/html/body';
    }
    
    // If we've reached the document element (html)
    if (element === document.documentElement) {
      return '/html';
    }
    
    // If parent doesn't exist, we can't build the path
    if (!element.parentNode) {
      return '';
    }
    
    // Count siblings of the same type
    let index = 0;
    const siblings = element.parentNode.childNodes;
    
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      
      if (sibling === element) {
        const tagName = element.tagName.toLowerCase();
        return `${getXPath(element.parentNode)}/${tagName}[${index + 1}]`;
      }
      
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        index++;
      }
    }
    
    return '';
  }
  
  /**
   * Retrieves a DOM element using an XPath expression
   * @param {string} xpath - The XPath expression
   * @returns {Element|null} The found element or null
   */
  function getElementByXPath(xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    } catch (error) {
      console.error('Error evaluating XPath:', xpath, error);
      return null;
    }
  }
  
  // ============================================
  // NOTE CAPTURE
  // ============================================
  
  /**
   * Captures the current text selection with all context data
   * @returns {Object|null} Note data object or null if no selection
   */
  function captureNoteContext() {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    
    const text = selection.toString().trim();
    
    if (text.length === 0) {
      return null;
    }
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE 
      ? container.parentNode 
      : container;
    
    // Get the text content of the parent element for better context
    const parentText = element.textContent || '';
    const textInParent = parentText.indexOf(text);
    
    return {
      text: text,
      url: window.location.href,
      title: document.title,
      scrollY: Math.round(window.scrollY),
      scrollX: Math.round(window.scrollX),
      elementPath: getXPath(element),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      textInParentOffset: textInParent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      parentTagName: element.tagName?.toLowerCase() || 'unknown'
    };
  }
  
  // ============================================
  // HIGHLIGHTING
  // ============================================
  
  /**
   * Creates a highlight span element
   * @param {string} noteId - The note ID
   * @param {string} [color='#FFEB3B'] - Highlight color
   * @returns {HTMLSpanElement}
   */
  function createHighlightSpan(noteId, color = '#FFEB3B') {
    const span = document.createElement('span');
    span.className = 'mozhii-highlight';
    span.setAttribute('data-note-id', noteId);
    span.style.setProperty('--highlight-color', color);
    return span;
  }
  
  /**
   * Applies a highlight to the current selection
   * @param {string} noteId - The note ID
   * @param {string} [color] - Highlight color
   * @returns {boolean} Success status
   */
  function applyHighlightToSelection(noteId, color) {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false;
    }
    
    try {
      const range = selection.getRangeAt(0);
      
      // Check if range crosses element boundaries (causes DOMException)
      if (range.startContainer !== range.endContainer) {
        // For complex selections, just clear selection without highlighting
        selection.removeAllRanges();
        return false;
      }
      
      const span = createHighlightSpan(noteId, color);
      
      // Clone the range to avoid modifying the original
      const newRange = range.cloneRange();
      
      // Wrap the selected content
      newRange.surroundContents(span);
      
      // Clear the selection
      selection.removeAllRanges();
      
      return true;
    } catch (error) {
      console.error('Error applying highlight:', error);
      // Fallback: try to highlight using text content matching
      return false;
    }
  }
  
  /**
   * Applies a highlight using stored note data
   * @param {Object} noteData - The note data with location info
   * @returns {HTMLElement|null} The highlight element or null
   */
  function applyHighlightFromData(noteData) {
    // Check if highlight already exists
    const existing = document.querySelector(`[data-note-id="${noteData.id}"]`);
    if (existing) {
      return existing;
    }
    
    // Strategy 1: Try XPath first
    let element = getElementByXPath(noteData.elementPath);
    
    // Strategy 2: If XPath fails, search the entire document for the text
    if (!element) {
      element = findElementContainingText(noteData.text);
    }
    
    // Strategy 3: If still not found, try a delayed search (for dynamic content)
    if (!element) {
      // Schedule a retry for dynamic pages
      scheduleHighlightRetry(noteData);
      return null;
    }
    
    return tryApplyHighlight(element, noteData);
  }
  
  /**
   * Searches the document for an element containing the exact text
   * @param {string} text - The text to find
   * @returns {Element|null}
   */
  function findElementContainingText(text) {
    if (!text || text.length < 3) return null;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip hidden elements and scripts
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check if this node contains the text
          if (node.textContent && node.textContent.includes(text)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    const node = walker.nextNode();
    return node ? node.parentElement : null;
  }
  
  /**
   * Schedules a retry for highlighting on dynamic pages
   * @param {Object} noteData
   */
  function scheduleHighlightRetry(noteData) {
    const maxRetries = 3;
    const retryKey = `retry_${noteData.id}`;
    
    // Get current retry count
    const retryCount = window[retryKey] || 0;
    
    if (retryCount < maxRetries) {
      window[retryKey] = retryCount + 1;
      
      setTimeout(() => {
        const element = findElementContainingText(noteData.text);
        if (element) {
          tryApplyHighlight(element, noteData);
          delete window[retryKey];
        }
      }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s
    }
  }
  
  /**
   * Attempts to apply highlight to an element
   * @param {Element} element 
   * @param {Object} noteData 
   * @returns {HTMLElement|null}
   */
  function tryApplyHighlight(element, noteData) {
    try {
      // Try to find the exact text in the element
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      let currentOffset = 0;
      
      while ((node = walker.nextNode())) {
        const nodeText = node.textContent;
        const textIndex = nodeText.indexOf(noteData.text);
        
        if (textIndex !== -1) {
          // Found the text in this node
          const range = document.createRange();
          range.setStart(node, textIndex);
          range.setEnd(node, textIndex + noteData.text.length);
          
          const span = createHighlightSpan(noteData.id, noteData.highlightColor);
          
          try {
            range.surroundContents(span);
            return span;
          } catch (e) {
            // If surroundContents fails (e.g., crosses element boundaries)
            // Try a simpler approach
            try {
              const contents = range.extractContents();
              span.appendChild(contents);
              range.insertNode(span);
              return span;
            } catch (e2) {
              // Last resort: just mark the parent element
              console.warn('Complex highlight structure, skipping:', noteData.id);
              return null;
            }
          }
        }
        
        currentOffset += nodeText.length;
      }
      
      // Fallback: Search all text nodes for partial match
      const allText = element.textContent || '';
      if (allText.includes(noteData.text)) {
        // The text exists but is split across nodes
        // For now, silently skip - the text is there but highlighting is complex
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('Error applying highlight from data:', error);
      return null;
    }
  }
  
  /**
   * Removes a highlight by note ID
   * @param {string} noteId - The note ID
   */
  function removeHighlight(noteId) {
    const highlight = document.querySelector(`[data-note-id="${noteId}"]`);
    if (highlight) {
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
      parent.normalize(); // Merge adjacent text nodes
    }
  }
  
  // ============================================
  // CONTEXT RESTORATION
  // ============================================
  
  /**
   * Restores a note's context (scrolls and highlights)
   * @param {Object} noteData - The note data
   */
  function restoreNoteContext(noteData) {
    // First, scroll to the approximate position
    window.scrollTo({
      top: noteData.scrollY || 0,
      behavior: 'smooth'
    });
    
    // Wait for scroll to complete, then find and highlight
    setTimeout(() => {
      const highlight = applyHighlightFromData(noteData);
      
      if (highlight) {
        // Scroll the highlight into view (centered)
        highlight.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        
        // Add pulse animation
        highlight.classList.add('mozhii-pulse');
        
        // Remove pulse after animation completes
        setTimeout(() => {
          highlight.classList.remove('mozhii-pulse');
        }, 2500);
      } else {
        // Couldn't find the exact text, show a notification
        showToast('Could not locate the exact text. It may have been modified.');
      }
    }, 600);
  }
  
  // ============================================
  // PAGE HIGHLIGHTS LOADER
  // ============================================
  
  // Store pending highlights for retry on dynamic content
  let pendingHighlights = [];
  let highlightObserver = null;
  let extensionContextValid = true;
  
  /**
   * Check if extension context is still valid
   */
  function isExtensionContextValid() {
    try {
      // Try to access chrome.runtime.id - it will be undefined if context is invalid
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Loads all highlights for the current page
   */
  async function loadPageHighlights() {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      extensionContextValid = false;
      return; // Silently exit - extension was reloaded
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNotesByUrl',
        url: window.location.href
      });
      
      if (response && Array.isArray(response)) {
        pendingHighlights = [...response];
        
        response.forEach(note => {
          const result = applyHighlightFromData(note);
          if (result) {
            // Remove from pending
            pendingHighlights = pendingHighlights.filter(n => n.id !== note.id);
          }
        });
        
        // Setup observer for dynamic content if there are pending highlights
        if (pendingHighlights.length > 0) {
          setupDynamicContentObserver();
        }
        
        if (response.length > 0) {
          const restored = response.length - pendingHighlights.length;
          if (restored > 0) {
            console.log(`CrazyNote: Restored ${restored} highlight(s)`);
          }
        }
      }
    } catch (error) {
      // Extension context invalidated - this happens when extension is reloaded
      // Mark as invalid and stop all extension-related operations
      if (error.message?.includes('Extension context invalidated') || 
          error.message?.includes('Extension context was invalidated')) {
        extensionContextValid = false;
        // Cleanup any observers
        if (highlightObserver) {
          highlightObserver.disconnect();
          highlightObserver = null;
        }
        return; // Silently exit
      }
      // Only log unexpected errors
      console.error('Error loading page highlights:', error);
    }
  }
  
  /**
   * Sets up a MutationObserver for dynamic pages (ChatGPT, LinkedIn, etc.)
   */
  function setupDynamicContentObserver() {
    if (highlightObserver) return; // Already observing
    
    let debounceTimer = null;
    
    highlightObserver = new MutationObserver((mutations) => {
      // Debounce to avoid excessive processing
      if (debounceTimer) clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        if (pendingHighlights.length === 0) {
          highlightObserver.disconnect();
          highlightObserver = null;
          return;
        }
        
        // Try to apply pending highlights
        const stillPending = [];
        
        for (const note of pendingHighlights) {
          const existing = document.querySelector(`[data-note-id="${note.id}"]`);
          if (existing) continue;
          
          const element = findElementContainingText(note.text);
          if (element) {
            const result = tryApplyHighlight(element, note);
            if (!result) {
              stillPending.push(note);
            }
          } else {
            stillPending.push(note);
          }
        }
        
        pendingHighlights = stillPending;
        
        // Stop observing if all highlights are applied
        if (pendingHighlights.length === 0 && highlightObserver) {
          highlightObserver.disconnect();
          highlightObserver = null;
        }
      }, 500);
    });
    
    highlightObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Auto-disconnect after 30 seconds to prevent memory issues
    setTimeout(() => {
      if (highlightObserver) {
        highlightObserver.disconnect();
        highlightObserver = null;
      }
    }, 30000);
  }
  
  // ============================================
  // UI HELPERS
  // ============================================
  
  /**
   * Shows a toast notification
   * @param {string} message - The message to display
   * @param {number} [duration=3000] - Duration in milliseconds
   */
  function showToast(message, duration = 3000) {
    // Remove existing toast
    const existingToast = document.getElementById('mozhii-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'mozhii-toast';
    toast.className = 'mozhii-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('mozhii-toast-visible');
    });
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('mozhii-toast-visible');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }
  
  /**
   * Shows an annotation modal for adding comments/tags
   * @param {Object} noteData - The initial note data
   * @returns {Promise<Object>} Updated note data with user input
   */
  function showAnnotationModal(noteData) {
    return new Promise((resolve) => {
      // Remove existing modal
      const existingModal = document.getElementById('mozhii-modal');
      if (existingModal) {
        existingModal.remove();
      }
      
      const modal = document.createElement('div');
      modal.id = 'mozhii-modal';
      modal.className = 'mozhii-modal';
      modal.innerHTML = `
        <div class="mozhii-modal-content">
          <div class="mozhii-modal-header">
            <h3>📝 Add Note Details</h3>
            <button class="mozhii-modal-close" title="Close">&times;</button>
          </div>
          <div class="mozhii-modal-body">
            <div class="mozhii-modal-preview">
              <strong>Selected text:</strong>
              <p>"${noteData.text.length > 100 ? noteData.text.substring(0, 100) + '...' : noteData.text}"</p>
            </div>
            <div class="mozhii-modal-field">
              <label for="mozhii-comment">Comment (optional):</label>
              <textarea id="mozhii-comment" placeholder="Add your thoughts..."></textarea>
            </div>
            <div class="mozhii-modal-field">
              <label for="mozhii-tags">Tags (comma-separated):</label>
              <input type="text" id="mozhii-tags" placeholder="e.g., important, research, to-review">
              <div class="mozhii-tag-suggestions">
                <span class="mozhii-tag-suggestion" data-tag="Important">Important</span>
                <span class="mozhii-tag-suggestion" data-tag="Research">Research</span>
                <span class="mozhii-tag-suggestion" data-tag="To Review">To Review</span>
                <span class="mozhii-tag-suggestion" data-tag="Question">Question</span>
              </div>
            </div>
          </div>
          <div class="mozhii-modal-footer">
            <button class="mozhii-btn mozhii-btn-secondary" id="mozhii-skip">Skip</button>
            <button class="mozhii-btn mozhii-btn-primary" id="mozhii-save">Save Note</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Focus on comment field
      setTimeout(() => {
        document.getElementById('mozhii-comment')?.focus();
      }, 100);
      
      // Event handlers
      const closeModal = (withData = false) => {
        if (withData) {
          const comment = document.getElementById('mozhii-comment')?.value.trim() || '';
          const tagsInput = document.getElementById('mozhii-tags')?.value || '';
          const tags = tagsInput.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
          
          noteData.comment = comment;
          noteData.tags = tags;
        }
        
        modal.classList.add('mozhii-modal-closing');
        setTimeout(() => {
          modal.remove();
          resolve(noteData);
        }, 200);
      };
      
      // Close button
      modal.querySelector('.mozhii-modal-close').addEventListener('click', () => {
        closeModal(false);
      });
      
      // Skip button
      document.getElementById('mozhii-skip').addEventListener('click', () => {
        closeModal(false);
      });
      
      // Save button
      document.getElementById('mozhii-save').addEventListener('click', () => {
        closeModal(true);
      });
      
      // Tag suggestions
      modal.querySelectorAll('.mozhii-tag-suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => {
          const tagsInput = document.getElementById('mozhii-tags');
          const currentTags = tagsInput.value.trim();
          const newTag = suggestion.dataset.tag;
          
          if (currentTags) {
            if (!currentTags.toLowerCase().includes(newTag.toLowerCase())) {
              tagsInput.value = currentTags + ', ' + newTag;
            }
          } else {
            tagsInput.value = newTag;
          }
          
          suggestion.classList.add('mozhii-tag-selected');
        });
      });
      
      // Close on escape or outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(false);
        }
      });
      
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escHandler);
          closeModal(false);
        }
      });
    });
  }
  
  // ============================================
  // MESSAGE LISTENER
  // ============================================
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if extension context is still valid
    if (!extensionContextValid || !isExtensionContextValid()) {
      return false;
    }
    
    switch (message.action) {
      case 'captureNote':
        const noteData = captureNoteContext();
        sendResponse({ noteData });
        break;
        
      case 'highlightSaved':
        // Apply highlight after note is saved - with safe error handling
        try {
          applyHighlightToSelection(message.noteId);
        } catch (e) {
          // Silently handle - selection might have changed
        }
        break;
        
      case 'showSaveConfirmation':
        // Show toast at bottom center and side notification
        showSaveConfirmation(message.noteData);
        sendResponse({ success: true });
        break;
        
      case 'restoreNote':
        restoreNoteContext(message.noteData);
        sendResponse({ success: true });
        break;
        
      case 'removeHighlight':
        removeHighlight(message.noteId);
        sendResponse({ success: true });
        break;
        
      case 'ping':
        // Health check
        sendResponse({ status: 'ok' });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open
  });
  
  // ============================================
  // SAVE CONFIRMATION UI
  // ============================================
  
  /**
   * Shows save confirmation toast and side notification
   * @param {Object} noteData - The saved note data
   */
  function showSaveConfirmation(noteData) {
    // Show toast at bottom center
    showToast('✅ Saved in CrazyNote', 2500);
    
    // Show side notification with note preview
    showSideNotification(noteData);
    
    // Apply highlight to selection
    try {
      applyHighlightToSelection(noteData.id, noteData.highlightColor);
    } catch (e) {
      // Silently handle
    }
  }
  
  /**
   * Shows a side notification with note preview
   * @param {Object} noteData - The saved note data
   */
  function showSideNotification(noteData) {
    // Remove any existing side notification
    const existing = document.querySelector('.mozhii-side-notification');
    if (existing) {
      existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'mozhii-side-notification';
    
    const truncatedText = noteData.text.length > 80 
      ? noteData.text.substring(0, 80) + '...' 
      : noteData.text;
    
    notification.innerHTML = `
      <div class="mozhii-side-notification-header">
        <span class="mozhii-side-icon">✓</span>
        <span class="mozhii-side-title">Note Saved!</span>
        <button class="mozhii-side-close">&times;</button>
      </div>
      <div class="mozhii-side-body">
        <p class="mozhii-side-text">"${truncatedText}"</p>
        <div class="mozhii-side-actions">
           <button class="mozhii-side-edit-btn">Edit Note</button>
           <div class="mozhii-side-hint">View in Mozhii Note →</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('mozhii-side-notification-visible');
    });
    
    // Edit button functionality
    notification.querySelector('.mozhii-side-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeNotification();
      showAnnotationModal(noteData).then(updatedNoteData => {
         // Send updated data back to background 
         chrome.runtime.sendMessage({
           action: 'updateNote',
           noteData: updatedNoteData
         });
         showToast('Note Updated!', 1500);
      });
    });
    
    // Click to open extension popup (navigate to note)
    notification.querySelector('.mozhii-side-body').addEventListener('click', (e) => {
      // If edit button was clicked, don't open popup
      if (e.target.classList.contains('mozhii-side-edit-btn')) return;
      
      // Store noteId for popup to use
      chrome.runtime.sendMessage({
        action: 'openPopupWithNote',
        noteId: noteData.id
      });
      removeNotification();
    });
    
    // Close button
    notification.querySelector('.mozhii-side-close').addEventListener('click', (e) => {
      e.stopPropagation();
      removeNotification();
    });
    
    // Auto-remove after 3 seconds
    const autoRemoveTimeout = setTimeout(() => {
      removeNotification();
    }, 3000);
    
    function removeNotification() {
      clearTimeout(autoRemoveTimeout);
      notification.classList.remove('mozhii-side-notification-visible');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Load highlights when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPageHighlights);
  } else {
    loadPageHighlights();
  }
  
  // Also reload highlights when navigating within SPAs
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(loadPageHighlights, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('Mozhii Note content script loaded');
})();
