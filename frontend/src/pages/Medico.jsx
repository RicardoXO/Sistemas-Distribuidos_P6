import { useState, useEffect } from 'react';
import api from '../services/api';
import { empaquetarRecetaE2EE } from '../services/cryptoEngine';

export default function Medico({ token, llavePrivadaEnMemoria }) {
  const [perfilMedico, setPerfilMedico] = useState(null);
  const [listaPacientes, setListaPacientes] = useState([]);
  const [listaFarmacias, setListaFarmacias] = useState([]); // 🔥 NUEVO ESTADO
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  
  const [datosReceta, setDatosReceta] = useState({
    usuario_paciente: '',
    usuario_farmacia: '', // 🔥 NUEVO CAMPO
    peso: '', altura: '', temperatura: '', spo2: '', alergias: 'Ninguna',
    medicamento: '', dosis: '', observaciones: ''
  });
  
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    const inicializar = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        const [resPerfil, resPacientes, resFarmacias, resHistorial] = await Promise.all([
          api.get('/api/medico/perfil', config),
          api.get('/api/pacientes', config),
          api.get('/api/farmacias', config), // 🔥 DESCARGAMOS FARMACIAS
          api.get('/api/medico/historial', config)
        ]);
        setPerfilMedico(resPerfil.data);
        setListaPacientes(resPacientes.data);
        setListaFarmacias(resFarmacias.data);
        setHistorial(resHistorial.data);
      } catch (error) {
        console.error("Error al inicializar:", error);
      }
    };
    if (token) inicializar();
  }, [token]);

  const manejarCambioPaciente = (e) => {
    const id = e.target.value;
    setDatosReceta({ ...datosReceta, usuario_paciente: id });
    const paciente = listaPacientes.find(p => p.usuario === id);
    setPacienteSeleccionado(paciente);
  };

  const enviarReceta = async (e) => {
    e.preventDefault();
    setResultado(null);
    setCargando(true);

    if (!datosReceta.usuario_paciente || !pacienteSeleccionado) {
      alert("Por favor selecciona un paciente.");
      setCargando(false); return;
    }
    
    if (!datosReceta.usuario_farmacia) {
      alert("Por favor selecciona una farmacia destino.");
      setCargando(false); return;
    }

    if (!llavePrivadaEnMemoria) {
      alert("Error de seguridad: La bóveda criptográfica no está activa en memoria.");
      setCargando(false); return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // 🔥 OBTENEMOS LA LLAVE REAL DE LA FARMACIA SELECCIONADA
      const farmaciaDestino = listaFarmacias.find(f => f.usuario === datosReceta.usuario_farmacia);
      const pemFarmaciaRSA = farmaciaDestino.llave_publica_rsa; 

      // 1. Empaquetar y cifrar usando el Motor E2EE
      const paqueteCifrado = await empaquetarRecetaE2EE(
        datosReceta, 
        llavePrivadaEnMemoria, 
        perfilMedico.llave_publica_rsa, 
        pacienteSeleccionado.llave_publica_rsa, 
        pemFarmaciaRSA // Candado real de la farmacia
      );

      paqueteCifrado.usuario_paciente = pacienteSeleccionado.usuario;

      // 2. Enviar al backend ciego
      const respuesta = await api.post('/medico/emitir', paqueteCifrado, config);
      
      setResultado({ exito: true, data: respuesta.data });
      setDatosReceta({ usuario_paciente: '', usuario_farmacia: '', peso: '', altura: '', temperatura: '', spo2: '', alergias: 'Ninguna', medicamento: '', dosis: '', observaciones: '' });
      setPacienteSeleccionado(null);

      // Refrescar historial
      const resHistorial = await api.get('/api/medico/historial', config);
      setHistorial(resHistorial.data);

    } catch (error) {
      let mensajeError = "Error al emitir el documento seguro.";
      if (error.response?.data?.detail) {
        mensajeError = Array.isArray(error.response.data.detail) 
          ? "Validación falló en: " + error.response.data.detail.map(err => err.loc[err.loc.length - 1]).join(', ')
          : error.response.data.detail;
      }
      setResultado({ exito: false, mensaje: mensajeError });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="medico-bg-container">
      <div style={{ maxWidth: '850px', width: '100%', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
        
        {/* CABECERA DASHBOARD */}
        {perfilMedico && (
          <div className="panel-glow glow-blue" style={{ padding: '30px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '15px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
              <svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
            </div>
            <div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>Dr. {perfilMedico.nombre}</h2>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: '#475569' }}>
                <span><strong style={{color: '#1e293b'}}>ID:</strong> {perfilMedico.rol.toUpperCase()}</span><span>•</span>
                <span style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg className="icon-svg" style={{width: '16px', height: '16px'}} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Cédula Verificada
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="panel-glow" style={{ padding: '35px' }}>
          <h3 style={{ margin: '0 0 25px 0', color: '#0f172a', fontSize: '20px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg className="icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Nueva Prescripción Electrónica
          </h3>

          <form onSubmit={enviarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SELECTORES DE PACIENTE Y FARMACIA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="panel-glow glow-green" style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: '10px' }}>
                  <svg className="icon-svg" style={{width: '16px', height: '16px'}} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Paciente Destino
                </label>
                <select required className="dark-input" value={datosReceta.usuario_paciente} onChange={manejarCambioPaciente}>
                  <option value="">-- Buscar paciente --</option>
                  {listaPacientes.map(p => <option key={p.usuario} value={p.usuario}>{p.nombre} (ID: {p.usuario})</option>)}
                </select>
              </div>

              <div className="panel-glow glow-blue" style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: '10px' }}>
                  <svg className="icon-svg" style={{width: '16px', height: '16px'}} viewBox="0 0 24 24"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 0V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4M12 12v4M10 14h4"/></svg>
                  Farmacia Autorizada
                </label>
                <select required className="dark-input" value={datosReceta.usuario_farmacia} onChange={(e) => setDatosReceta({...datosReceta, usuario_farmacia: e.target.value})}>
                  <option value="">-- Seleccionar sucursal --</option>
                  {listaFarmacias.map(f => <option key={f.usuario} value={f.usuario}>{f.nombre} (Sucursal: {f.usuario})</option>)}
                </select>
              </div>
            </div>

            {/* SIGNOS VITALES */}
            <div className="panel-glow glow-orange" style={{ padding: '20px', background: 'rgba(249, 115, 22, 0.05)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#c2410c', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>
                <svg className="icon-svg" style={{width: '18px', height: '18px'}} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Signos Vitales y Alergias
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div><label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Peso (kg)</label><input type="text" required placeholder="Ej. 75" className="dark-input" style={{marginTop: '5px'}} value={datosReceta.peso} onChange={(e) => setDatosReceta({...datosReceta, peso: e.target.value})}/></div>
                <div><label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Altura (cm)</label><input type="text" required placeholder="Ej. 170" className="dark-input" style={{marginTop: '5px'}} value={datosReceta.altura} onChange={(e) => setDatosReceta({...datosReceta, altura: e.target.value})}/></div>
                <div><label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Temp (°C)</label><input type="text" required placeholder="Ej. 36.5" className="dark-input" style={{marginTop: '5px'}} value={datosReceta.temperatura} onChange={(e) => setDatosReceta({...datosReceta, temperatura: e.target.value})}/></div>
                <div><label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>SpO2 (%)</label><input type="text" required placeholder="Ej. 98" className="dark-input" style={{marginTop: '5px'}} value={datosReceta.spo2} onChange={(e) => setDatosReceta({...datosReceta, spo2: e.target.value})}/></div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Alergias Conocidas</label>
                <input type="text" required placeholder="Ej. Penicilina" className="dark-input" style={{marginTop: '5px'}} value={datosReceta.alergias} onChange={(e) => setDatosReceta({...datosReceta, alergias: e.target.value})}/>
              </div>
            </div>

            {/* MEDICAMENTO */}
            <div className="panel-glow glow-blue" style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <svg className="icon-svg" style={{width: '18px', height: '18px'}} viewBox="0 0 24 24"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>Medicamento</label>
                  <input type="text" required className="dark-input" placeholder="Ej. Paracetamol 500mg" value={datosReceta.medicamento} onChange={(e) => setDatosReceta({...datosReceta, medicamento: e.target.value})}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <svg className="icon-svg" style={{width: '18px', height: '18px'}} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Dosis</label>
                  <input type="text" required className="dark-input" placeholder="Ej. 1 tableta c/8 hrs" value={datosReceta.dosis} onChange={(e) => setDatosReceta({...datosReceta, dosis: e.target.value})}/>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>Indicaciones Especiales</label>
                <textarea rows="3" className="dark-input" placeholder="Instrucciones adicionales para el paciente..." value={datosReceta.observaciones} onChange={(e) => setDatosReceta({...datosReceta, observaciones: e.target.value})} style={{ resize: 'vertical' }}/>
              </div>
            </div>

            {/* BÓVEDA CRIPTOGRÁFICA EN MEMORIA */}
            <div className={`panel-glow ${llavePrivadaEnMemoria ? 'glow-teal' : 'glow-orange'}`} style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{ color: llavePrivadaEnMemoria ? '#0f766e' : '#c2410c' }}>
                {llavePrivadaEnMemoria ? (
                  <svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ) : (
                  <svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 5px 0', color: llavePrivadaEnMemoria ? '#0f766e' : '#c2410c', fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px' }}>
                  {llavePrivadaEnMemoria ? 'Hardware E2EE Activo' : 'Bóveda Desconectada'}
                </h4>
                <p style={{ margin: '0 0 10px 0', color: '#475569', fontSize: '14px' }}>
                  {llavePrivadaEnMemoria 
                    ? 'Tu llave ECDSA está montada de forma segura en la memoria de este dispositivo. Todo el tráfico será firmado y cifrado localmente.'
                    : 'Error Crítico: No se pudo cargar tu llave privada desde el inicio de sesión. Por favor recarga la página.'}
                </p>
              </div>
            </div>

            <button type="submit" className="btn-competencia" disabled={cargando} style={{ padding: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', opacity: cargando ? 0.7 : 1 }}>
              <svg className="icon-svg" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              {cargando ? 'Procesando Criptografía AES-GCM...' : 'Generar, Firmar y Emitir Prescripción'}
            </button>
          </form>
        </div>

        {/* RESULTADO SUCCESS */}
        {resultado?.exito && (
          <div className="panel-glow glow-teal" style={{ marginTop: '30px', padding: '30px', textAlign: 'center', animation: 'fadeIn 0.5s ease', background: 'rgba(20, 184, 166, 0.15)' }}>
            <svg className="icon-svg" style={{width: '48px', height: '48px', color: '#0f766e', margin: '0 auto 10px auto'}} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '22px', color: '#0f172a' }}>Prescripción Cifrada Exitosamente</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#475569' }}>Token de acceso E2EE para el paciente:</p>
            <div style={{ background: '#ffffff', display: 'inline-block', padding: '15px 40px', borderRadius: '8px', border: '1px solid #14b8a6', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '42px', fontFamily: 'monospace', fontWeight: '900', color: '#0f766e', letterSpacing: '8px' }}>{resultado.data.id_receta}</span>
            </div>
          </div>
        )}

        {/* RESULTADO ERROR */}
        {resultado && !resultado.exito && (
          <div className="panel-glow glow-red" style={{ marginTop: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', color: '#991b1b', background: 'rgba(239, 68, 68, 0.15)' }}>
            <svg className="icon-svg" style={{width: '28px', height: '28px'}} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span style={{ fontWeight: '700', fontSize: '16px' }}>{resultado.mensaje}</span>
          </div>
        )}

        {/* HISTORIAL CLÍNICO */}
        <div className="panel-glow glow-blue" style={{ marginTop: '40px', padding: '35px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg className="icon-svg" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Registro de Folios Emitidos (Metadata)
          </h3>
          {historial.length === 0 ? (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>No existen registros criptográficos asociados a esta cuenta.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                    <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Folio E2EE</th>
                    <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha y Hora</th>
                    <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Paciente Destino (ID)</th>
                    <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id_receta} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px', fontFamily: 'monospace', fontWeight: '800', color: '#2563eb', fontSize: '16px' }}>{item.id_receta}</td>
                      <td style={{ padding: '15px', color: '#475569', fontSize: '14px', fontWeight: '600' }}>{item.fecha_emision || 'N/A'}</td>
                      <td style={{ padding: '15px', color: '#475569', fontSize: '14px' }}>{item.paciente_id}</td>
                      <td style={{ padding: '15px' }}>
                        <span style={{ 
                          border: `1px solid ${item.estado === 'SURTIDA' ? '#10b981' : '#f59e0b'}`, 
                          color: item.estado === 'SURTIDA' ? '#059669' : '#d97706', 
                          background: item.estado === 'SURTIDA' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' 
                        }}>
                          {item.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}