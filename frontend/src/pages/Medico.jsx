import { useState, useEffect } from 'react';
import api from '../services/api';
import { empaquetarRecetaE2EE } from '../services/cryptoEngine';

export default function Medico({ token }) {
  const [perfilMedico, setPerfilMedico] = useState(null);
  const [listaPacientes, setListaPacientes] = useState([]);
  const [listaFarmacias, setListaFarmacias] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  
  const [datosReceta, setDatosReceta] = useState({
    usuario_paciente: '',
    usuario_farmacia: '',
    peso: '', altura: '', temperatura: '', spo2: '', alergias: 'Ninguna',
    medicamento: '', dosis: '', observaciones: ''
  });
  
  // --- ESTADOS PARA CARGA DE LLAVES PEM ---
  const [archivoFirma, setArchivoFirma] = useState(null);
  const [archivoCifrado, setArchivoCifrado] = useState(null);
  
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
          api.get('/api/farmacias', config),
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

    // 1. Validações de segurança
    if (!archivoFirma) {
      alert("Erro: Deve carregar a sua chave de FIRMA (.pem) para autorizar este documento.");
      return;
    }
    if (!pacienteSeleccionado) {
      alert("Erro: Por favor, selecione um paciente.");
      return;
    }
    if (!datosReceta.usuario_farmacia) {
      alert("Erro: Por favor, selecione uma farmácia autorizada.");
      return;
    }

    setCargando(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // 2. Apenas lemos o texto puro do arquivo .pem (On-Demand)
      // Removemos a conversão manual porque o cryptoEngine.js já faz isso!
      const textoPEM = await archivoFirma.text();

      const farmaciaDestino = listaFarmacias.find(f => f.usuario === datosReceta.usuario_farmacia);

      // 3. Empacotar e cifrar usando o Motor E2EE
      const paqueteCifrado = await empaquetarRecetaE2EE(
        datosReceta, 
        textoPEM, // <--- Agora passamos o texto corretamente
        perfilMedico.llave_publica_rsa, 
        pacienteSeleccionado.llave_publica_rsa, 
        farmaciaDestino.llave_publica_rsa 
      );

      paqueteCifrado.usuario_paciente = pacienteSeleccionado.usuario;

      // 4. Enviar para o backend
      const resposta = await api.post('/medico/emitir', paqueteCifrado, config);
      
      setResultado({ exito: true, data: resposta.data });
      setDatosReceta({ 
        usuario_paciente: '', usuario_farmacia: '', peso: '', altura: '', 
        temperatura: '', spo2: '', alergias: 'Ninguna', medicamento: '', 
        dosis: '', observaciones: '' 
      });
      setPacienteSeleccionado(null);

      // Atualizar o histórico
      const resHistorial = await api.get('/api/medico/historial', config);
      setHistorial(resHistorial.data);

    } catch (error) {
      console.error(error);
      setResultado({ exito: false, mensagem: "Erro no processo criptográfico: " + (error.message || "A chave fornecida não é válida.") });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="medico-bg-container">
      <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
        
        {/* CABECERA DASHBOARD */}
        {perfilMedico && (
          <div className="panel-glow glow-blue" style={{ padding: '30px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '15px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
              <svg style={{width: '32px', height: '32px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
            </div>
            <div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>Dr. {perfilMedico.nombre}</h2>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: '#475569' }}>
                <span><strong>ID:</strong> {perfilMedico.rol.toUpperCase()}</span><span>•</span>
                <span style={{ color: '#059669', fontWeight: 'bold' }}>Cédula Verificada</span>
              </div>
            </div>
          </div>
        )}

        <div className="panel-glow" style={{ padding: '35px' }}>
          <h3 style={{ margin: '0 0 25px 0', color: '#0f172a', fontSize: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
            Nueva Prescripción Electrónica Segura
          </h3>

          <form onSubmit={enviarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SECCIÓN DE SEGURIDAD ON-DEMAND */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="panel-glow glow-teal" style={{ padding: '20px', background: 'rgba(20, 184, 166, 0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', marginBottom: '10px' }}>
                  <svg style={{width:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  Llave de Firma (ECC)
                </label>
                <input 
                  type="file" 
                  accept=".pem" 
                  required 
                  onChange={(e) => setArchivoFirma(e.target.files[0])}
                  style={{ fontSize: '11px', width: '100%', padding: '5px', border: '1px dashed #14b8a6', borderRadius: '4px' }} 
                />
                <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#64748b' }}>Carga el archivo: <b>llave_firma_...pem</b></p>
              </div>

              <div className="panel-glow glow-blue" style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: '10px' }}>
                  <svg style={{width:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Llave de Cifrado (RSA)
                </label>
                <input 
                  type="file" 
                  accept=".pem" 
                  onChange={(e) => setArchivoCifrado(e.target.files[0])}
                  style={{ fontSize: '11px', width: '100%', padding: '5px', border: '1px dashed #3b82f6', borderRadius: '4px' }} 
                />
                <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#64748b' }}>Carga el archivo: <b>llave_cifrado_...pem</b></p>
              </div>
            </div>

            {/* SELECTORES DE PACIENTE Y FARMACIA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Paciente Destino</label>
                <select required className="dark-input" value={datosReceta.usuario_paciente} onChange={manejarCambioPaciente}>
                  <option value="">-- Buscar paciente --</option>
                  {listaPacientes.map(p => <option key={p.usuario} value={p.usuario}>{p.nombre} (ID: {p.usuario})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Farmacia Autorizada</label>
                <select required className="dark-input" value={datosReceta.usuario_farmacia} onChange={(e) => setDatosReceta({...datosReceta, usuario_farmacia: e.target.value})}>
                  <option value="">-- Seleccionar sucursal --</option>
                  {listaFarmacias.map(f => <option key={f.usuario} value={f.usuario}>{f.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* SIGNOS VITALES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
              <div><label style={{ fontSize: '12px', color: '#475569' }}>Peso (kg)</label><input type="text" required className="dark-input" value={datosReceta.peso} onChange={(e) => setDatosReceta({...datosReceta, peso: e.target.value})}/></div>
              <div><label style={{ fontSize: '12px', color: '#475569' }}>Altura (cm)</label><input type="text" required className="dark-input" value={datosReceta.altura} onChange={(e) => setDatosReceta({...datosReceta, altura: e.target.value})}/></div>
              <div><label style={{ fontSize: '12px', color: '#475569' }}>Temp (°C)</label><input type="text" required className="dark-input" value={datosReceta.temperatura} onChange={(e) => setDatosReceta({...datosReceta, temperatura: e.target.value})}/></div>
              <div><label style={{ fontSize: '12px', color: '#475569' }}>SpO2 (%)</label><input type="text" required className="dark-input" value={datosReceta.spo2} onChange={(e) => setDatosReceta({...datosReceta, spo2: e.target.value})}/></div>
            </div>

            {/* TRATAMIENTO */}
            <div className="panel-glow glow-blue" style={{ padding: '20px', background: 'rgba(37, 99, 235, 0.05)' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1d4ed8' }}>Medicamento</label>
                  <input type="text" required className="dark-input" placeholder="Ej. Paracetamol 500mg" value={datosReceta.medicamento} onChange={(e) => setDatosReceta({...datosReceta, medicamento: e.target.value})}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1d4ed8' }}>Dosis</label>
                  <input type="text" required className="dark-input" placeholder="Ej. 1 tableta c/8 hrs" value={datosReceta.dosis} onChange={(e) => setDatosReceta({...datosReceta, dosis: e.target.value})}/>
                </div>
              </div>
              <label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>Indicaciones Especiales</label>
              <textarea rows="3" className="dark-input" placeholder="Instrucciones adicionales..." value={datosReceta.observaciones} onChange={(e) => setDatosReceta({...datosReceta, observaciones: e.target.value})} />
            </div>

            <button type="submit" className="btn-primary" disabled={cargando} style={{ padding: '18px', opacity: cargando ? 0.7 : 1 }}>
              {cargando ? 'Firmando digitalmente...' : 'Generar, Firmar y Emitir Prescripción'}
            </button>
          </form>
        </div>

        {/* --- RECUADROS DE RESULTADO RESTAURADOS --- */}
        {resultado?.exito && (
          <div className="panel-glow glow-teal" style={{ marginTop: '30px', padding: '30px', textAlign: 'center', background: 'rgba(20, 184, 166, 0.15)', animation: 'fadeIn 0.5s ease' }}>
            <svg style={{width: '48px', height: '48px', color: '#0f766e', margin: '0 auto 10px auto'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '22px', color: '#0f172a' }}>Prescripción Cifrada Exitosamente</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#475569' }}>Folio E2EE para el paciente:</p>
            <div style={{ background: '#ffffff', display: 'inline-block', padding: '15px 40px', borderRadius: '8px', border: '1px solid #14b8a6', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '38px', fontFamily: 'monospace', fontWeight: '900', color: '#0f766e', letterSpacing: '8px' }}>{resultado.data.id_receta}</span>
            </div>
          </div>
        )}

        {resultado && !resultado.exito && (
          <div className="panel-glow glow-red" style={{ marginTop: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', color: '#991b1b', background: 'rgba(239, 68, 68, 0.15)', animation: 'fadeIn 0.5s ease' }}>
            <svg style={{width: '28px', height: '28px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span style={{ fontWeight: '700', fontSize: '16px' }}>{resultado.mensaje}</span>
          </div>
        )}

        {/* HISTORIAL */}
        <div className="panel-glow" style={{ marginTop: '40px', padding: '35px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Registro de Folios Emitidos (Metadata)</h3>
          {historial.length === 0 ? (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay registros criptográficos.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '15px', color: '#475569', fontSize: '12px' }}>Folio E2EE</th>
                  <th style={{ padding: '15px', color: '#475569', fontSize: '12px' }}>Paciente</th>
                  <th style={{ padding: '15px', color: '#475569', fontSize: '12px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item) => (
                  <tr key={item.id_receta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '15px', fontFamily: 'monospace', fontWeight: '800', color: '#2563eb' }}>{item.id_receta}</td>
                    <td style={{ padding: '15px', color: '#475569' }}>{item.paciente_id}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ 
                        padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800',
                        background: item.estado === 'SURTIDA' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        color: item.estado === 'SURTIDA' ? '#059669' : '#d97706'
                      }}>{item.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}