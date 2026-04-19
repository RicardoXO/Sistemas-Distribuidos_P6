import { useState } from 'react';
import api from '../services/api';
import { desempaquetarRecetaE2EE } from '../services/cryptoEngine';

export default function Farmacia({ token, llavePrivadaEnMemoria, rol }) {
  const [datosPeticion, setDatosPeticion] = useState({ id_receta: '' });
  const [recetaDescifrada, setRecetaDescifrada] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [surtidoExitoso, setSurtidoExitoso] = useState(null);

  const buscarReceta = async (e) => {
    e.preventDefault();
    setError(null);
    setRecetaDescifrada(null);
    setSurtidoExitoso(null);
    setCargando(true);

    if (!llavePrivadaEnMemoria) {
      setError("Error Crítico: Bóveda criptográfica inactiva. Cierra sesión y vuelve a ingresar.");
      setCargando(false);
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // 1. Pedimos el bloque cifrado al servidor (Ruta ciega)
      const respuesta = await api.post('/farmacia/verificar', { id_receta: datosPeticion.id_receta }, config);
      const paqueteCifrado = respuesta.data;

      // 2. Desciframos localmente usando el sobre AES de la farmacia
      const datosPlanos = await desempaquetarRecetaE2EE(
        paqueteCifrado,
        llavePrivadaEnMemoria,
        rol // Le pasamos "farmacia" para que el motor abra el candado correcto
      );

      // 3. Mostramos la receta
      setRecetaDescifrada({
        ...datosPlanos,
        id_receta: datosPeticion.id_receta,
        fecha_emision: paqueteCifrado.fecha_emision,
        estado: paqueteCifrado.estado
      });

    } catch (err) {
      console.error(err);
      setError(err.message || err.response?.data?.detail || "Error al descifrar. Verifica el folio.");
    } finally {
      setCargando(false);
    }
  };

  const surtirMedicamento = async () => {
    if (!window.confirm("¿Confirmas la entrega de este medicamento? Esta acción generará un sello criptográfico inmutable.")) return;
    
    setCargando(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // 4. Le avisamos a FastAPI que marque la receta como surtida (Genera el HMAC)
      const respuesta = await api.post('/farmacia/surtir', { id_receta: recetaDescifrada.id_receta }, config);
      
      setSurtidoExitoso(respuesta.data);
      // Actualizamos el estado visual de la receta actual
      setRecetaDescifrada({ ...recetaDescifrada, estado: 'SURTIDA' });
      
    } catch (err) {
      setError(err.response?.data?.detail || "Error al surtir la receta.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="farmacia-bg-container" style={{ padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '850px', width: '100%', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
        
        {/* CABECERA DASHBOARD */}
        <div className="panel-glow glow-blue" style={{ padding: '30px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '15px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg className="icon-svg" style={{width: '32px', height: '32px'}} viewBox="0 0 24 24"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 0V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4M12 12v4M10 14h4"/></svg>
          </div>
          <div>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>Terminal de Dispensación Segura</h2>
            <p style={{ margin: '0', color: '#475569', fontSize: '15px' }}>Verificación E2EE de recetas electrónicas y registro de control.</p>
          </div>
        </div>

        {/* BUSCADOR DE RECETAS */}
        <div className="panel-glow" style={{ padding: '40px', marginBottom: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <form onSubmit={buscarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div className="panel-glow glow-teal" style={{ padding: '25px', background: 'rgba(13, 148, 136, 0.05)', borderRadius: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>
                <svg className="icon-svg" style={{width: '20px', height: '20px'}} viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                Folio Criptográfico del Paciente
              </label>
              <input 
                type="text" required placeholder="Ej. M5T9X1" value={datosPeticion.id_receta}
                onChange={(e) => setDatosPeticion({ id_receta: e.target.value.toUpperCase() })}
                style={{ width: '100%', fontSize: '24px', textAlign: 'center', letterSpacing: '4px', fontWeight: '800', padding: '18px', border: '2px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>

            {/* ESTADO DE LA BÓVEDA EN MEMORIA */}
            <div className={`panel-glow ${llavePrivadaEnMemoria ? 'glow-teal' : 'glow-red'}`} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderRadius: '12px', background: llavePrivadaEnMemoria ? 'rgba(20, 184, 166, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
               {llavePrivadaEnMemoria ? '✅ Bóveda de Farmacia Conectada (Memoria Segura)' : '❌ Error: No se encontró llave RSA para la farmacia.'}
            </div>

            <button type="submit" disabled={!llavePrivadaEnMemoria || cargando} style={{ 
                background: llavePrivadaEnMemoria ? '#0f766e' : '#cbd5e1', 
                color: 'white', padding: '20px', borderRadius: '8px', border: 'none', fontSize: '18px', fontWeight: '800', 
                cursor: llavePrivadaEnMemoria ? 'pointer' : 'not-allowed', width: '100%'
              }}>
              {cargando ? 'Procesando...' : 'Verificar y Descifrar Receta'}
            </button>
          </form>

          {error && <div style={{ marginTop: '20px', padding: '15px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>❌ {error}</div>}
        </div>

        {/* VISUALIZADOR DE RECETA PARA FARMACIA */}
        {recetaDescifrada && (
          <div className="panel-glow glow-blue" style={{ padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', animation: 'slideUp 0.5s ease' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '24px' }}>Autorización Médica</h3>
              <span style={{ 
                background: recetaDescifrada.estado === 'SURTIDA' ? '#fee2e2' : '#dcfce7', 
                color: recetaDescifrada.estado === 'SURTIDA' ? '#dc2626' : '#16a34a', 
                padding: '8px 16px', borderRadius: '20px', fontWeight: '900', fontSize: '14px', letterSpacing: '1px' 
              }}>
                {recetaDescifrada.estado === 'SURTIDA' ? 'INACTIVA (YA SURTIDA)' : 'VÁLIDA PARA SURTIR'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>PACIENTE</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{recetaDescifrada.paciente_nombre}</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>MÉDICO EMISOR</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{recetaDescifrada.medico_nombre}</p>
              </div>
            </div>

            <div style={{ background: '#eff6ff', borderLeft: '5px solid #3b82f6', padding: '25px', borderRadius: '8px', marginBottom: '30px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1d4ed8', fontWeight: '900', letterSpacing: '1px' }}>FÁRMACO AUTORIZADO</p>
              <p style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: '900', color: '#1e3a8a' }}>{recetaDescifrada.medicamento}</p>
              <p style={{ margin: 0, fontSize: '18px', color: '#1e40af', fontWeight: '600' }}>Dosis: {recetaDescifrada.dosis}</p>
            </div>

            {/* BOTÓN PARA SURTIR */}
            {recetaDescifrada.estado !== 'SURTIDA' && !surtidoExitoso && (
              <button onClick={surtirMedicamento} disabled={cargando} style={{
                background: '#10b981', color: 'white', width: '100%', padding: '20px', borderRadius: '8px', border: 'none', fontSize: '20px', fontWeight: '900', cursor: cargando ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
              }}>
                {cargando ? 'Procesando Sello HMAC...' : '✅ Confirmar Entrega de Medicamento'}
              </button>
            )}

            {/* MENSAJE DE ÉXITO */}
            {surtidoExitoso && (
              <div style={{ background: '#dcfce7', border: '2px solid #16a34a', padding: '25px', borderRadius: '12px', textAlign: 'center' }}>
                <h3 style={{ color: '#16a34a', margin: '0 0 10px 0' }}>{surtidoExitoso.mensaje}</h3>
                <p style={{ color: '#15803d', margin: '0 0 5px 0' }}>Folio: {surtidoExitoso.id_receta}</p>
                <p style={{ color: '#15803d', margin: 0, fontSize: '12px', fontFamily: 'monospace' }}>Sello MAC: {surtidoExitoso.sello_mac}</p>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}