/**
 * XPath Utility Functions
 * For generating and resolving XPath expressions
 */

/**
 * Generates an XPath expression for a given DOM element
 * @param {Element} element - The DOM element
 * @returns {string} XPath expression to locate the element
 */
export function getXPath(element) {
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
      // Build path by combining parent path with current element
      const tagName = element.tagName.toLowerCase();
      return `${getXPath(element.parentNode)}/${tagName}[${index + 1}]`;
    }
    
    // Count only element nodes with the same tag name
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      index++;
    }
  }
  
  return '';
}

/**
 * Retrieves a DOM element using an XPath expression
 * @param {string} xpath - The XPath expression
 * @param {Document} [doc=document] - The document to search in
 * @returns {Element|null} The found element or null
 */
export function getElementByXPath(xpath, doc = document) {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
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

/**
 * Gets a CSS selector for an element (alternative to XPath)
 * @param {Element} element - The DOM element
 * @returns {string} CSS selector string
 */
export function getCSSSelector(element) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/)
        .filter(c => c.length > 0)
        .map(c => CSS.escape(c))
        .join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = current.parentNode;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * Finds the best text node match within an element for given text
 * @param {Element} element - The element to search within
 * @param {string} text - The text to find
 * @returns {{node: Text, offset: number}|null} The text node and offset
 */
export function findTextInElement(element, text) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while ((node = walker.nextNode())) {
    const nodeText = node.textContent;
    const index = nodeText.indexOf(text);
    if (index !== -1) {
      return { node, offset: index };
    }
  }
  
  return null;
}
