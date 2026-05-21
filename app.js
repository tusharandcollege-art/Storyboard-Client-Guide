import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Helper to format timestamps nicely
function formatTime(timestamp) {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' — ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// =============================================================
// 1. COLLABORATIVE MEETING NOTES
// =============================================================
const globalNotesBox = document.getElementById('global-notes-box');
const btnSaveNotes = document.getElementById('btn-save-notes');
const notesSaveStatus = document.getElementById('notes-save-status');

if (globalNotesBox) {

    // Load saved notes immediately on page load using getDoc (one-time fetch)
    (async () => {
        try {
            const docSnap = await getDoc(doc(db, "meeting", "notes"));
            if (docSnap.exists() && docSnap.data().text !== undefined) {
                globalNotesBox.value = docSnap.data().text;
            }
        } catch (e) {
            console.error("Could not load notes on startup:", e.message);
        }
    })();

    const saveNotes = async () => {
        if (notesSaveStatus) {
            notesSaveStatus.innerHTML = `⏳ Saving...`;
            notesSaveStatus.style.color = "var(--primary, #c9a054)";
            notesSaveStatus.style.opacity = "1";
        }
        try {
            await setDoc(doc(db, "meeting", "notes"), {
                text: globalNotesBox.value,
                timestamp: Date.now()
            }, { merge: true });

            if (notesSaveStatus) {
                notesSaveStatus.innerHTML = `✅ Saved successfully!`;
                notesSaveStatus.style.color = "#2e7d32";
                setTimeout(() => {
                    notesSaveStatus.style.opacity = "0";
                }, 3000);
            }
        } catch (e) {
            if (notesSaveStatus) {
                notesSaveStatus.innerHTML = `❌ Error: ${e.message}`;
                notesSaveStatus.style.color = "#c0392b";
                notesSaveStatus.style.opacity = "1";
            }
            console.error("Notes save error:", e);
        }
    };

    // Save ONLY on manual button click
    if (btnSaveNotes) {
        btnSaveNotes.addEventListener('click', saveNotes);
    }

    // Focus styling
    globalNotesBox.addEventListener('focus', () => {
        globalNotesBox.style.borderColor = "var(--primary)";
        globalNotesBox.style.boxShadow = "0 0 12px rgba(201,160,84,0.2)";
    });
    globalNotesBox.addEventListener('blur', () => {
        globalNotesBox.style.borderColor = "var(--primary)";
        globalNotesBox.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.05)";
    });
}

// =============================================================
// 2. PANEL COMMENTS SYSTEM
// =============================================================
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;

    const commentsDiv = document.createElement('div');
    commentsDiv.style.cssText = `
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,0.08);
    `;

    commentsDiv.innerHTML = `
        <h4 style="margin: 0 0 15px 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary);">
            💬 Comments &amp; Feedback
        </h4>

        <!-- Comment list -->
        <div id="comments-list-${sceneId}" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; max-height: 250px; overflow-y: auto; padding-right: 4px;">
            <div style="font-size: 0.85rem; color: #aaa; font-style: italic;">No feedback yet. Be the first to comment below!</div>
        </div>

        <!-- Add comment form -->
        <div class="no-print" style="display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.06);">
            <input type="text" id="commenter-name-${sceneId}" placeholder="Your Name (e.g. Director, Client)" style="
                padding: 8px 12px;
                background: #1e1e1e;
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 6px;
                color: #eee;
                font-size: 0.85rem;
                outline: none;
                width: 100%;
                box-sizing: border-box;
            ">
            <div style="display: flex; gap: 8px;">
                <input type="text" id="comment-text-${sceneId}" placeholder="Add a note or request changes..." style="
                    flex: 4;
                    padding: 8px 12px;
                    background: #1e1e1e;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 6px;
                    color: #eee;
                    font-size: 0.85rem;
                    outline: none;
                ">
                <button id="btn-post-comment-${sceneId}" class="btn" style="
                    flex-shrink: 0;
                    padding: 8px 18px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    border-radius: 6px;
                    letter-spacing: 0.5px;
                ">Post</button>
            </div>
        </div>
    `;

    card.appendChild(commentsDiv);

    const commentsList = document.getElementById(`comments-list-${sceneId}`);
    const nameInput = document.getElementById(`commenter-name-${sceneId}`);
    const textInput = document.getElementById(`comment-text-${sceneId}`);
    const postBtn = document.getElementById(`btn-post-comment-${sceneId}`);

    // Recall saved name
    if (localStorage.getItem('commenter_name')) {
        nameInput.value = localStorage.getItem('commenter_name');
    }

    // Submit comment
    const submitComment = async () => {
        const name = nameInput.value.trim() || "Collaborator";
        const text = textInput.value.trim();
        if (!text) return;

        localStorage.setItem('commenter_name', name);
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
            alert("Could not post comment: " + e.message);
        } finally {
            postBtn.disabled = false;
            postBtn.innerText = "Post";
        }
    };

    postBtn.addEventListener('click', submitComment);
    textInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitComment(); });

    // Real-time comment listener
    const qComments = query(collection(db, "scene_comments", sceneId, "comments"), orderBy("timestamp", "asc"));
    onSnapshot(qComments, (snapshot) => {
        commentsList.innerHTML = "";

        if (snapshot.empty) {
            commentsList.innerHTML = `<div style="font-size: 0.85rem; color: #aaa; font-style: italic;">No feedback yet. Be the first to comment below!</div>`;
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
                background: rgba(255,255,255,0.05);
                border-left: 3px solid var(--primary);
                border-radius: 6px;
                padding: 10px 12px;
            `;

            commentEl.innerHTML = `
                <div style="flex: 1; padding-right: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: #111;">${data.author}</span>
                        <span style="font-size: 0.75rem; color: #888;">${formatTime(data.timestamp)}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #222; line-height: 1.5; word-break: break-word;">${data.text}</div>
                </div>
                <button id="delete-${sceneId}-${commentId}" title="Delete" style="
                    background: transparent;
                    color: rgba(0,0,0,0.35);
                    border: none;
                    font-size: 1rem;
                    cursor: pointer;
                    padding: 0 4px;
                    line-height: 1;
                    transition: color 0.2s;
                    flex-shrink: 0;
                ">✕</button>
            `;

            commentsList.appendChild(commentEl);

            const deleteBtn = document.getElementById(`delete-${sceneId}-${commentId}`);
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#c0392b');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = 'rgba(0,0,0,0.35)');
            deleteBtn.addEventListener('click', async () => {
                if (confirm("Delete this comment?")) {
                    await deleteDoc(doc(db, "scene_comments", sceneId, "comments", commentId));
                }
            });
        });

        commentsList.scrollTop = commentsList.scrollHeight;
    });
});
