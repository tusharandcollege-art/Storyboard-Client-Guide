import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let currentIdentity = null;

const btnOwner = document.getElementById('btn-identity-owner');
const btnClient = document.getElementById('btn-identity-client');
const identityDisplay = document.getElementById('current-identity-display');

function updateIdentityUI() {
    if (!currentIdentity) {
        identityDisplay.innerText = "Currently Viewing Only (Select an identity to edit)";
        btnOwner.style.background = "#333";
        btnClient.style.background = "#333";
    } else {
        identityDisplay.innerText = `Editing as: ${currentIdentity}`;
        if (currentIdentity === 'Owner') {
            btnOwner.style.background = "var(--primary)";
            btnClient.style.background = "#333";
        } else {
            btnClient.style.background = "var(--primary)";
            btnOwner.style.background = "#333";
        }
    }
    
    // Toggle visibility of edit controls
    document.querySelectorAll('.edit-controls').forEach(el => {
        el.style.display = currentIdentity ? 'block' : 'none';
    });
}

btnOwner.addEventListener('click', () => {
    currentIdentity = 'Owner';
    updateIdentityUI();
});

btnClient.addEventListener('click', () => {
    currentIdentity = 'Client';
    updateIdentityUI();
});

// Setup dynamic edit buttons for all scene cards
document.querySelectorAll('.scene-card').forEach((card, index) => {
    const sceneId = `scene_${index + 1}`;
    
    // Inject Edit Controls
    const editDiv = document.createElement('div');
    editDiv.className = 'edit-controls no-print';
    editDiv.style.marginTop = '20px';
    editDiv.style.padding = '15px';
    editDiv.style.background = '#f0f0f0';
    editDiv.style.borderRadius = '8px';
    editDiv.style.display = 'none'; // hidden by default until identity selected
    editDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 0.9rem; color: #555;" id="badge-${sceneId}"><em>No edits yet</em></div>
        <button class="btn btn-secondary" id="edit-text-${sceneId}">Edit Text</button>
        <button class="btn btn-secondary" id="edit-image-${sceneId}">Change Image</button>
        <input type="file" id="file-${sceneId}" accept="image/*" style="display: none;">
    `;
    card.appendChild(editDiv);
    
    const infoContainer = card.querySelector('.scene-info');
    const imageContainer = card.querySelector('.scene-image-container');
    
    // Edit Text Event
    document.getElementById(`edit-text-${sceneId}`).addEventListener('click', async () => {
        if (!currentIdentity) return alert("Please select an identity at the top first.");
        
        // Simple prompt for now - can be expanded to rich text later
        const currentHtml = infoContainer.innerHTML;
        const newText = prompt("Enter new text (HTML allowed):", currentHtml);
        
        if (newText && newText !== currentHtml) {
            infoContainer.innerHTML = newText;
            
            // Save to Firestore
            try {
                await setDoc(doc(db, "panels", sceneId), {
                    htmlContent: newText,
                    lastEditedBy: currentIdentity,
                    timestamp: Date.now()
                }, { merge: true });
            } catch (e) {
                console.error("Error saving text:", e);
                alert("Failed to save text to database. Make sure Firestore is enabled.");
            }
        }
    });
    
    // Edit Image Event
    const fileInput = document.getElementById(`file-${sceneId}`);
    document.getElementById(`edit-image-${sceneId}`).addEventListener('click', () => {
        if (!currentIdentity) return alert("Please select an identity at the top first.");
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const btn = document.getElementById(`edit-image-${sceneId}`);
        const originalText = btn.innerText;
        btn.innerText = "Uploading...";
        btn.disabled = true;
        
        try {
            const storageRef = ref(storage, `panels/${sceneId}_${file.name}`);
            const uploadTask = await uploadBytesResumable(storageRef, file);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            
            // Update UI immediately
            imageContainer.innerHTML = `<img src="${downloadURL}" alt="Uploaded Image" style="width: 100%; height: 100%; object-fit: cover;">`;
            
            // Save to Firestore
            await setDoc(doc(db, "panels", sceneId), {
                imageUrl: downloadURL,
                lastEditedBy: currentIdentity,
                timestamp: Date.now()
            }, { merge: true });
            
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Make sure Firebase Storage is enabled.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
    
    // Listen for Realtime Updates from Firestore
    onSnapshot(doc(db, "panels", sceneId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            if (data.htmlContent) {
                infoContainer.innerHTML = data.htmlContent;
            }
            if (data.imageUrl) {
                imageContainer.innerHTML = `<img src="${data.imageUrl}" alt="Cloud Image" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            if (data.lastEditedBy) {
                const dateStr = new Date(data.timestamp).toLocaleString();
                const badge = document.getElementById(`badge-${sceneId}`);
                badge.innerHTML = `<strong style="color: ${data.lastEditedBy === 'Owner' ? 'var(--primary)' : '#2e7d32'}">Last edited by: ${data.lastEditedBy}</strong> on ${dateStr}`;
            }
        }
    }, (error) => {
        console.warn("Firestore might not be enabled yet for " + sceneId, error.message);
    });
});
