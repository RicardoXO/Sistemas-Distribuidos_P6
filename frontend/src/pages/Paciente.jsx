import { useState, useEffect } from 'react';
import api from '../services/api';
import { desempaquetarRecetaE2EE } from '../services/cryptoEngine';

export default function Paciente({ token }) {
  const [perfil, setPerfil] = useState(null);
  const [misRecetas, setMisRecetas] = useState([]);
  const [folioABuscar, setFolioABuscar] = useState('');
  const [recetaRevelada, setRecetaRevelada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // --- ESTADO PARA LA LLAVE PEM DE CIFRADO ---
  const [archivoCifrado, setArchivoCifrado] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        // Solo pedimos el historial. Hemos quitado la ruta del perfil que daba 404.
        const resRecetas = await api.get('/api/paciente/historial', config);
        setMisRecetas(resRecetas.data);
        
      } catch (err) {
        console.error("Error al cargar datos del paciente", err);
      }
    };
    if (token) cargarDatos();
  }, [token]);

  const seleccionarRecetaDelHistorial = (id) => {
    setFolioABuscar(id);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const descifrarReceta = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setRecetaRevelada(null);

    // 1. Verificamos que el usuario haya seleccionado su archivo .pem
    if (!archivoCifrado) {
      alert("Error: Por favor, selecciona primero tu archivo .pem de cifrado.");
      return;
    }

    if (!folioABuscar) {
      alert("Error: Por favor ingresa o selecciona un folio.");
      return;
    }

    setCargando(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // 2. Obtener el paquete cifrado del servidor
      // Nota: Tu versión usaba '/paciente/descifrar' con POST, lo he ajustado a eso.
      const respuesta = await api.post('/paciente/descifrar', { id_receta: folioABuscar }, config);
      const paqueteCifrado = respuesta.data;

      // 3. Extraer el texto puro del .pem (On-Demand)
      const textoPEM = await archivoCifrado.text();

      // 4. Llamar al motor E2EE EXACTAMENTE como lo definiste
      const recetaAbierta = await desempaquetarRecetaE2EE(
        paqueteCifrado,
        textoPEM, 
        "paciente" // Pasamos explícitamente el rol para que abra el candado correcto
      );

      setRecetaRevelada({
        ...recetaAbierta,
        id_receta: folioABuscar,
        fecha_emision: paqueteCifrado.fecha_emision,
        estado: paqueteCifrado.estado
      });

    } catch (err) {
      console.error(err);
      setError(err.message || err.response?.data?.detail || "Fallo en el descifrado: La llave no corresponde a este folio o el archivo es inválido.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="paciente-bg-container">
      <div style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '20px', animation: 'fadeIn 0.5s ease' }}>
        
        {/* CABECERA DASHBOARD */}
        <div className="panel-glow glow-blue" style={{ padding: '30px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '15px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>Portal del Paciente</h2>
            <p style={{ margin: '0', color: '#475569', fontSize: '15px' }}>Desbloquea y visualiza tu receta médica con cifrado de grado militar.</p>
          </div>
        </div>

        {/* ZONA DE TRABAJO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px' }}>
          
          {/* BUSCADOR Y SELECCIÓN DE LLAVE */}
          <div className="panel-glow" style={{ padding: '40px', marginBottom: '40px' }}>
            <form onSubmit={descifrarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div className="panel-glow glow-teal" style={{ padding: '25px', background: 'rgba(13, 148, 136, 0.05)', borderRadius: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>
                  <svg className="icon-svg" style={{width: '20px', height: '20px'}} viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  Folio de la Receta
                </label>
                <input 
                  type="text" required placeholder="Ej. M5T9X1" value={folioABuscar}
                  onChange={(e) => setFolioABuscar(e.target.value.toUpperCase())}
                  className="dark-input"
                  style={{ fontSize: '20px', textAlign: 'center', letterSpacing: '3px', fontWeight: '800', padding: '18px' }}
                />
              </div>

              {/* BÓVEDA CRIPTOGRÁFICA ON-DEMAND */}
              <div className="panel-glow glow-teal" style={{ padding: '20px', background: 'rgba(20, 184, 166, 0.05)', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', marginBottom: '10px' }}>
                  <svg style={{width:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  Llave de Cifrado (.pem)
                </label>
                <input 
                  type="file" 
                  accept=".pem" 
                  onChange={(e) => setArchivoCifrado(e.target.files[0])} 
                  style={{ fontSize: '12px', width: '100%', cursor: 'pointer' }}
                />
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Sube tu archivo <b>llave_cifrado_...pem</b> para abrir esta receta.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={!archivoCifrado || cargando} 
                style={{ 
                  background: archivoCifrado ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : '#cbd5e1', 
                  color: 'white', padding: '22px', borderRadius: '12px', border: 'none', fontSize: '18px', fontWeight: '800', 
                  cursor: archivoCifrado ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
                  transition: 'all 0.3s ease'
                }}
              >
                {cargando ? (
                  'Descifrando...'
                ) : archivoCifrado ? (
                  <>
                    <svg className="icon-svg" style={{width: '24px', height: '24px'}} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Validar Criptografía y Descifrar Receta
                  </>
                ) : (
                  <>
                    <svg className="icon-svg" style={{width: '24px', height: '24px'}} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Bóveda (.pem) Requerida
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="panel-glow glow-red" style={{ marginTop: '25px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', color: '#991b1b', background: 'rgba(239, 68, 68, 0.1)' }}>
                <svg className="icon-svg" style={{width: '28px', height: '28px'}} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span style={{ fontWeight: '700', fontSize: '16px' }}>{error}</span>
              </div>
            )}
          </div>

          {/* LISTA DE RECETAS - MI EXPEDIENTE */}
          <div className="panel-glow glow-blue" style={{ padding: '35px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg className="icon-svg" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Mi Expediente (Folios Encriptados)
            </h3>
            <p style={{ color: '#475569', fontSize: '14px', marginBottom: '25px' }}>Selecciona un folio de la lista para cargarlo en el motor de descifrado.</p>
            
            {misRecetas.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No tienes recetas en tu expediente.</p>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Folio Seguro</th>
                      <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado en Farmacia</th>
                      <th style={{ padding: '15px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {misRecetas.map((item) => (
                      <tr key={item.id_receta} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '15px', fontFamily: 'monospace', fontWeight: '900', color: '#0f766e', fontSize: '16px' }}>{item.id_receta}</td>
                        <td style={{ padding: '15px' }}>
                          <span style={{ 
                            border: `1px solid ${item.estado === 'SURTIDA' ? '#ef4444' : '#10b981'}`,
                            color: item.estado === 'SURTIDA' ? '#b91c1c' : '#059669', 
                            background: item.estado === 'SURTIDA' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' 
                          }}>
                            {item.estado === 'SURTIDA' ? 'INACTIVA (SURTIDA)' : 'VIGENTE'}
                          </span>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'right' }}>
                          <button 
                            onClick={() => seleccionarRecetaDelHistorial(item.id_receta)}
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          >
                            Cargar Folio <svg className="icon-svg" style={{width: '14px', height: '14px'}} viewBox="0 0 24 24"><path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M16 17l5-5-5-5M19.8 12H9"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RECETA DESCIFRADA */}
        {recetaRevelada && (
          <div className="panel-glow glow-teal" style={{ marginBottom: '40px', overflow: 'hidden', padding: 0, animation: 'slideUp 0.5s ease' }}>
            <div style={{ background: 'rgba(20, 184, 166, 0.1)', padding: '30px', borderBottom: '1px solid rgba(20, 184, 166, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0', color: '#0f766e', fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg className="icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Prescripción Médica E2EE
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#0d9488', fontSize: '14px', fontWeight: '700' }}>Documento Autenticado por Firma Digital</p>
              </div>
              <div style={{ textAlign: 'right', background: '#ffffff', padding: '15px 25px', borderRadius: '12px', border: '2px solid rgba(20, 184, 166, 0.3)' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>Folio Seguro</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#0f766e', letterSpacing: '2px' }}>{recetaRevelada.id_receta}</p>
              </div>
            </div>
            
            <div style={{ padding: '40px 30px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon-svg" style={{width:'16px', height:'16px'}} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Paciente Receptor</p>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '18px', color: '#0f172a' }}>{perfil?.nombre || 'Paciente'}</p>
                </div>
                <div className="panel-glow glow-blue" style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.05)' }}>
                  <p style={{ fontSize: '12px', color: '#1d4ed8', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon-svg" style={{width:'16px', height:'16px'}} viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>Médico Emisor</p>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '18px', color: '#0f172a' }}>ID: {recetaRevelada.medico_nombre || recetaRevelada.usuario_medico || 'Médico Verificado'}</p>
                </div>
              </div>

              {(recetaRevelada.peso || recetaRevelada.alergias) && (
                <div className="panel-glow glow-orange" style={{ padding: '25px', background: 'rgba(249, 115, 22, 0.05)', marginBottom: '35px' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#c2410c', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg className="icon-svg" style={{width:'18px', height:'18px'}} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Signos Vitales y Alergias</h4>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                    <div style={{ background: '#ffffff', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)', flex: '1 1 auto' }}><span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '800', display: 'block' }}>PESO</span><span style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>{recetaRevelada.peso} kg</span></div>
                    <div style={{ background: '#ffffff', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)', flex: '1 1 auto' }}><span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '800', display: 'block' }}>ALTURA</span><span style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>{recetaRevelada.altura} cm</span></div>
                    <div style={{ background: '#ffffff', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)', flex: '1 1 auto' }}><span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '800', display: 'block' }}>TEMP.</span><span style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>{recetaRevelada.temperatura} °C</span></div>
                    <div style={{ background: '#ffffff', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)', flex: '1 1 auto' }}><span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '800', display: 'block' }}>SpO2</span><span style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>{recetaRevelada.spo2} %</span></div>
                  </div>
                  <div className="panel-glow glow-red" style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '800', display: 'block', marginBottom: '3px' }}>ALERGIAS REPORTADAS:</span>
                    <span style={{ fontWeight: '800', color: '#7f1d1d', fontSize: '16px' }}>{recetaRevelada.alergias || 'Ninguna documentada'}</span>
                  </div>
                </div>
              )}

              <div style={{ borderLeft: '6px solid #0f766e', paddingLeft: '25px', marginBottom: '10px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#475569', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>Tratamiento Autorizado</h4>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '15px' }}>
                  <div style={{ color: '#0f766e', marginTop: '5px' }}><svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg></div>
                  <div>
                    <p style={{ margin: '0', fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>{recetaRevelada.medicamento}</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '16px', color: '#0f766e', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}><svg className="icon-svg" style={{width: '18px', height: '18px'}} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Dosis: {recetaRevelada.dosis}</p>
                  </div>
                </div>
                {recetaRevelada.observaciones && (
                  <div style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: '1.5' }}><strong style={{ textTransform: 'uppercase', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#0f172a' }}><svg className="icon-svg" style={{width: '16px', height: '16px'}} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Indicaciones Especiales:</strong> {recetaRevelada.observaciones}</p>
                  </div>
                )}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '15px', textAlign: 'center', fontSize: '12px', color: '#64748b', fontWeight: '700', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              Este documento está protegido por criptografía de curva elíptica (P-256) y cifrado AES-GCM (128-bit).
            </div>
          </div>
        )}

      </div>
    </div>
  );
}