import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration (for database only - no storage)
const firebaseConfig = {
  projectId: "storyboard-client-guide",
  appId: "1:271236677278:web:7d3269b9e0a6dc1ed8058f",
  apiKey: "AIzaSyBObDwfoO9LJCvl8Bx2QSp1lGm9AbHozZ0",
  authDomain: "storyboard-client-guide.firebaseapp.com",
  messagingSenderId: "271236677278"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================
// CLOUDINARY CONFIG
// =============================================
const CLOUDINARY_CLOUD_NAME = "ht";
const CLOUDINARY_UPLOAD_PRESET = "storyboard_abc";

// Upload image to Cloudinary (unsigned - safe for browser)
async function uploadToCloudinary(file, statusEl) {
    statusEl.innerText = "⏳ Uploading...";
    statusEl.style.color = "#c9a054";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: "POST", body: formData }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Upload failed");
        }

        const data = await response.json();
        statusEl.innerText = "✅ Upload complete!";
        statusEl.style.color = "green";
        setTimeout(() => statusEl.innerText = "", 3000);
        return data.secure_url;

    } catch (error) {
        console.error("Cloudinary upload error:", error);
        statusEl.innerText = `❌ Upload error: ${error.message}`;
        statusEl.style.color = "red";
        return null;
    }
}

// =============================================================
// Helper: Inline editable text with auto-save to Firestore
// =============================================================
function setupInlineText(el, collectionName, docId, field) {
    if (!el) return;
    el.contentEditable = "true";
    el.style.outline = "none";
    el.style.borderRadius = "8px";
    el.style.transition = "background 0.2s, box-shadow 0.2s";
    el.title = "✏️ Click to edit";
    el.setAttribute("data-placeholder", "Click to edit...");

    el.addEventListener('focus', () => {
        el.style.background = "#fffde7";
        el.style.boxShadow = "inset 0 0 0 2px #ffb300";
    });
    el.addEventListener('blur', async () => {
        el.style.background = "transparent";
        el.style.boxShadow = "none";
        try {
            await setDoc(doc(db, collectionName, docId), {
                [field]: el.innerHTML,
                timestamp: Date.now()
            }, { merge: true });
        } catch (e) {
            console.warn("Firestore save error:", e.message);
        }
    });
}

// =============================================================
// Helper: Image upload button setup
// =============================================================
function setupImageUpload(btnId, fileInputId, statusId, collectionName, docId, imgContainerId) {
    const btn = document.getElementById(btnId);
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusId);
    const imgContainer = document.getElementById(imgContainerId);
    if (!btn || !fileInput || !statusEl || !imgContainer) return;

    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const url = await uploadToCloudinary(file, statusEl);
        if (url) {
            imgContainer.innerHTML = `<img src="${url}" alt="Uploaded" style="width:100%;height:100%;object-fit:cover;">`;
            try {
                await setDoc(doc(db, collectionName, docId), {
                    imageUrl: url,
                    timestamp: Date.now()
                }, { merge: true });
            } catch (e) {
                console.error("Firestore image save error:", e);
            }
        }
    });
}

// =============================================================
// 1. STATIC SCENES (Scene 1–7)
// =============================================================
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    const infoContainer = card.querySelector('.scene-info');
    const imageContainer = card.querySelector('.scene-image-container');
    imageContainer.id = `img-container-${sceneId}`;

    // Inline editable text
    setupInlineText(infoContainer, "panels", sceneId, "htmlContent");

    // Add image upload button
    const editDiv = document.createElement('div');
    editDiv.className = 'no-print';
    editDiv.style.cssText = 'margin-top:15px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;';
    editDiv.innerHTML = `
        <button class="btn btn-secondary" id="edit-image-${sceneId}" style="font-size:0.8rem;padding:6px 14px;">🖼️ Change Image</button>
        <span id="status-${sceneId}" style="font-size:0.85rem;"></span>
        <input type="file" id="file-${sceneId}" accept="image/*" style="display:none;">
    `;
    card.appendChild(editDiv);

    setupImageUpload(`edit-image-${sceneId}`, `file-${sceneId}`, `status-${sceneId}`, "panels", sceneId, `img-container-${sceneId}`);

    // Realtime listener
    onSnapshot(doc(db, "panels", sceneId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.htmlContent && document.activeElement !== infoContainer) {
                infoContainer.innerHTML = data.htmlContent;
            }
            if (data.imageUrl) {
                imageContainer.innerHTML = `<img src="${data.imageUrl}" alt="Image" style="width:100%;height:100%;object-fit:cover;">`;
            }
        }
    });
});

// =============================================================
// 2. DYNAMIC PANELS
// =============================================================
const dynamicContainer = document.getElementById('dynamic-panels-container');
const btnAddPanel = document.getElementById('btn-add-panel');

btnAddPanel.addEventListener('click', async () => {
    const original = btnAddPanel.innerText;
    btnAddPanel.innerText = "Creating...";
    btnAddPanel.disabled = true;
    try {
        await addDoc(collection(db, "dynamic_panels"), {
            title: "New Panel — Click title to edit",
            htmlContent: "<p><strong>Goal:</strong> Click here and type your description...</p>",
            imageUrl: "",
            createdAt: Date.now()
        });
    } catch (e) {
        alert(`Error: ${e.message}. Make sure Firestore is enabled in Test Mode at console.firebase.google.com`);
    } finally {
        btnAddPanel.innerText = original;
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
            : `<div class="image-placeholder" style="text-align:center;padding:20px;color:#888;"><p>No Image Yet<br><span style="font-size:0.8rem;color:#bbb;">Click 'Change Image' below</span></p></div>`;

        const card = document.createElement('div');
        card.className = "scene-card";
        card.innerHTML = `
            <div class="scene-header">
                <span class="scene-title-text" id="title-${panelId}" style="border-bottom:1px dashed #ccc;min-width:200px;outline:none;">${data.title}</span>
                <span class="scene-timecode">Custom</span>
            </div>
            <div class="grid-2">
                <div class="scene-info" id="info-${panelId}">${data.htmlContent}</div>
                <div class="scene-image-container" id="img-container-${panelId}">${imageHtml}</div>
            </div>
            <div class="no-print" style="margin-top:15px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-secondary" id="edit-img-${panelId}" style="font-size:0.8rem;padding:6px 14px;">🖼️ Change Image</button>
                <span id="status-${panelId}" style="font-size:0.85rem;"></span>
                <input type="file" id="file-${panelId}" accept="image/*" style="display:none;">
            </div>
        `;
        dynamicContainer.appendChild(card);

        setupInlineText(document.getElementById(`title-${panelId}`), "dynamic_panels", panelId, "title");
        setupInlineText(document.getElementById(`info-${panelId}`), "dynamic_panels", panelId, "htmlContent");
        setupImageUpload(`edit-img-${panelId}`, `file-${panelId}`, `status-${panelId}`, "dynamic_panels", panelId, `img-container-${panelId}`);
    });
});
