// --- UTILIDADES ---
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

const convertirAPem = (b64Key, tipo) => {
  const lineas = b64Key.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${tipo}-----\n${lineas}\n-----END ${tipo}-----`;
};

// --- EL NÚCLEO DE SEGURIDAD (PBKDF2) ---
// Convierte la contraseña del usuario ("123") en una llave AES-GCM fuerte
const derivarLlaveDePassword = async (password, saltBuffer) => {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", codificadorTexto.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
};

// --- ENVOLTURA (Durante el Registro) ---
export const encriptarLlaveParaFirebase = async (pemPrivada, passwordUsuario) => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16)); // Sal única
  const iv = window.crypto.getRandomValues(new Uint8Array(12));   // Vector inicial
  
  const llaveDerivada = await derivarLlaveDePassword(passwordUsuario, salt);
  const llavePrivadaBytes = codificadorTexto.encode(pemPrivada);
  
  const privadaEncriptada = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, llaveDerivada, llavePrivadaBytes
  );

  return {
    llave_privada_encriptada: arrayBufferABase64(privadaEncriptada),
    salt: arrayBufferABase64(salt),
    iv: arrayBufferABase64(iv)
  };
};

// --- DESENVOLTURA (Durante el Login) ---
export const desencriptarLlaveDeFirebase = async (datosFirebase, passwordUsuario) => {
  try {
    const saltBuffer = base64AArrayBuffer(datosFirebase.salt);
    const ivBuffer = base64AArrayBuffer(datosFirebase.iv);
    const llaveEncriptadaBuffer = base64AArrayBuffer(datosFirebase.llave_privada_encriptada);

    const llaveDerivada = await derivarLlaveDePassword(passwordUsuario, saltBuffer);
    
    const privadaDesencriptadaBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer }, llaveDerivada, llaveEncriptadaBuffer
    );

    return decodificadorTexto.decode(privadaDesencriptadaBytes); // Retorna el PEM original
  } catch (error) {
    throw new Error("Contraseña incorrecta. No se pudo destrabar la bóveda criptográfica.");
  }
};

// --- LA FÁBRICA DE LLAVES (Igual que antes, pero sin IndexedDB) ---

export const generarLlavesMedico = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );
  const exportedPrivate = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  
  return {
    pemPrivada: convertirAPem(arrayBufferABase64(exportedPrivate), "PRIVATE KEY"),
    pemPublica: convertirAPem(arrayBufferABase64(exportedPublic), "PUBLIC KEY")
  };
};

export const generarLlavesRSA = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"] 
  );
  const exportedPrivate = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  
  return {
    pemPrivada: convertirAPem(arrayBufferABase64(exportedPrivate), "PRIVATE KEY"),
    pemPublica: convertirAPem(arrayBufferABase64(exportedPublic), "PUBLIC KEY")
  };
};