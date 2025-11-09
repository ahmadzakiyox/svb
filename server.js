const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
// Gunakan port dari hosting (misal: Heroku/Render) atau 3000 jika lokal
const PORT = process.env.PORT || 3000; 

// Middleware
app.use(cors()); // Mengizinkan akses
app.use(express.json());

// Ini adalah baris PENTING:
// Memberitahu server untuk menyajikan SEMUA file dari dalam folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route utama, menyajikan file index.html Anda
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`=======================================`);
  console.log(`  🖥️  SERVER WEB NYALA DI PORT ${PORT}  🖥️  `);
  console.log(`  Siap melayani file pelacak...       `);
  console.log(`=======================================`);
});
