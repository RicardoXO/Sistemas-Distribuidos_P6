from fastapi import APIRouter, Depends, HTTPException
import hmac
import hashlib
from datetime import datetime, timezone
from core.security import verificar_token
from core.database import db
from core.config import LLAVE_MAC_FARMACIA
from models.schemas import PeticionDescifrar, PeticionSurtir

router = APIRouter(tags=["Farmacia"])

@router.post("/farmacia/verificar")
def farmacia_verificar(datos: PeticionDescifrar, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "farmacia":
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    doc = db.collection("recetas").document(datos.id_receta.upper()).get()
    if not doc.exists: 
        raise HTTPException(404, "Receta no encontrada en la nube")
    
    # 🛡️ SERVIDOR CIEGO
    return doc.to_dict()

@router.post("/farmacia/surtir")
def surtir_receta(datos: PeticionSurtir, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "farmacia":
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    id_receta = datos.id_receta.upper()
    doc_ref = db.collection("recetas").document(id_receta)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
        
    if doc.to_dict().get("estado") == 'SURTIDA':
        raise HTTPException(status_code=400, detail="Esta receta ya fue surtida.")
        
    timestamp = datetime.now(timezone.utc).isoformat()
    mensaje_mac = f"{id_receta}|SURTIDA|{timestamp}".encode('utf-8')
    sello_mac = hmac.new(LLAVE_MAC_FARMACIA.encode('utf-8'), mensaje_mac, hashlib.sha256).hexdigest()
    
    doc_ref.update({
        "estado": 'SURTIDA',
        "sello_mac": sello_mac,
        "fecha_surtido": timestamp
    })
    
    return {
        "mensaje": "✅ Medicamento entregado. Receta sellada en la nube.",
        "id_receta": id_receta,
        "timestamp": timestamp,
        "sello_mac": sello_mac
    }