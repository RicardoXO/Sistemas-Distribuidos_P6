// frontend/src/services/cryptoEngine.js

const codificadorTexto = new TextEncoder();
const decodificadorTexto = new TextDecoder();

const arrayBufferABase64 = (buffer) => {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binario);
};

const base64AArrayBuffer = (base64) => {
  const stringBinario = window.atob(base64);
  const bytes = new Uint8Array(stringBinario.length);
  for (let i = 0; i < stringBinario.length; i++) {
    bytes[i] = stringBinario.charCodeAt(i);
  }
  return bytes.buffer;
};

const importarPublicaRSA = async (pem) => {
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pem.substring(pem.indexOf(pemHeader) + pemHeader.length, pem.indexOf(pemFooter)).replace(/\s/g, '');
  return await window.crypto.subtle.importKey(
    "spki", base64AArrayBuffer(pemContents),
    { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
  );
};

// --- MOTOR DEL MÉDICO ---
// Fíjate que ahora recibe pemPrivadaECCMedico como parámetro
export const empaquetarRecetaE2EE = async (datosReceta, pemPrivadaECCMedico, pemMedicoRSA, pemPacienteRSA, pemFarmaciaRSA) => {
  
  const eccHeader = "-----BEGIN PRIVATE KEY-----";
  const eccFooter = "-----END PRIVATE KEY-----";
  const eccContents = pemPrivadaECCMedico.substring(pemPrivadaECCMedico.indexOf(eccHeader) + eccHeader.length, pemPrivadaECCMedico.indexOf(eccFooter)).replace(/\s/g, '');
  
  const llaveFirma = await window.crypto.subtle.importKey(
    "pkcs8", base64AArrayBuffer(eccContents),
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
  );

  const recetaBytes = codificadorTexto.encode(JSON.stringify(datosReceta));
  const firmaDigital = await window.crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, llaveFirma, recetaBytes);

  const llaveAES = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, true, ["encrypt", "decrypt"]);
  const nonce = window.crypto.getRandomValues(new Uint8Array(12)); 
  const recetaCifrada = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, llaveAES, recetaBytes);

  const llaveAESExportada = await window.crypto.subtle.exportKey("raw", llaveAES);

  const llavePubMedico = await importarPublicaRSA(pemMedicoRSA);
  const llavePubPaciente = await importarPublicaRSA(pemPacienteRSA);
  const llavePubFarmacia = await importarPublicaRSA(pemFarmaciaRSA);

  const aesMedico = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, llavePubMedico, llaveAESExportada);
  const aesPaciente = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, llavePubPaciente, llaveAESExportada);
  const aesFarmacia = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, llavePubFarmacia, llaveAESExportada);

  return {
    receta_cifrada: arrayBufferABase64(recetaCifrada),
    nonce_aes: arrayBufferABase64(nonce),
    aes_medico: arrayBufferABase64(aesMedico),
    aes_paciente: arrayBufferABase64(aesPaciente),
    aes_farmacia: arrayBufferABase64(aesFarmacia),
    firma_ecdsa: arrayBufferABase64(firmaDigital)
  };
};

// --- MOTOR DEL PACIENTE/FARMACIA ---
// Recibe su propia llave privada descifrada y su rol para saber qué candado abrir
export const desempaquetarRecetaE2EE = async (paqueteCifrado, pemPrivadaRSAUsuario, rol) => {
  const rsaHeader = "-----BEGIN PRIVATE KEY-----";
  const rsaFooter = "-----END PRIVATE KEY-----";
  const rsaContents = pemPrivadaRSAUsuario.substring(pemPrivadaRSAUsuario.indexOf(rsaHeader) + rsaHeader.length, pemPrivadaRSAUsuario.indexOf(rsaFooter)).replace(/\s/g, '');
  
  const llaveDescifradoRSA = await window.crypto.subtle.importKey(
    "pkcs8", base64AArrayBuffer(rsaContents),
    { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]
  );

  let sobreAESEnBase64 = rol === "paciente" ? paqueteCifrado.aes_paciente : 
                         rol === "farmacia" ? paqueteCifrado.aes_farmacia : paqueteCifrado.aes_medico;

  const aesExportadaBytes = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" }, llaveDescifradoRSA, base64AArrayBuffer(sobreAESEnBase64)
  );

  const llaveAES = await window.crypto.subtle.importKey(
    "raw", aesExportadaBytes, { name: "AES-GCM", length: 128 }, false, ["decrypt"]
  );

  const recetaBytes = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64AArrayBuffer(paqueteCifrado.nonce_aes) },
    llaveAES, base64AArrayBuffer(paqueteCifrado.receta_cifrada)
  );

  return JSON.parse(decodificadorTexto.decode(recetaBytes));
};