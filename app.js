import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// -------------------------------------------------------------
// 1. Setup Static Panels (Scenes 1-7) for Inline Editing
// -------------------------------------------------------------
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    const infoContainer = card.querySelector('.scene-info');
    const imageContainer = card.querySelector('.scene-image-container');
    
    // Make text inline editable
    infoContainer.contentEditable = "true";
    infoContainer.style.outline = "none";
    infoContainer.style.padding = "10px";
    infoContainer.style.borderRadius = "8px";
    infoContainer.style.transition = "background 0.2s";
    
    infoContainer.addEventListener('focus', () => {
        infoContainer.style.background = "#fff3e0"; // highlight while editing
    });
    
    infoContainer.addEventListener('blur', async () => {
        infoContainer.style.background = "transparent";
        try {
            await setDoc(doc(db, "panels", sceneId), {
                htmlContent: infoContainer.innerHTML,
                timestamp: Date.now()
            }, { merge: true });
            console.log(`Saved text for ${sceneId}`);
        } catch (e) {
            console.error("Save error:", e);
        }
    });

    // Inject Image Upload Button
    const editDiv = document.createElement('div');
    editDiv.className = 'edit-controls no-print';
    editDiv.style.marginTop = '15px';
    editDiv.innerHTML = `
        <button class="btn btn-secondary btn-sm" id="edit-image-${sceneId}" style="font-size: 0.8rem; padding: 6px 12px;">🖼️ Change Image</button>
        <span id="upload-status-${sceneId}" style="margin-left: 10px; font-size: 0.85rem; color: #666;"></span>
        <input type="file" id="file-${sceneId}" accept="image/*" style="display: none;">
    `;
    card.appendChild(editDiv);
    
    const fileInput = document.getElementById(`file-${sceneId}`);
    const statusText = document.getElementById(`upload-status-${sceneId}`);
    
    document.getElementById(`edit-image-${sceneId}`).addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        statusText.innerText = "Uploading... please wait";
        statusText.style.color = "var(--primary)";
        
        try {
            const storageRef = ref(storage, `panels/${sceneId}_${Date.now()}_${file.name}`);
            const uploadTask = await uploadBytesResumable(storageRef, file);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            
            // Save to Firestore
            await setDoc(doc(db, "panels", sceneId), {
                imageUrl: downloadURL,
                timestamp: Date.now()
            }, { merge: true });
            
            statusText.innerText = "Upload complete!";
            statusText.style.color = "green";
            setTimeout(() => statusText.innerText = "", 3000);
            
        } catch (error) {
            console.error("Upload failed:", error);
            statusText.innerText = `Error: ${error.message}. (Check Firestore Rules or CORS)`;
            statusText.style.color = "red";
        }
    });
    
    // Listen for Realtime Updates from Firestore
    onSnapshot(doc(db, "panels", sceneId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only update text if the user isn't currently focused on it (to prevent overwriting while typing)
            if (data.htmlContent && document.activeElement !== infoContainer) {
                infoContainer.innerHTML = data.htmlContent;
            }
            if (data.imageUrl) {
                imageContainer.innerHTML = `<img src="${data.imageUrl}" alt="Cloud Image" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        }
    });
});

// -------------------------------------------------------------
// 2. Add New Panels Feature
// -------------------------------------------------------------
const dynamicContainer = document.getElementById('dynamic-panels-container');
const btnAddPanel = document.getElementById('btn-add-panel');

btnAddPanel.addEventListener('click', async () => {
    try {
        const defaultHtml = `
            <p><strong>Goal:</strong> Add goal here...</p>
            <ul><li>Detail 1</li><li>Detail 2</li></ul>
        `;
        // Create an empty panel document
        await addDoc(collection(db, "dynamic_panels"), {
            title: "New Custom Panel",
            htmlContent: defaultHtml,
            imageUrl: "",
            createdAt: Date.now()
        });
    } catch (e) {
        console.error("Error creating panel:", e);
        alert("Error creating panel. Check Firebase Database Rules.");
    }
});

// Render dynamic panels
const q = query(collection(db, "dynamic_panels"), orderBy("createdAt", "asc"));
onSnapshot(q, (snapshot) => {
    dynamicContainer.innerHTML = ""; // clear container
    let dynamicIndex = 8; // Scene 8 onwards
    
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const panelId = docSnap.id;
        
        const card = document.createElement('div');
        card.className = "scene-card";
        
        const imageHtml = data.imageUrl 
            ? `<img src="${data.imageUrl}" alt="Dynamic Image" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div class="image-placeholder"><p>No Image Yet<br><span style="font-size: 0.8rem; color: #999;">Upload an image below</span></p></div>`;
            
        card.innerHTML = `
            <div class="scene-header">
                <span class="scene-title-text" contenteditable="true" id="title-${panelId}" style="outline: none; border-bottom: 1px dashed #ccc;">${data.title || "New Custom Panel"}</span>
                <span class="scene-timecode">Custom</span>
            </div>
            <div class="grid-2">
                <div class="scene-info" contenteditable="true" id="info-${panelId}" style="outline: none; padding: 10px; border-radius: 8px;">
                    ${data.htmlContent}
                </div>
                <div class="scene-image-container" id="img-container-${panelId}">
                    ${imageHtml}
                </div>
            </div>
            <div class="edit-controls no-print" style="margin-top: 15px;">
                <button class="btn btn-secondary btn-sm" id="edit-img-${panelId}" style="font-size: 0.8rem; padding: 6px 12px;">🖼️ Change Image</button>
                <span id="status-${panelId}" style="margin-left: 10px; font-size: 0.85rem; color: #666;"></span>
                <input type="file" id="file-${panelId}" accept="image/*" style="display: none;">
            </div>
        `;
        
        dynamicContainer.appendChild(card);
        
        // Auto-save title
        const titleEl = document.getElementById(`title-${panelId}`);
        titleEl.addEventListener('blur', () => {
            setDoc(doc(db, "dynamic_panels", panelId), { title: titleEl.innerText }, { merge: true });
        });
        
        // Auto-save text
        const infoEl = document.getElementById(`info-${panelId}`);
        infoEl.addEventListener('focus', () => infoEl.style.background = "#fff3e0");
        infoEl.addEventListener('blur', () => {
            infoEl.style.background = "transparent";
            setDoc(doc(db, "dynamic_panels", panelId), { htmlContent: infoEl.innerHTML }, { merge: true });
        });
        
        // Image Upload
        const fileInput = document.getElementById(`file-${panelId}`);
        const statusText = document.getElementById(`status-${panelId}`);
        
        document.getElementById(`edit-img-${panelId}`).addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            statusText.innerText = "Uploading...";
            statusText.style.color = "var(--primary)";
            
            try {
                const storageRef = ref(storage, `dynamic_panels/${panelId}_${Date.now()}_${file.name}`);
                const uploadTask = await uploadBytesResumable(storageRef, file);
                const downloadURL = await getDownloadURL(uploadTask.ref);
                
                await setDoc(doc(db, "dynamic_panels", panelId), { imageUrl: downloadURL }, { merge: true });
                statusText.innerText = "Upload complete!";
                statusText.style.color = "green";
                setTimeout(() => statusText.innerText = "", 3000);
            } catch (error) {
                console.error("Upload failed", error);
                statusText.innerText = `Error: ${error.message}`;
                statusText.style.color = "red";
            }
        });
        
        dynamicIndex++;
    });
});
