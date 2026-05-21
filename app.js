import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  projectId: "storyboard-client-guide",
  appId: "1:271236677278:web:7d3269b9e0a6dc1ed8058f",
  apiKey: "AIzaSyBObDwfoO9LJCvl8Bx2QSp1lGm9AbHozZ0",
  authDomain: "storyboard-client-guide.firebaseapp.com",
  messagingSenderId: "271236677278"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper for debouncing auto-saves
function debounce(func, delay) {
    let timeout;
    const debounced = function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
    debounced.cancel = () => clearTimeout(timeout);
    return debounced;
}

// Helper to format timestamps nicely
function formatTime(timestamp) {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// =============================================================
// 1. COLLABORATIVE MEETING NOTES
// =============================================================
const globalNotesBox = document.getElementById('global-notes-box');
const notesSyncStatus = document.getElementById('notes-sync-status');

if (globalNotesBox && notesSyncStatus) {
    // Listen to real-time changes of global notes in Firestore
    onSnapshot(doc(db, "meeting", "notes"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only update textarea content if the user isn't currently focused and typing
            if (data.text !== undefined && document.activeElement !== globalNotesBox) {
                globalNotesBox.value = data.text;
            }
        }
    });

    const saveNotes = async () => {
        try {
            await setDoc(doc(db, "meeting", "notes"), {
                text: globalNotesBox.value,
                timestamp: Date.now()
            }, { merge: true });
        } catch (e) {
            console.error("Notes save error:", e);
        }
    };

    const debouncedSaveNotes = debounce(saveNotes, 1000);

    globalNotesBox.addEventListener('input', () => {
        debouncedSaveNotes();
    });

    globalNotesBox.addEventListener('blur', () => {
        debouncedSaveNotes.cancel();
        saveNotes();
    });
    
    // Focus effect
    globalNotesBox.addEventListener('focus', () => {
        globalNotesBox.style.borderColor = "var(--primary)";
        globalNotesBox.style.boxShadow = "0 0 10px rgba(201,160,84,0.15)";
    });
    globalNotesBox.addEventListener('blur', () => {
        globalNotesBox.style.borderColor = "rgba(255,255,255,0.1)";
        globalNotesBox.style.boxShadow = "none";
    });
}

// =============================================================
// 2. PANEL COMMENTS SYSTEM
// =============================================================
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    
    // Inject clean Comments Section UI at the bottom of each scene card
    const commentsDiv = document.createElement('div');
    commentsDiv.style.cssText = `
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,0.08);
        font-family: 'Inter', sans-serif;
    `;
    
    commentsDiv.innerHTML = `
        <h4 style="margin: 0 0 15px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary);">
            💬 Comments & Feedback
        </h4>
        
        <!-- List of comments -->
        <div id="comments-list-${sceneId}" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; max-height: 250px; overflow-y: auto; padding-right: 5px;">
            <div style="font-size: 0.85rem; color: #888; font-style: italic;">No feedback left yet. Be the first to comment below!</div>
        </div>
        
        <!-- Add comment form -->
        <div class="no-print" style="display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; padding: 12px;">
            <div style="display: flex; gap: 10px;">
                <input type="text" id="commenter-name-${sceneId}" placeholder="Your Name (e.g. Director, Client)" style="
                    flex: 1;
                    padding: 8px 12px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: #fff;
                    font-size: 0.85rem;
                    outline: none;
                ">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="comment-text-${sceneId}" placeholder="Add a note or request changes..." style="
                    flex: 4;
                    padding: 8px 12px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: #fff;
                    font-size: 0.85rem;
                    outline: none;
                ">
                <button id="btn-post-comment-${sceneId}" class="btn" style="
                    flex: 1;
                    padding: 8px 15px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    border-radius: 6px;
                ">Post</button>
            </div>
        </div>
    `;
    
    card.appendChild(commentsDiv);
    
    const commentsList = document.getElementById(`comments-list-${sceneId}`);
    const nameInput = document.getElementById(`commenter-name-${sceneId}`);
    const textInput = document.getElementById(`comment-text-${sceneId}`);
    const postBtn = document.getElementById(`btn-post-comment-${sceneId}`);
    
    // Autofill name from localStorage for better experience
    if (localStorage.getItem('commenter_name')) {
        nameInput.value = localStorage.getItem('commenter_name');
    }
    
    // Save new comment
    const submitComment = async () => {
        const name = nameInput.value.trim() || "Collaborator";
        const text = textInput.value.trim();
        
        if (!text) return;
        
        // Remember commenter name
        localStorage.setItem('commenter_name', name);
        
        // Visual loading state
        postBtn.disabled = true;
        postBtn.innerText = "...";
        
        try {
            await addDoc(collection(db, "scene_comments", sceneId, "comments"), {
                author: name,
                text: text,
                timestamp: Date.now()
            });
            textInput.value = "";
        } catch (e) {
            console.error("Error adding comment:", e);
            alert("Could not post comment. Check connection or Firestore Rules.");
        } finally {
            postBtn.disabled = false;
            postBtn.innerText = "Post";
        }
    };
    
    postBtn.addEventListener('click', submitComment);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitComment();
    });
    
    // Listen for comments in real-time
    const qComments = query(collection(db, "scene_comments", sceneId, "comments"), orderBy("timestamp", "asc"));
    onSnapshot(qComments, (snapshot) => {
        commentsList.innerHTML = "";
        
        if (snapshot.empty) {
            commentsList.innerHTML = `<div style="font-size: 0.85rem; color: #888; font-style: italic;">No feedback left yet. Be the first to comment below!</div>`;
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const commentId = docSnap.id;
            
            const commentEl = document.createElement('div');
            commentEl.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                background: rgba(255, 255, 255, 0.03);
                border-left: 3px solid var(--primary);
                border-radius: 4px;
                padding: 10px 12px;
                animation: fadeIn 0.3s ease;
            `;
            
            commentEl.innerHTML = `
                <div style="flex: 1; padding-right: 15px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-weight: 600; font-size: 0.85rem; color: #fff;">${data.author}</span>
                        <span style="font-size: 0.75rem; color: #666;">${formatTime(data.timestamp)}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #ddd; line-height: 1.4; word-break: break-word;">${data.text}</div>
                </div>
                <button id="delete-comment-${sceneId}-${commentId}" class="no-print" title="Delete Comment" style="
                    background: transparent;
                    color: rgba(255,255,255,0.3);
                    border: none;
                    font-size: 0.85rem;
                    cursor: pointer;
                    padding: 2px 6px;
                    transition: color 0.2s;
                ">✕</button>
            `;
            
            commentsList.appendChild(commentEl);
            
            // Wire up comment deletion
            const deleteBtn = document.getElementById(`delete-comment-${sceneId}-${commentId}`);
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#e74c3c');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = 'rgba(255,255,255,0.3)');
            deleteBtn.addEventListener('click', async () => {
                if (confirm("Delete this comment permanently?")) {
                    try {
                        await deleteDoc(doc(db, "scene_comments", sceneId, "comments", commentId));
                    } catch (e) {
                        alert("Could not delete comment. Check credentials.");
                    }
                }
            });
        });
        
        // Auto scroll to bottom of comments
        commentsList.scrollTop = commentsList.scrollHeight;
    });
});
