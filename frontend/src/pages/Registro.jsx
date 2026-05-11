import { useState } from 'react';
import api from '../services/api';

export default function Registro({ volverAlLogin }) {
  const [datos, setDatos] = useState({
    usuario: '', // Cambiado de 'username' a 'usuario' para coincidir con el backend
    password: '',
    nombre: '',
    edad: '',
    rol: 'paciente' 
  });
  
  const [estado, setEstado] = useState('idle'); // idle | generando | enviando | exito | error
  const [mensajeError, setMensajeError] = useState('');

  const manejarRegistro = async (e) => {
    e.preventDefault();
    setEstado('generando');
    setMensajeError('');

    try {
      const exportarAPEM = async (key, tipo) => {
        const exported = await window.crypto.subtle.exportKey(tipo === "privada" ? "pkcs8" : "spki", key);
        const base64 = window.btoa(String.fromCharCode(...new Uint8Array(exported)));
        const tag = tipo === "privada" ? "PRIVATE KEY" : "PUBLIC KEY";
        const lineas = base64.match(/.{1,64}/g).join('\n');
        return `-----BEGIN ${tag}-----\n${lineas}\n-----END ${tag}-----`;
      };

      const descargarArchivo = (contenido, nombre) => {
        const blob = new Blob([contenido], { type: 'text/plain' });
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
      };

      // --- LÓGICA DE GENERACIÓN POR ROL ---
      let publicaRSA, publicaECC = null;

      // Todos los roles necesitan RSA para recibir/leer recetas
      const rsaKey = await window.crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true, ["encrypt", "decrypt"]
      );
      publicaRSA = await exportarAPEM(rsaKey.publicKey, "publica");
      const privadaRSA = await exportarAPEM(rsaKey.privateKey, "privada");
      
      // Descarga obligatoria de la llave de cifrado (RSA)
      descargarArchivo(privadaRSA, `llave_cifrado_${datos.usuario}.pem`);

      // Solo el médico necesita ECC para firmar
      if (datos.rol === 'medico') {
        const eccKey = await window.crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true, ["sign", "verify"]
        );
        publicaECC = await exportarAPEM(eccKey.publicKey, "publica");
        const privadaECC = await exportarAPEM(eccKey.privateKey, "privada");
        
        // Descarga separada para la llave de firma (ECC)
        descargarArchivo(privadaECC, `llave_firma_${datos.usuario}.pem`);
      }

      setEstado('enviando');

      await api.post('/api/registro', {
        usuario: datos.usuario,
        password: datos.password,
        nombre: datos.nombre,
        edad: parseInt(datos.edad),
        rol: datos.rol,
        llave_publica_rsa: publicaRSA,
        llave_publica_ecc: publicaECC // Será null si no es médico
      });

      setEstado('exito');
    } catch (error) {
      console.error(error);
      setMensajeError(error.response?.data?.detail || 'Error en el registro');
      setEstado('error');
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '500px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>Crear Identidad Segura</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Tus llaves privadas se generarán localmente y se descargarán en tu dispositivo.</p>
      </div>

      {estado === 'exito' ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <h3 style={{ color: '#166534', margin: '0 0 10px 0' }}>¡Identidad Creada!</h3>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '20px' }}>
            Tu archivo <b>.pem</b> ha sido descargado. Guárdalo bien, lo necesitarás para operar.
          </p>
          <button 
            onClick={() => volverAlLogin()} 
            className="btn-primary"
            style={{ minHeight: '45px', padding: '0 20px' }}
          >
            Ir a Iniciar Sesión
          </button>
        </div>
      ) : (
        <form onSubmit={manejarRegistro}>
          
          <div className="input-group" style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label>Rol en el Sistema</label>
              <select className="premium-input" value={datos.rol} onChange={(e) => setDatos({...datos, rol: e.target.value})}>
                <option value="paciente">👤 Paciente</option>
                <option value="medico">👨‍⚕️ Médico</option>
                <option value="farmacia">🏪 Farmacia</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Edad</label>
              <input type="number" required className="premium-input" value={datos.edad} onChange={(e) => setDatos({...datos, edad: e.target.value})} />
            </div>
          </div>

          <div className="input-group">
            <label>Nombre Legal Completo</label>
            <input type="text" required className="premium-input" value={datos.nombre} onChange={(e) => setDatos({...datos, nombre: e.target.value})} />
          </div>

          <div className="input-group" style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label>Usuario (ID)</label>
              <input type="text" required className="premium-input" value={datos.usuario} onChange={(e) => setDatos({...datos, usuario: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Contraseña Maestra</label>
              <input type="password" required className="premium-input" value={datos.password} onChange={(e) => setDatos({...datos, password: e.target.value})} />
            </div>
          </div>

          {estado === 'error' && (
            <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center', border: '1px solid #fca5a5' }}>
              {mensajeError}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={estado === 'generando' || estado === 'enviando'}
            style={{ minHeight: '54px', transition: 'all 0.3s' }} 
          >
            {estado === 'idle' || estado === 'error' ? (
              'Generar Llaves y Registrar'
            ) : (
              <div className="loading-container">
                <div className="spinning-pill"></div>
                <span>
                  {estado === 'generando' ? 'Forjando llaves RSA/ECC...' : 'Subiendo llaves públicas...'}
                </span>
              </div>
            )}
          </button>
          
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
            ¿Ya tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); volverAlLogin(); }} style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}>Inicia Sesión</a>
          </p>
        </form>
      )}
    </div>
  );
}