import { useState } from 'react';
import api from './services/api';
import Registro from './pages/Registro';
import Medico from './pages/Medico';
import Paciente from './pages/Paciente';
import Farmacia from './pages/Farmacia';
import Admin from './pages/Admin';
import { desencriptarLlaveDeFirebase } from './services/cryptoVault';

export default function App() {
  const [token, setToken] = useState(null);
  const [rol, setRol] = useState(null);
  const [credenciales, setCredenciales] = useState({ usuario: '', password: '' });
  const [error, setError] = useState(null);
  
  const [estadoLogin, setEstadoLogin] = useState('idle'); // idle | autenticando | descifrando
  
  // 🔥 NUEVO ESTADO: Aquí vivirá la llave descifrada mientras el usuario use la app
  const [llavePrivadaEnMemoria, setLlavePrivadaEnMemoria] = useState(null);
  
  // Estado solo para el diseño visual del selector
  const [rolSeleccionado, setRolSeleccionado] = useState('medico');

  // Estado para alternar entre Login y Registro
  const [mostrandoRegistro, setMostrandoRegistro] = useState(false);
  
  // Truco UX: Autocompletar credenciales al cambiar de rol visualmente
  const cambiarRol = (rolVisual) => {
    setRolSeleccionado(rolVisual);
    if (rolVisual === 'medico') setCredenciales({ usuario: 'Dr.House', password: '12345' });
    if (rolVisual === 'paciente') setCredenciales({ usuario: 'Juan', password: '12345' });
    if (rolVisual === 'farmacia') setCredenciales({ usuario: 'farma_centro', password: '12345' });
    setError(null);
  };

  // 1. Petición de Login a FastAPI + Descifrado de Bóveda en RAM
  const iniciarSesion = async (e) => {
    e.preventDefault();
    setError(null);
    setEstadoLogin('autenticando');

    try {
      // 1. Validar usuario en el backend
      const respuesta = await api.post('/api/login', credenciales);
      const data = respuesta.data;

      // 2. Si el backend nos mandó una bóveda cifrada, la abrimos localmente en la RAM
      if (data.rol !== 'admin' && data.boveda && data.boveda.llave_privada_encriptada) {
        setEstadoLogin('descifrando');
        
        try {
          // Usamos la contraseña para descifrar el paquete AES-GCM
          const pemDescifrado = await desencriptarLlaveDeFirebase(
            data.boveda, 
            credenciales.password
          );

          // 3. Guardamos la llave directamente en la RAM (No toca el disco duro)
          if (data.rol === 'medico') {
            // El médico empacó dos llaves en un JSON (ECC y RSA), extraemos la ECC para que firme
            const llavesMedico = JSON.parse(pemDescifrado);
            setLlavePrivadaEnMemoria(llavesMedico.ecc);
          } else {
            // Paciente y farmacia usan RSA
            setLlavePrivadaEnMemoria(pemDescifrado);
          }

        } catch (cryptoErr) {
          console.error("Error criptográfico:", cryptoErr);
          throw new Error("Credenciales correctas, pero contraseña inválida para abrir la Bóveda Local.");
        }
      }

      // Si todo sale bien, damos acceso
      setToken(data.access_token);
      setRol(data.rol);
      setEstadoLogin('idle');

    } catch (err) {
      setEstadoLogin('idle');
      setLlavePrivadaEnMemoria(null);
      setError(err.message || err.response?.data?.detail || "Error de conexión con el servidor.");
    }
  };

  const cerrarSesion = () => {
    setToken(null);
    setRol(null);
    setCredenciales({ usuario: '', password: '' });
    // 🔥 CRÍTICO: Destruimos la llave de la memoria RAM al salir
    setLlavePrivadaEnMemoria(null); 
  };

  // --- VISTA 1: LOGIN PREMIUM O REGISTRO (Si no hay token) ---
  if (!token) {
    return (
      <div className="login-container">
        
        {/* Lado Izquierdo - Branding */}
        <div className="login-left">
          <div style={{ zIndex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏥</div>
            <h1 style={{ fontSize: '42px', margin: '0 0 15px 0', letterSpacing: '-1px' }}>
              Secure E-Prescriptions
            </h1>
            <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '400px', margin: '0 auto 40px auto', lineHeight: '1.6' }}>
              Sistema de recetas médicas con cifrado (AES-GCM) e infraestructura de llaves públicas (ECDSA/RSA).
            </p>
            
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '20px', fontSize: '14px' }}>🔒 E2EE</span>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '20px', fontSize: '14px' }}>🛡️ Zero-Knowledge</span>
            </div>
          </div>
        </div>

        {/* Lado Derecho - Glassmorphism Dinámico */}
        <div className="login-right">
          {mostrandoRegistro ? (
            <Registro volverAlLogin={() => setMostrandoRegistro(false)} />
          ) : (
            <div className="glass-card">
              <div style={{ textAlign: 'center' }}>
                <div className="tls-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Conexión Segura
                </div>
                <h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>Log in</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 30px 0' }}>Selecciona tu perfil de acceso para continuar.</p>
              </div>

              {/* Selector de Rol Interactivo */}
              <div className="role-selector">
                <div className={`role-card ${rolSeleccionado === 'medico' ? 'active' : ''}`} onClick={() => cambiarRol('medico')}>
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>👨‍⚕️</div>
                  <div style={{ fontSize: '13px' }}>Médico</div>
                </div>
                <div className={`role-card ${rolSeleccionado === 'paciente' ? 'active' : ''}`} onClick={() => cambiarRol('paciente')}>
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>👤</div>
                  <div style={{ fontSize: '13px' }}>Paciente</div>
                </div>
                <div className={`role-card ${rolSeleccionado === 'farmacia' ? 'active' : ''}`} onClick={() => cambiarRol('farmacia')}>
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>🏪</div>
                  <div style={{ fontSize: '13px' }}>Farmacia</div>
                </div>
              </div>

              <form onSubmit={iniciarSesion}>
                <div className="input-group">
                  <label>Nombre de Usuario</label>
                  <input 
                    type="text" 
                    required 
                    className="premium-input"
                    value={credenciales.usuario}
                    onChange={(e) => setCredenciales({...credenciales, usuario: e.target.value})}
                  />
                </div>
                
                <div className="input-group">
                  <label>Contraseña Maestra</label>
                  <input 
                    type="password" 
                    required 
                    className="premium-input"
                    value={credenciales.password}
                    onChange={(e) => setCredenciales({...credenciales, password: e.target.value})}
                  />
                </div>

                {error && (
                  <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center', border: '1px solid #fca5a5' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={estadoLogin !== 'idle'}>
                  {estadoLogin === 'idle' && 'Autenticar e Ingresar'}
                  {estadoLogin === 'autenticando' && '📡 Validando Servidor...'}
                  {estadoLogin === 'descifrando' && '🔓 Descifrando Bóveda Local (PBKDF2)...'}
                </button>
              </form>
              
              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
                ¿Nuevo en el hospital? <a href="#" onClick={(e) => { e.preventDefault(); setMostrandoRegistro(true); }} style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}>Crea tu Identidad Segura</a>
              </p>

            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VISTA 2: PORTAL INTERNO ---
  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100%',
      backgroundImage: rol === 'medico' ? 'url("/fondo-medico.png")' : 'none', 
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundColor: rol === 'medico' ? 'rgba(255, 255, 255, 0.3)' : 'var(--bg-main)',
      backgroundBlendMode: 'overlay',
      transition: 'all 0.5s ease',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(0,0,0,0.1)', paddingBottom: '15px', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>Sistema de Recetas Seguras</h1>
          <button onClick={cerrarSesion} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.1s' }}>
            Cerrar Sesión y Bloquear Bóveda
          </button>
        </div>

        {/* 🔥 PASAMOS LA LLAVE A LAS RUTAS QUE LA NECESITAN */}
        {rol === 'medico' && <Medico token={token} llavePrivadaEnMemoria={llavePrivadaEnMemoria} />}
        {rol === 'paciente' && <Paciente token={token} llavePrivadaEnMemoria={llavePrivadaEnMemoria} rol={rol} />}
        {rol === 'farmacia' && <Farmacia token={token} llavePrivadaEnMemoria={llavePrivadaEnMemoria} rol={rol} />}
        {rol === 'admin' && <Admin token={token} />}
      </div>
    </div>
  );
}