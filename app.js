import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Firebase Configuration
const firebaseConfig = {
  projectId: "storyboard-client-guide",
  appId: "1:271236677278:web:7d3269b9e0a6dc1ed8058f",
  storageBucket: "storyboard-client-guide.firebasestorage.app",
  apiKey: "AIzaSyBObDwfoO9LJCvl8Bx2QSp1lGm9AbHozZ0",
  authDomain: "storyboard-client-guide.firebaseapp.com",
  messagingSenderId: "271236677278"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Helper: Upload image using uploadBytes (simpler, CORS-friendly)
async function uploadImage(path, file, statusEl) {
    statusEl.innerText = "Uploading...";
    statusEl.style.color = "var(--primary, #c9a054)";
    
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        statusEl.innerText = "✅ Upload complete!";
        statusEl.style.color = "green";
        setTimeout(() => statusEl.innerText = "", 3000);
        return downloadURL;
    } catch (error) {
        console.error("Upload failed:", error.code, error.message);
        if (error.code === "storage/unauthorized") {
            statusEl.innerText = "❌ Permission denied. Go to Firebase Console → Storage → Rules and change 'allow read, write: if false' to 'allow read, write: if true'";
        } else if (error.code === "storage/unknown" || error.message.includes("CORS")) {
            statusEl.innerText = "❌ CORS error. See instructions in the app to fix this.";
        } else {
            statusEl.innerText = `❌ Error: ${error.message}`;
        }
        statusEl.style.color = "red";
        return null;
    }
}

// Helper: Setup inline editable text with auto-save
function setupInlineText(el, dbPath, field) {
    el.contentEditable = "true";
    el.style.outline = "none";
    el.style.borderRadius = "8px";
    el.style.transition = "background 0.2s";
    el.title = "Click to edit";
    
    el.addEventListener('focus', () => {
        el.style.background = "#fffde7";
        el.style.boxShadow = "inset 0 0 0 2px #ffb300";
    });
    el.addEventListener('blur', async () => {
        el.style.background = "transparent";
        el.style.boxShadow = "none";
        try {
            await setDoc(doc(db, ...dbPath), { [field]: el.innerHTML, timestamp: Date.now() }, { merge: true });
        } catch (e) {
            console.warn("Save error:", e.message);
        }
    });
}

// Helper: Setup image upload button
function setupImageUpload(btnId, fileInputId, statusId, storagePath, dbPath, imgContainerId) {
    const btn = document.getElementById(btnId);
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusId);
    const imgContainer = document.getElementById(imgContainerId);
    
    if (!btn || !fileInput) return;
    
    btn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const url = await uploadImage(storagePath, file, statusEl);
        if (url) {
            // Update the image container immediately
            imgContainer.innerHTML = `<img src="${url}" alt="Uploaded Image" style="width: 100%; height: 100%; object-fit: cover;">`;
            // Save to Firestore
            try {
                await setDoc(doc(db, ...dbPath), { imageUrl: url, timestamp: Date.now() }, { merge: true });
            } catch (e) {
                console.error("Firestore save error:", e);
            }
        }
    });
}

// =============================================================
// 1. STATIC SCENES (Scene 1 - 7)
// =============================================================
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    const infoContainer = card.querySelector('.scene-info');
    const imageContainer = card.querySelector('.scene-image-container');
    
    // Make image container have a unique ID for updates
    imageContainer.id = `img-container-${sceneId}`;

    // Inline text editing
    setupInlineText(infoContainer, ["panels", sceneId], "htmlContent");

    // Inject image upload button
    const editDiv = document.createElement('div');
    editDiv.className = 'no-print';
    editDiv.style.cssText = 'margin-top: 15px; display: flex; align-items: center; gap: 10px;';
    editDiv.innerHTML = `
        <button class="btn btn-secondary" id="edit-image-${sceneId}" style="font-size: 0.8rem; padding: 6px 14px;">🖼️ Change Image</button>
        <span id="status-${sceneId}" style="font-size: 0.85rem;"></span>
        <input type="file" id="file-${sceneId}" accept="image/*" style="display: none;">
    `;
    card.appendChild(editDiv);

    setupImageUpload(
        `edit-image-${sceneId}`,
        `file-${sceneId}`,
        `status-${sceneId}`,
        `panels/${sceneId}_${Date.now()}.jpg`,
        ["panels", sceneId],
        `img-container-${sceneId}`
    );

    // Realtime updates from Firestore
    onSnapshot(doc(db, "panels", sceneId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.htmlContent && document.activeElement !== infoContainer) {
                infoContainer.innerHTML = data.htmlContent;
            }
            if (data.imageUrl) {
                imageContainer.innerHTML = `<img src="${data.imageUrl}" alt="Saved Image" style="width:100%;height:100%;object-fit:cover;">`;
            }
        }
    });
});

// =============================================================
// 2. DYNAMIC PANELS (Add New Panel)
// =============================================================
const dynamicContainer = document.getElementById('dynamic-panels-container');
const btnAddPanel = document.getElementById('btn-add-panel');

btnAddPanel.addEventListener('click', async () => {
    btnAddPanel.innerText = "Creating...";
    btnAddPanel.disabled = true;
    try {
        await addDoc(collection(db, "dynamic_panels"), {
            title: "New Panel — Click to Edit Title",
            htmlContent: "<p><strong>Goal:</strong> Click here and type your description...</p>",
            imageUrl: "",
            createdAt: Date.now()
        });
    } catch (e) {
        alert(`Error creating panel: ${e.message}. Make sure Firestore is enabled in Test Mode.`);
    } finally {
        btnAddPanel.innerText = "+ Add New Panel";
        btnAddPanel.disabled = false;
    }
});

// Render dynamic panels in real-time
const q = query(collection(db, "dynamic_panels"), orderBy("createdAt", "asc"));
onSnapshot(q, (snapshot) => {
    dynamicContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const panelId = docSnap.id;

        const imageHtml = data.imageUrl
            ? `<img src="${data.imageUrl}" alt="Panel Image" style="width:100%;height:100%;object-fit:cover;">`
            : `<div class="image-placeholder" style="text-align:center;padding:20px;color:#888;">
                <p>No Image Yet<br><span style="font-size:0.8rem;color:#999;">Click 'Change Image' below</span></p>
               </div>`;

        const card = document.createElement('div');
        card.className = "scene-card";
        card.innerHTML = `
            <div class="scene-header">
                <span class="scene-title-text" id="title-${panelId}" style="border-bottom: 1px dashed #ccc; min-width: 200px;">${data.title}</span>
                <span class="scene-timecode">Custom</span>
            </div>
            <div class="grid-2">
                <div class="scene-info" id="info-${panelId}">${data.htmlContent}</div>
                <div class="scene-image-container" id="img-container-${panelId}">${imageHtml}</div>
            </div>
            <div class="no-print" style="margin-top:15px; display:flex; align-items:center; gap:10px;">
                <button class="btn btn-secondary" id="edit-img-${panelId}" style="font-size:0.8rem; padding:6px 14px;">🖼️ Change Image</button>
                <span id="status-${panelId}" style="font-size:0.85rem;"></span>
                <input type="file" id="file-${panelId}" accept="image/*" style="display:none;">
            </div>
        `;
        dynamicContainer.appendChild(card);

        // Inline title editing
        setupInlineText(document.getElementById(`title-${panelId}`), ["dynamic_panels", panelId], "title");
        // Inline text editing
        setupInlineText(document.getElementById(`info-${panelId}`), ["dynamic_panels", panelId], "htmlContent");
        // Image upload
        setupImageUpload(
            `edit-img-${panelId}`,
            `file-${panelId}`,
            `status-${panelId}`,
            `dynamic_panels/${panelId}_${Date.now()}.jpg`,
            ["dynamic_panels", panelId],
            `img-container-${panelId}`
        );
    });
});
