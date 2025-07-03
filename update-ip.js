/**
 * Script pentru actualizarea automată a adresei IP în configurația CORS din server.js
 */
const fs = require('fs');
const { networkInterfaces } = require('os');
const path = require('path');

// Funcție pentru obținerea adresei IP locale
function getLocalIPv4Address() {
  const interfaces = networkInterfaces();
  for (const interfaceName of Object.keys(interfaces)) {
    // Ignorăm interfețele de loopback și cele care nu sunt IPv4
    const addresses = interfaces[interfaceName].filter(
      (iface) => !iface.internal && iface.family === 'IPv4'
    );
    
    if (addresses.length > 0) {
      return addresses[0].address;
    }
  }
  
  console.error('Nu s-a putut găsi o adresă IP validă.');
  return null;
}

// Funcție pentru actualizarea IP-ului în server.js
function updateServerCorsOrigins(filePath, newIP) {
  try {
    // Citim fișierul
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verificăm dacă există deja adresa IP în lista de origini
    const ipPattern = `http://${newIP}:8100`;
    
    if (content.includes(ipPattern)) {
      console.log(`✅ Adresa IP ${newIP} este deja în lista de origini CORS.`);
      return true;
    }
    
    // Găsim arrayurile de origini CORS
    const corsOriginsPattern = /origin: \[([\s\S]*?)\]/g;
    let match;
    let updatedContent = content;
    let updateCount = 0;
    
    while ((match = corsOriginsPattern.exec(content)) !== null) {
      const originsArray = match[1];
      // Verificăm dacă există deja un pattern similar
      if (!originsArray.includes(`http://${newIP}:`)) {
        // Adăugăm noile origini bazate pe IP-ul local
        const newOrigins = originsArray + `\n      "http://${newIP}:8100",\n      "http://${newIP}:8101",\n      "http://${newIP}:4200",`;
        updatedContent = updatedContent.replace(originsArray, newOrigins);
        updateCount++;
      }
    }
    
    // Actualizăm și array-ul de allowedOrigins
    const allowedOriginsPattern = /const allowedOrigins = \[([\s\S]*?)\]/g;
    while ((match = allowedOriginsPattern.exec(content)) !== null) {
      const originsArray = match[1];
      if (!originsArray.includes(`http://${newIP}:`)) {
        const newOrigins = originsArray + `\n    "http://${newIP}:8100",\n    "http://${newIP}:8101",\n    "http://${newIP}:4200",`;
        updatedContent = updatedContent.replace(originsArray, newOrigins);
        updateCount++;
      }
    }
    
    // Dacă am făcut modificări, scriem fișierul
    if (updateCount > 0) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ Adresa IP ${newIP} adăugată în configurațiile CORS din server.js`);
      return true;
    } else {
      console.log(`ℹ️ Nu a fost nevoie de actualizări în server.js`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Eroare la actualizarea configurației CORS:`, error);
    return false;
  }
}

// Funcția principală
function main() {
  // Obținem adresa IP locală
  const localIP = getLocalIPv4Address();
  
  if (!localIP) {
    console.error('❌ Nu s-a putut determina adresa IP locală. Ieșire...');
    process.exit(1);
  }
  
  console.log(`🔍 Adresa IP locală detectată: ${localIP}`);
  
  // Calea către server.js
  const serverJsPath = path.join(__dirname, 'server.js');
  
  // Actualizăm configurația CORS
  if (updateServerCorsOrigins(serverJsPath, localIP)) {
    console.log('✨ Configurația CORS din backend a fost actualizată cu succes!');
  } else {
    console.warn('⚠️ Nu s-a putut actualiza configurația CORS din backend.');
  }
}

// Rulăm funcția principală
main();
