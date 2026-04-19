from fastapi import APIRouter, Depends, HTTPException
from core.security import verificar_token
from core.database import db
from models.schemas import PeticionDescifrar

router = APIRouter(tags=["Paciente"])

@router.post("/paciente/descifrar")
def paciente_ver_receta(datos: PeticionDescifrar, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "paciente":
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    doc = db.collection("recetas").document(datos.id_receta.upper()).get()
    if not doc.exists: 
        raise HTTPException(404, "Receta no encontrada en la nube")
    
    datos_receta = doc.to_dict()

    if datos_receta.get("paciente_id") != usuario_actual["sub"]:
        raise HTTPException(
            status_code=403, 
            detail="VIOLACIÓN DE SEGURIDAD: No tienes autorización para acceder al expediente de otro paciente."
        )
    
    # 🛡️ SERVIDOR CIEGO: Devuelve el documento tal cual.
    return datos_receta
    
@router.get("/api/paciente/historial")
def obtener_historial_paciente(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "paciente":
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    
    docs = db.collection("recetas").where("paciente_id", "==", usuario_actual["sub"]).stream()
    historial = []
    for doc in docs:
        datos = doc.to_dict()
        historial.append({
            "id_receta": doc.id,
            "medico_id": datos.get("medico_id", "Desconocido"),
            "estado": datos.get("estado", "PENDIENTE"),
            "fecha_emision": datos.get("fecha_emision", "Fecha no registrada")
        })
    historial.sort(key=lambda x: x["fecha_emision"], reverse=True)
    return historial