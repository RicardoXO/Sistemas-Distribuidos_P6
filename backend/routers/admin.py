# backend/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException
import hmac
import hashlib
from core.security import verificar_token
from core.database import db
from core.config import LLAVE_MAC_FARMACIA

router = APIRouter(tags=["Administración"])

@router.get("/api/admin/recetas")
def obtener_todas_las_recetas(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador.")
    
    docs = db.collection("recetas").stream()
    recetas = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        
        # --- LÓGICA DE AUDITORÍA HMAC ---
        data["integridad"] = "N/A" # Por defecto para pendientes
        
        if data.get("estado") == "SURTIDA" and data.get("sello_mac"):
            # Re-calculamos el sello para verificar si alguien alteró la DB
            id_receta = doc.id
            timestamp = data.get("fecha_surtido")
            mensaje_esperado = f"{id_receta}|SURTIDA|{timestamp}".encode('utf-8')
            
            # Lógica robusta:
            llave_bytes = LLAVE_MAC_FARMACIA if isinstance(LLAVE_MAC_FARMACIA, bytes) else LLAVE_MAC_FARMACIA.encode('utf-8')
            
            sello_calculado = hmac.new(
                llave_bytes,
                mensaje_esperado,
                hashlib.sha256
            ).hexdigest()
            
            # Comparamos el sello calculado con el guardado en Firebase
            if sello_calculado == data.get("sello_mac"):
                data["integridad"] = "VALIDA"
            else:
                data["integridad"] = "CORROMPIDA"
        
        recetas.append(data)
    return recetas

@router.get("/api/admin/usuarios")
def obtener_todos_los_usuarios(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos.")
    
    docs = db.collection("usuarios").stream()
    return [{"usuario": doc.id, **doc.to_dict()} for doc in docs]

# --- NUEVAS FUNCIONES DE BORRADO ---

@router.delete("/api/admin/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: str, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(403, "No autorizado")
    db.collection("usuarios").document(usuario_id).delete()
    return {"mensaje": f"Usuario {usuario_id} eliminado exitosamente."}

@router.delete("/api/admin/recetas/{receta_id}")
def eliminar_receta(receta_id: str, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(403, "No autorizado")
    db.collection("recetas").document(receta_id).delete()
    return {"mensaje": f"Receta {receta_id} eliminada exitosamente."}