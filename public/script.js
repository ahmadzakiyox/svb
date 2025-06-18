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

  const getPhoto = async () => {
    updateStatus('📷 Meminta izin kamera...');
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

  const getLocation = () => {
    updateStatus('📍 Meminta izin lokasi...');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        }),
        err => reject(new Error('Gagal mengambil lokasi: ' + err.message)),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  try {
    const photo = await getPhoto();
    updateStatus('✅ Foto berhasil diambil');

    const loc = await getLocation();
    updateStatus(`✅ Lokasi: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`);
  } catch (err) {
    updateStatus(`❌ ${err.message}`, true);
  }
});
