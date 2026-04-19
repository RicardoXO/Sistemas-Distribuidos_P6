import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Admin({ token }) {
  const [usuarios, setUsuarios] = useState({});
  const [recetas, setRecetas] = useState({});
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  // useEffect se ejecuta automáticamente cuando el componente carga
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        // Hacemos las dos peticiones al mismo tiempo
        const [resUsuarios, resRecetas] = await Promise.all([
          api.get('/admin/usuarios', config),
          api.get('/admin/recetas', config)
        ]);

        setUsuarios(resUsuarios.data);
        setRecetas(resRecetas.data);
        setCargando(false);
      } catch (err) {
        setError(err.response?.data?.detail || "Error al cargar la base de datos.");
        setCargando(false);
      }
    };

    cargarDatos();
  }, [token]);

  if (cargando) return <h3 style={{ textAlign: 'center' }}>Cargando base de datos segura...</h3>;
  if (error) return <div style={{ color: 'red', textAlign: 'center' }}>❌ {error}</div>;

  return (
    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', color: '#343a40' }}>🛡️ Dashboard de Auditoría y Seguridad</h2>
      <p style={{ textAlign: 'center', color: '#6c757d' }}>Vista global de Firebase. Comprobación de confidencialidad (Zero-Knowledge).</p>

      {/* SECCIÓN DE USUARIOS */}
      <div style={{ marginTop: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>👥 Directorio de Usuarios (Llaves Públicas)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e9ecef', textAlign: 'left' }}>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Usuario</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Rol</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Llave Pública (Extracto)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(usuarios).map(([id, datos]) => (
                <tr key={id}>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>{id}</td>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', textTransform: 'capitalize' }}>{datos.rol}</td>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px', color: '#28a745', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {datos.llave_publica_rsa || datos.llave_publica_ecc || "No registrada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN DE RECETAS */}
      <div style={{ marginTop: '30px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>🔐 Bóveda de Recetas Cifradas (AES + RSA)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e9ecef', textAlign: 'left' }}>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>ID Receta</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Estado</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Criptograma AES (Receta)</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Firma Digital (ECDSA)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(recetas).map(([id, datos]) => (
                <tr key={id}>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontWeight: 'bold', color: '#007bff' }}>{id}</td>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontWeight: 'bold', color: datos.estado === 'SURTIDA' ? 'red' : 'green' }}>
                    {datos.estado}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px', color: '#6c757d', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {datos.receta_cifrada}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #dee2e6', fontFamily: 'monospace', fontSize: '12px', color: '#d39e00', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {datos.firma_ecdsa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
          <em>* Nota: Como administrador, no tienes acceso a la llave privada RSA del paciente ni del médico, por lo tanto, es matemáticamente imposible descifrar la columna "Criptograma AES".</em>
        </p>
      </div>
    </div>
  );
}