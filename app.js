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

// =============================================
// CLOUDINARY CONFIG
// =============================================
const CLOUDINARY_CLOUD_NAME = "dfcsckzrq";
const CLOUDINARY_UPLOAD_PRESET = "storyboard_abc";

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
        statusEl.innerText = "✅ Done!";
        statusEl.style.color = "green";
        setTimeout(() => statusEl.innerText = "", 3000);
        return data.secure_url;
    } catch (error) {
        statusEl.innerText = `❌ ${error.message}`;
        statusEl.style.color = "red";
        return null;
    }
}

// Make an element inline-editable with auto-save on blur
function setupInlineText(el, collectionName, docId, field) {
    if (!el) return;
    el.contentEditable = "true";
    el.style.outline = "none";
    el.style.borderRadius = "8px";
    el.style.transition = "background 0.2s, box-shadow 0.2s";
    el.title = "✏️ Click to edit";

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
            console.error("Save error:", e.message);
        }
    });
}

// Build image controls (Change Image + Remove Image)
function buildImageControls(containerId, collectionName, docId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'no-print';
    wrapper.style.cssText = 'margin-top:15px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;';

    const fileInputId = `file-${containerId}`;
    wrapper.innerHTML = `
        <button class="btn btn-secondary" id="btn-change-${containerId}" style="font-size:0.8rem;padding:6px 14px;">🖼️ Change Image</button>
        <button class="btn btn-secondary" id="btn-remove-${containerId}" style="font-size:0.8rem;padding:6px 14px;background:#c0392b;border-color:#c0392b;color:#fff;">✕ Remove Image</button>
        <span id="status-${containerId}" style="font-size:0.85rem;"></span>
        <input type="file" id="${fileInputId}" accept="image/*" style="display:none;">
    `;
    return wrapper;
}

// Wire up image controls after inserting into DOM
function setupImageControls(containerId, collectionName, docId) {
    const imgContainer = document.getElementById(containerId);
    const statusEl = document.getElementById(`status-${containerId}`);
    const fileInput = document.getElementById(`file-${containerId}`);

    document.getElementById(`btn-change-${containerId}`).addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = await uploadToCloudinary(file, statusEl);
        if (url) {
            imgContainer.innerHTML = buildImgTag(url);
            await setDoc(doc(db, collectionName, docId), { imageUrl: url, timestamp: Date.now() }, { merge: true });
        }
    });

    document.getElementById(`btn-remove-${containerId}`).addEventListener('click', async () => {
        if (!confirm("Remove this image?")) return;
        imgContainer.innerHTML = emptyImagePlaceholder();
        await setDoc(doc(db, collectionName, docId), { imageUrl: "", timestamp: Date.now() }, { merge: true });
    });
}

function buildImgTag(url) {
    return `<img src="${url}" alt="Panel Image" style="width:100%;height:100%;object-fit:cover;">`;
}

function emptyImagePlaceholder() {
    return `<div class="image-placeholder" style="text-align:center;padding:20px;color:#888;"><p>No Image<br><span style="font-size:0.8rem;color:#bbb;">Click 'Change Image' below</span></p></div>`;
}

// =============================================================
// 1. STATIC SCENES (Scene 1–7)
// =============================================================
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    const infoContainer = card.querySelector('.scene-info');
    const imageContainer = card.querySelector('.scene-image-container');
    imageContainer.id = `img-${sceneId}`;

    // Inline editable text
    setupInlineText(infoContainer, "panels", sceneId, "htmlContent");

    // Image controls
    const controls = buildImageControls(`img-${sceneId}`, "panels", sceneId);
    card.appendChild(controls);
    setupImageControls(`img-${sceneId}`, "panels", sceneId);

    // Load saved data from Firestore (persists on refresh)
    onSnapshot(doc(db, "panels", sceneId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only update text if user is not currently editing
            if (data.htmlContent && document.activeElement !== infoContainer) {
                infoContainer.innerHTML = data.htmlContent;
            }
            if (data.imageUrl) {
                imageContainer.innerHTML = buildImgTag(data.imageUrl);
            } else if (data.imageUrl === "") {
                imageContainer.innerHTML = emptyImagePlaceholder();
            }
        }
    });
});

// =============================================================
// 2. DYNAMIC PANELS — Add New Panel + Delete + Remove Image
// =============================================================
const dynamicContainer = document.getElementById('dynamic-panels-container');
const btnAddPanel = document.getElementById('btn-add-panel');

btnAddPanel.addEventListener('click', async () => {
    const original = btnAddPanel.innerText;
    btnAddPanel.innerText = "Creating...";
    btnAddPanel.disabled = true;
    try {
        await addDoc(collection(db, "dynamic_panels"), {
            title: "New Panel — Click to edit title",
            htmlContent: "<p><strong>Goal:</strong> Click here and type your description...</p>",
            imageUrl: "",
            createdAt: Date.now()
        });
    } catch (e) {
        alert(`Error: ${e.message}`);
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
        const imgContainerId = `img-dyn-${panelId}`;

        const imageHtml = data.imageUrl ? buildImgTag(data.imageUrl) : emptyImagePlaceholder();

        const card = document.createElement('div');
        card.className = "scene-card";
        card.style.position = "relative";
        card.innerHTML = `
            <button id="delete-${panelId}" title="Delete this panel" style="
                position:absolute; top:12px; right:12px;
                background:#c0392b; color:#fff; border:none;
                border-radius:50%; width:28px; height:28px;
                font-size:1rem; cursor:pointer; line-height:1;
                display:flex; align-items:center; justify-content:center;
                z-index:10;">✕</button>
            <div class="scene-header">
                <span id="title-${panelId}" class="scene-title-text">${data.title}</span>
                <span class="scene-timecode">Custom</span>
            </div>
            <div class="grid-2">
                <div class="scene-info" id="info-${panelId}">${data.htmlContent}</div>
                <div class="scene-image-container" id="${imgContainerId}">${imageHtml}</div>
            </div>
        `;
        dynamicContainer.appendChild(card);

        // Append image controls
        const controls = buildImageControls(imgContainerId, "dynamic_panels", panelId);
        card.appendChild(controls);
        setupImageControls(imgContainerId, "dynamic_panels", panelId);

        // Inline editable title & text
        setupInlineText(document.getElementById(`title-${panelId}`), "dynamic_panels", panelId, "title");
        setupInlineText(document.getElementById(`info-${panelId}`), "dynamic_panels", panelId, "htmlContent");

        // Delete panel
        document.getElementById(`delete-${panelId}`).addEventListener('click', async () => {
            if (!confirm("Delete this panel permanently?")) return;
            await deleteDoc(doc(db, "dynamic_panels", panelId));
        });
    });
});
