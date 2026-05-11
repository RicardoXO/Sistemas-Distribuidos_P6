import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Admin({ token }) {
  const [usuarios, setUsuarios] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const config = { headers: { Authorization: `Bearer ${token}` } };

  const cargarDatos = async () => {
    try {
      const [resUsers, resRecetas] = await Promise.all([
        api.get('/api/admin/usuarios', config),
        api.get('/api/admin/recetas', config)
      ]);
      setUsuarios(resUsers.data);
      setRecetas(resRecetas.data);
    } catch (error) {
      console.error("Error al cargar datos", error);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const borrarUsuario = async (id) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al usuario ${id}?`)) return;
    try {
      await api.delete(`/api/admin/usuarios/${id}`, config);
      cargarDatos();
    } catch (e) { alert("Error al eliminar"); }
  };

  const borrarReceta = async (id) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la receta ${id}?`)) return;
    try {
      await api.delete(`/api/admin/recetas/${id}`, config);
      cargarDatos();
    } catch (e) { alert("Error al eliminar"); }
  };

  // Función para truncar textos largos para que la tabla no se rompa visualmente
  const truncar = (texto, limite = 25) => {
    if (!texto) return "N/A";
    return texto.length > limite ? texto.substring(0, limite) + "..." : texto;
  };

  return (
    <div style={{ padding: '30px 40px', width: '100vw', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
        <h1 style={{ color: '#0f172a', margin: 0, fontSize: '28px', fontWeight: '800' }}>Terminal de Auditoría Criptográfica</h1>
        <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>Gestión de identidades y verificación de integridad HMAC/E2EE</p>
      </header>

      {/* SECCIÓN USUARIOS */}
      <div className="panel-glow" style={{ padding: '20px', marginBottom: '30px', width: '100%', overflowX: 'auto' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
          <svg style={{width:'20px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Directorio de Identidades (Llaves Públicas)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px' }}>ID Usuario</th>
              <th style={{ padding: '12px' }}>Rol</th>
              <th style={{ padding: '12px' }}>Llave Pública RSA (Fragmento)</th>
              <th style={{ padding: '12px' }}>Llave Pública ECC (Firma)</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.usuario} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#2563eb' }}>{u.usuario}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 'bold' }}>{u.rol.toUpperCase()}</span>
                </td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b' }} title={u.llave_publica_rsa}>
                  {truncar(u.llave_publica_rsa, 40)}
                </td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b' }} title={u.llave_publica_ecc}>
                  {truncar(u.llave_publica_ecc, 40)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => borrarUsuario(u.usuario)} className="btn-borrar">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECCIÓN RECETAS */}
      <div className="panel-glow" style={{ padding: '20px', width: '100%', overflowX: 'auto' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
          <svg style={{width:'20px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Libro Mayor de Recetas (Tráfico Cifrado y Firmas)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px' }}>Folio</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Payload Cifrado (AES)</th>
              <th style={{ padding: '12px' }}>Firma (ECDSA)</th>
              <th style={{ padding: '12px' }}>Sello MAC</th>
              <th style={{ padding: '12px' }}>Integridad</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.id}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '3px 6px', 
                    borderRadius: '4px', 
                    fontSize: '10px', 
                    background: r.estado === 'SURTIDA' ? '#dcfce7' : '#fef3c7',
                    color: r.estado === 'SURTIDA' ? '#166534' : '#92400e'
                  }}>{r.estado}</span>
                </td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#94a3b8' }} title={r.receta_cifrada}>
                  {truncar(r.receta_cifrada, 30)}
                </td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#94a3b8' }} title={r.firma_ecdsa}>
                  {truncar(r.firma_ecdsa, 30)}
                </td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: '#94a3b8' }} title={r.sello_mac}>
                  {truncar(r.sello_mac, 20)}
                </td>
                <td style={{ padding: '12px' }}>
                  {r.integridad === "VALIDA" && <span style={{ color: '#059669', fontWeight: 'bold' }}>✓ Legítima</span>}
                  {r.integridad === "CORROMPIDA" && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠ ALTERADA</span>}
                  {r.integridad === "N/A" && <span style={{ color: '#64748b' }}>Pendiente</span>}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => borrarReceta(r.id)} className="btn-borrar">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .btn-borrar {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
          padding: 6px 12px;
          borderRadius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: bold;
          transition: all 0.2s;
        }
        .btn-borrar:hover {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </div>
  );
}