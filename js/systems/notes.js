// Notes System
// Handles the notes panel and note management

import { showNotification } from './notifications.js?v=5';
import { formatTime } from '../utils/helpers.js?v=16';

// Initialize game state if not exists
if (!window.gameState) {
    window.gameState = {};
}
if (!window.gameState.notes) {
    window.gameState.notes = [];
}

let unreadNotes = 0;

// Initialize the notes system
export function initializeNotes() {
    // Set up notes toggle button
    const notesToggle = document.getElementById('notes-toggle');
    notesToggle.addEventListener('click', toggleNotesPanel);
    
    // Set up notes close button
    const notesClose = document.getElementById('notes-close');
    notesClose.addEventListener('click', toggleNotesPanel);
    
    // Set up search functionality
    const notesSearch = document.getElementById('notes-search');
    notesSearch.addEventListener('input', updateNotesPanel);
    
    // Set up category filters
    const categories = document.querySelectorAll('.notes-category');
    categories.forEach(category => {
        category.addEventListener('click', () => {
            console.log('NOTES DEBUG: Category clicked:', category.dataset.category);
            // Remove active class from all categories
            categories.forEach(c => c.classList.remove('active'));
            // Add active class to clicked category
            category.classList.add('active');
            console.log('NOTES DEBUG: Active category set to:', category.dataset.category);
            // Update notes panel
            updateNotesPanel();
        });
    });
    
    // Initialize notes count
    updateNotesCount();
    
    console.log('Notes system initialized');
}

// Add a note to the notes panel
export function addNote(title, text, important = false) {
    console.log('NOTES DEBUG: Adding note', { title, important, textLength: text.length });
    
    // Check if a note with the same title and text already exists
    const existingNote = window.gameState.notes.find(note => note.title === title && note.text === text);
    
    // If the note already exists, don't add it again but mark it as read
    if (existingNote) {
        console.log(`Note "${title}" already exists, not adding duplicate`);
        
        // Mark as read if it wasn't already
        if (!existingNote.read) {
            existingNote.read = true;
            updateNotesPanel();
            updateNotesCount();
        }
        
        return null;
    }
    
    const note = {
        id: Date.now(),
        title: title,
        text: text,
        timestamp: new Date(),
        read: false,
        important: important
    };
    
    console.log('NOTES DEBUG: Note created', note);
    
    window.gameState.notes.push(note);
    updateNotesPanel();
    updateNotesCount();
    
    // Show notification for new note
    showNotification(`New note added: ${title}`, 'info', 'Note Added', 3000);
    
    return note;
}

// Update the notes panel with current notes
export function updateNotesPanel() {
    const notesContent = document.getElementById('notes-content');
    const searchTerm = document.getElementById('notes-search')?.value?.toLowerCase() || '';
    
    // Get active category
    const activeCategory = document.querySelector('.notes-category.active')?.dataset.category || 'all';
    
    console.log('NOTES DEBUG: Updating panel', {
        activeCategory,
        totalNotes: window.gameState.notes.length,
        notesData: window.gameState.notes.map(note => ({
            title: note.title,
            important: note.important,
            read: note.read
        }))
    });
    
    // Filter notes based on search and category
    let filteredNotes = [...window.gameState.notes];
    
    // Apply category filter
    if (activeCategory === 'important') {
        filteredNotes = filteredNotes.filter(note => note.important);
    } else if (activeCategory === 'unread') {
        filteredNotes = filteredNotes.filter(note => !note.read);
    }
    
    console.log('NOTES DEBUG: After filtering', {
        activeCategory,
        filteredCount: filteredNotes.length,
        filteredNotes: filteredNotes.map(note => ({
            title: note.title,
            important: note.important,
            read: note.read
        }))
    });
    
    // Apply search filter
    if (searchTerm) {
        filteredNotes = filteredNotes.filter(note => 
            note.title.toLowerCase().includes(searchTerm) || 
            note.text.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort notes with important ones first, then by timestamp (newest first)
    filteredNotes.sort((a, b) => {
        if (a.important !== b.important) {
            return a.important ? -1 : 1;
        }
        return b.timestamp - a.timestamp;
    });
    
    // Clear current content
    notesContent.innerHTML = '';
    
    // Add notes
    if (filteredNotes.length === 0) {
        if (searchTerm) {
            notesContent.innerHTML = '<div class="note-item">No notes match your search.</div>';
        } else if (activeCategory !== 'all') {
            notesContent.innerHTML = `<div class="note-item">No ${activeCategory} notes found.</div>`;
        } else {
            notesContent.innerHTML = '<div class="note-item">No notes yet.</div>';
        }
    } else {
        filteredNotes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-item';
            noteElement.dataset.id = note.id;
            
            // Format the timestamp
            const formattedTime = formatTime(note.timestamp);
            
            let noteContent = `<div class="note-title">
                <span>${note.title}</span>
                <div class="note-icons">`;
            
            if (note.important) {
                noteContent += `<span class="note-icon">⭐</span>`;
            }
            if (!note.read) {
                noteContent += `<span class="note-icon">📌</span>`;
            }
            
            noteContent += `</div></div>`;
            noteContent += `<div class="note-text">${note.text}</div>`;
            noteContent += `<div class="note-timestamp">${formattedTime}</div>`;
            
            noteElement.innerHTML = noteContent;
            
            // Toggle expanded state when clicked
            noteElement.addEventListener('click', () => {
                noteElement.classList.toggle('expanded');
                
                // Mark as read when expanded
                if (!note.read && noteElement.classList.contains('expanded')) {
                    note.read = true;
                    updateNotesCount();
                    updateNotesPanel();
                }
            });
            
            notesContent.appendChild(noteElement);
        });
    }
}

// Update the unread notes count
export function updateNotesCount() {
    const notesCount = document.getElementById('notes-count');
    unreadNotes = window.gameState.notes.filter(note => !note.read).length;
    
    notesCount.textContent = unreadNotes;
    notesCount.style.display = unreadNotes > 0 ? 'flex' : 'none';
}

// Toggle the notes panel
export function toggleNotesPanel() {
    const notesPanel = document.getElementById('notes-panel');
    const isVisible = notesPanel.style.display === 'block';
    
    notesPanel.style.display = isVisible ? 'none' : 'block';
}

// Export for global access
window.addNote = addNote; 