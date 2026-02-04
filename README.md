# 📝 Crazy Note

> "Notes that remember where, why, and how you learned something."

A context-aware note-taking Chrome Extension with a modern dark UI. Save highlighted text from web pages with full context preservation, including scroll position and paragraph location. Return to the exact reading point later with a single click.

## ✨ Features

### 🔖 Basic Note Saving
- Save any highlighted text from webpages as a note
- Right-click → "Save as Mozhii Note"
- Automatic capture of: selected text, page URL, page title, timestamp
- Instant save with toast notification confirmation

### ✍️ Manual Note Creation
- Create notes directly from the popup using the **+** button
- Add custom text, source/reference, tags, and comments
- Quick-tag suggestions: Important, Idea, Research, To-Do

### 🖍️ Highlight & Annotate
- Visual yellow highlighting of saved text
- Optional comments and tags for each note
- Tooltips showing comments on hover
- Highlights persist across page reloads

### 📍 Context-Aware Notes
- Precise location data stored with each note
- Scroll position (Y-axis pixels)
- XPath to the containing element
- Character offsets within the element
- Viewport dimensions

### ⏪ Resume Reading
- One-click navigation to exact webpage location
- Automatic scroll to saved position
- Re-highlights original text with pulse animation
- 4-pulse attention-grabbing effect

### 🖼️ Pop-Out Window
- Click the pop-out button to open notes in a separate window
- Drag and position anywhere on screen
- Work with notes alongside your browser

### 📋 Popup Viewer
- Modern dark theme with glassmorphism effects
- Search bar for filtering notes
- Time filters: All, Today, This Week
- Tag-based filtering
- Note cards with text preview, domain, and timestamp

### 🏷️ Tags and Organization
- User-defined tags for categorization
- Colored tag pills on note cards
- Click tags to filter
- Quick tag suggestions in note creation

### ⏰ Timestamping
- ISO 8601 timestamps for each note
- Relative time display: "Just now", "5m ago", "Yesterday"
- Hover for exact date/time
- Sorted newest-first by default

### ℹ️ About & Info
- Click the info button in footer for full extension details
- View current features, roadmap, and technical specs
- Version information and upcoming features

## 🚀 Installation

### Option 1: Load Unpacked (Development)

1. **Download/Clone** this repository
2. **Generate Icons** (Important!):
   - Open `icons/generate-icons.html` in Chrome
   - Download all three icon sizes (16, 48, 128)
   - Save them to the `icons/` folder as PNG files
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked**
6. Select the `mozhii-note` folder
7. The extension icon should appear in your toolbar!

### Option 2: Build for Production

```bash
# Create a zip file for distribution
cd mozhii-note
zip -r mozhii-note.zip . -x "*.git*" -x "*.DS_Store"
```

## 📖 How to Use

### Saving a Note
1. Visit any webpage
2. Select/highlight the text you want to save
3. Right-click on the selected text
4. Choose **"Save as Mozhii Note"**
5. (Optional) Add comments and tags in the popup
6. ✅ Note saved!

### Viewing Notes
1. Click the Mozhii Note icon in your browser toolbar
2. Browse your saved notes
3. Use the search bar to find specific notes
4. Filter by time period or tags

### Jumping to a Note
1. Open the popup
2. Find the note you want
3. Click **"Go to Note"**
4. The original page opens and scrolls to the exact location
5. Your highlighted text pulses to get your attention

### Deleting a Note
1. Open the popup
2. Find the note to delete
3. Click **"Delete"**
4. Confirm the deletion

## 📁 Project Structure

```
mozhii-note/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker (event handling, database)
├── content.js             # Content script (highlighting, capture)
├── content.css            # Styles for highlights and modals
├── popup.html             # Popup interface
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── utils/
│   ├── database.js        # IndexedDB operations
│   ├── uuid.js            # UUID generation
│   └── xpath.js           # XPath utilities
├── icons/
│   ├── icon16.png         # 16x16 icon
│   ├── icon48.png         # 48x48 icon
│   ├── icon128.png        # 128x128 icon
│   └── generate-icons.html # Icon generator tool
└── README.md              # This file
```

## 🗄️ Data Model

Each note is stored with the following structure:

```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID v4
  text: "Highlighted text content",             // Selected text
  url: "https://example.com/article",           // Source URL
  title: "Article Title",                       // Page title
  scrollY: 1024,                                // Vertical scroll position
  elementPath: "/html/body/div[2]/article/p[5]", // XPath to element
  startOffset: 0,                               // Character start
  endOffset: 48,                                // Character end
  viewportWidth: 1920,                          // Browser width
  viewportHeight: 1080,                         // Browser height
  timestamp: "2026-01-31T14:23:45.123Z",        // ISO 8601
  tags: ["AI", "research", "important"],        // User tags
  comment: "Important for thesis",              // Optional comment
  highlightColor: "#FFEB3B",                    // Yellow default
  language: "en"                                // Detected language
}
```

## 🔧 Technical Details

### Permissions Used
- `activeTab` - Access current tab for note capture
- `storage` - IndexedDB for note persistence
- `contextMenus` - Create right-click menu option
- `notifications` - Show save confirmations
- `scripting` - Inject highlights and scroll commands
- `host_permissions: <all_urls>` - Work on any website

### Browser Support
- Chrome 88+ (Manifest V3 required)
- Edge 88+ (Chromium-based)

### Storage
- Uses IndexedDB for local storage
- All data stored locally (no cloud sync in MVP)
- No data collection or external requests

## 🐛 Troubleshooting

### Extension not working on a page?
- Some pages (chrome://, file://) don't allow extensions
- Try refreshing the page after installation
- Check if the extension is enabled in chrome://extensions

### Highlights not appearing?
- The page content might have changed since the note was saved
- Some websites use dynamic content that changes structure
- The extension will show a message if it can't locate the text

### Notes not saving?
- Make sure you've selected text before right-clicking
- Check the browser console for any errors
- Try reloading the extension

## 📜 License

MIT License - Feel free to use, modify, and distribute.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🗺️ Roadmap

- [ ] Cloud sync with user accounts
- [ ] Note export/import (JSON, Markdown)
- [ ] Custom highlight colors
- [ ] Keyboard shortcuts
- [ ] Dark mode support
- [ ] Firefox support
- [ ] Safari support

---

Made with ❤️ for learners, researchers, and knowledge collectors.
