const fs = require('fs');
const path = require('path');

// Deterministyczny generator liczb pseudolosowych
let seed = 48549; 
function random() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[randomInt(0, chars.length - 1)];
  }
  return code;
}

const types = ["cpu", "gpu", "ram", "disk"];
const names = {
  cpu: ["Intel Core i5", "AMD Ryzen 5", "Intel Core i7", "AMD Ryzen 7", "Intel Core i9", "AMD Ryzen 9"],
  gpu: ["NVIDIA RTX 4060", "NVIDIA RTX 4070", "AMD RX 7600", "AMD RX 7800 XT", "NVIDIA RTX 4090", "AMD RX 7900 XTX"],
  ram: ["Corsair Vengeance 16GB", "Kingston Fury 32GB", "G.Skill Trident 64GB", "Crucial 8GB", "Patriot 16GB"],
  disk: ["Samsung 980 Pro 1TB", "Crucial MX500 500GB", "WD Black 2TB", "Lexar 1TB", "Seagate 2TB"]
};

let tempProducts = [];
const usedCodes = new Set();

// 1. Generowanie 100 produktów (jeszcze bez ID)
for (let i = 1; i <= 100; i++) {
  const type = types[i % 4]; 
  
  let code;
  do {
    code = generateCode();
  } while (usedCodes.has(code));
  usedCodes.add(code);

  const typeNames = names[type];
  const name = `${typeNames[randomInt(0, typeNames.length - 1)]} ${generateCode().substring(0, 4)}`;
  const amount = i % 12 === 0 ? 0 : randomInt(1, 50); 
  const price = randomInt(5000, 500000); 
  const date = new Date(Date.UTC(2026, randomInt(1, 9), randomInt(1, 28), 10, 0, 0)).toISOString();
  
  tempProducts.push({
    code: code,
    name: name,
    type: type,
    price: price,
    amount: amount,
    description: `Wysokiej klasy sprzęt z kategorii ${type.toUpperCase()}. Idealny wybór do budowy komputera.`,
    date: date,
    image: `/images/products/${type}.webp`
  });
}

// 2. Deterministyczne tasowanie tablicy (wymieszanie kolejności produktów)
for (let i = tempProducts.length - 1; i > 0; i--) {
  const j = randomInt(0, i);
  // Zamiana miejscami
  [tempProducts[i], tempProducts[j]] = [tempProducts[j], tempProducts[i]];
}

// 3. Dodanie unikalnego ID (od 1 do 100) na samej górze każdego obiektu
const products = tempProducts.map((product, index) => ({
  id: index + 1,
  ...product
}));

// 4. Zapis do pliku
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2), 'utf8');

console.log('✅ Sukces! Wygenerowano i potasowano 100 produktów.');