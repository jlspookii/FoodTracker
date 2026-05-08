const video = document.getElementById('viewfinder');
const canvas = document.getElementById('canvas');
const camBtn = document.getElementById('cam-toggle');
let db = JSON.parse(localStorage.getItem('omniLedgerV4')) || [];
let stream = null;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        camBtn.innerText = "CAMERA: ON";
        camBtn.classList.remove('off');
    } catch (err) {
        camBtn.innerText = "CAMERA: ERROR";
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        camBtn.innerText = "CAMERA: OFF";
        camBtn.classList.add('off');
        stream = null;
    }
}

function toggleCamera() { stream ? stopCamera() : startCamera(); }

function snap() {
    if (!stream) return alert("Turn camera ON first");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    const dim = Math.min(video.videoWidth, video.videoHeight);
    ctx.drawImage(video, (video.videoWidth-dim)/2, (video.videoHeight-dim)/2, dim, dim, 0, 0, 300, 300);
    
    db.unshift({
        id: Date.now(),
        photo: canvas.toDataURL('image/jpeg', 0.6),
        loc: 'Fridge',
        qty: 1,
        purchaseDate: new Date().toLocaleDateString('en-HK'),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });
    save();
}

function save() {
    localStorage.setItem('omniLedgerV4', JSON.stringify(db));
    render();
}

function render() {
    const containers = { 'Fridge': document.getElementById('list-Fridge'), 'Living': document.getElementById('list-Living') };
    Object.values(containers).forEach(c => c.innerHTML = '');

    db.forEach(item => {
        const diff = item.expiresAt - Date.now();
        const isUrgent = diff < (2 * 24 * 60 * 60 * 1000);
        
        const html = `
            <div class="ledger-item-container">
                <div class="delete-bg">REMOVE</div>
                <div class="ledger-item ${isUrgent ? 'urgent' : ''}" id="item-${item.id}"
                     ontouchstart="ts(event)" ontouchmove="tm(event, ${item.id})" ontouchend="te(event, ${item.id})">
                    <img src="${item.photo}" class="ledger-photo">
                    <div class="ledger-info">
                        <div class="tag-row">
                            <div class="tag ${item.loc === 'Fridge' ? 'active' : ''}" onclick="toggleLoc(${item.id}, 'Fridge')">FRIDGE</div>
                            <div class="tag ${item.loc === 'Living' ? 'active' : ''}" onclick="toggleLoc(${item.id}, 'Living')">LIVING</div>
                        </div>
                        <span class="meta-text">Bought: ${item.purchaseDate}</span>
                        <div class="qty-row">
                            <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
                            <span class="qty-val">${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                        </div>
                        <div class="countdown-timer" id="timer-${item.id}">...</div>
                        <div class="exp-row">
                            <button class="exp-btn" onclick="setExpiry(${item.id}, 3)">3D</button>
                            <button class="exp-btn" onclick="setExpiry(${item.id}, 7)">7D</button>
                            <button class="exp-btn" onclick="setExpiry(${item.id}, 14)">14D</button>
                        </div>
                    </div>
                </div>
            </div>`;
        containers[item.loc].insertAdjacentHTML('beforeend', html);
    });
}

// Logic functions
function changeQty(id, d) { const i = db.find(x => x.id === id); i.qty = Math.max(1, i.qty + d); save(); }
function toggleLoc(id, l) { db.find(x => x.id === id).loc = l; save(); }
function setExpiry(id, days) { db.find(i => i.id === id).expiresAt = Date.now() + (days * 86400000); save(); }

// Swipe Interaction
let sx = 0, cx = 0;
function ts(e) { sx = e.touches[0].clientX; }
function tm(e, id) { 
    cx = e.touches[0].clientX - sx; 
    const el = document.getElementById(`item-${id}`);
    if (cx < 0 && el) el.style.transform = `translateX(${cx}px)`; 
}
function te(e, id) {
    const el = document.getElementById(`item-${id}`);
    if (cx < -140) { 
        if(el) el.style.transform = `translateX(-100%)`; 
        setTimeout(() => { db = db.filter(x => x.id !== id); save(); }, 200); 
    }
    else { if(el) el.style.transform = `translateX(0)`; }
    cx = 0;
}

// Global Init
startCamera();
render();
setInterval(() => {
    db.forEach(item => {
        const el = document.getElementById(`timer-${item.id}`);
        if (!el) return;
        const diff = item.expiresAt - Date.now();
        if (diff <= 0) return el.innerText = "EXPIRED";
        const d = Math.floor(diff/86400000), h = Math.floor((diff/3600000)%24), m = Math.floor((diff/60000)%60), s = Math.floor((diff/1000)%60);
        el.innerText = `${d}d ${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    });
}, 1000);

function exportCSV() {
    let csv = "Date,Location,Qty,DaysLeft\n";
    db.forEach(i => csv += `${i.purchaseDate},${i.loc},${i.qty},${Math.ceil((i.expiresAt-Date.now())/86400000)}\n`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `Pantry_Export.csv`;
    a.click();
}

function clearData() { if(confirm("Wipe all data?")) { db = []; save(); } }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(() => console.log("PWA Active"));
    });
}