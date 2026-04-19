import { useState } from 'react';
import api from '../services/api';
import { generarLlavesMedico, generarLlavesRSA, encriptarLlaveParaFirebase } from '../services/cryptoVault';

export default function Registro({ volverAlLogin }) {
  const [datos, setDatos] = useState({
    username: '',
    password: '',
    nombre: '',
    edad: '',
    rol: 'paciente' // Por defecto
  });
  const [estado, setEstado] = useState('idle'); // idle | generando | enviando | exito | error
  const [mensajeError, setMensajeError] = useState('');

  const manejarRegistro = async (e) => {
    e.preventDefault();
    setEstado('generando');
    setMensajeError('');

    try {
      let llavePublicaEcc = null;
      let llavePublicaRsa = null;
      let privadasParaCifrar = ""; 

      // 1. Generación de llaves (WebCrypto API)
      if (datos.rol === 'medico') {
        const resEcc = await generarLlavesMedico();
        const resRsa = await generarLlavesRSA();
        
        llavePublicaEcc = resEcc.pemPublica;
        llavePublicaRsa = resRsa.pemPublica;
        
        // Empacamos ambas privadas en un JSON para cifrarlas juntas
        privadasParaCifrar = JSON.stringify({
          ecc: resEcc.pemPrivada,
          rsa: resRsa.pemPrivada
        });
        
      } else {
        const resRsa = await generarLlavesRSA();
        llavePublicaRsa = resRsa.pemPublica;
        privadasParaCifrar = resRsa.pemPrivada;
      }

      // 2. Cifrado de la Bóveda (Keystore) usando la contraseña del usuario
      const boveda = await encriptarLlaveParaFirebase(privadasParaCifrar, datos.password);

      setEstado('enviando');

      // 3. Envío del payload extendido al Backend
      const payload = {
        usuario: datos.username,
        password: datos.password,
        nombre: datos.nombre,
        edad: parseInt(datos.edad),
        rol: datos.rol,
        llave_publica_ecc: llavePublicaEcc,
        llave_publica_rsa: llavePublicaRsa,
        // Nuevos campos para la portabilidad de identidad en la nube
        llave_privada_encriptada: boveda.llave_privada_encriptada,
        salt: boveda.salt,
        iv: boveda.iv
      };

      await api.post('/api/registro', payload);
      
      setEstado('exito');
      setTimeout(() => volverAlLogin(), 3000); 

    } catch (error) {
      console.error(error);
      setEstado('error');
      setMensajeError(error.response?.data?.detail || "Hubo un problema al crear la cuenta segura.");
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '500px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>Crear Identidad Segura</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Tus llaves privadas se cifrarán con tu contraseña antes de subir a la nube.</p>
      </div>

      {estado === 'exito' ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <h3 style={{ color: '#166534', margin: '0 0 10px 0' }}>¡Bóveda Sincronizada!</h3>
          <p style={{ color: '#475569', fontSize: '14px' }}>Tu identidad digital ha sido cifrada y respaldada con éxito. Redirigiendo al login...</p>
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
              <input type="text" required className="premium-input" value={datos.username} onChange={(e) => setDatos({...datos, username: e.target.value})} />
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
              'Generar Bóveda y Registrar'
            ) : (
              <div className="loading-container">
                <div className="spinning-pill"></div>
                <span>
                  {estado === 'generando' ? 'Forjando llaves RSA/ECC...' : 'Cifrando y Sincronizando...'}
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