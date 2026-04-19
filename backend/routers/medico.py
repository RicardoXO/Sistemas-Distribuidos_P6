from fastapi import APIRouter, Depends, HTTPException
import secrets
import string
from firebase_admin import firestore
from datetime import datetime

from core.security import verificar_token
from core.database import db
from models.schemas import RecetaCifradaEntrante

router = APIRouter(tags=["Médico"])

@router.get("/api/medico/perfil")
def obtener_perfil_medico(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "medico":
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    doc = db.collection("usuarios").document(usuario_actual["sub"]).get()
    return doc.to_dict()

@router.get("/api/pacientes")
def obtener_lista_pacientes(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "medico":
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    
    pacientes = []
    docs = db.collection("usuarios").where("rol", "==", "paciente").stream()
    for doc in docs:
        datos = doc.to_dict()
        pacientes.append({
            "usuario": doc.id,
            "nombre": datos.get("nombre", "Sin nombre"),
            "edad": datos.get("edad", "N/A"),
            # 🛑 Fundamental para que el Médico pueda crear el sobre AES del paciente
            "llave_publica_rsa": datos.get("llave_publica_rsa", "") 
        })
    return pacientes

@router.get("/api/farmacias")
def obtener_lista_farmacias(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "medico":
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    
    farmacias = []
    docs = db.collection("usuarios").where("rol", "==", "farmacia").stream()
    for doc in docs:
        datos = doc.to_dict()
        farmacias.append({
            "usuario": doc.id,
            "nombre": datos.get("nombre", "Farmacia sin nombre"),
            # 🛑 CRÍTICO: La llave pública para que el médico pueda crear el sobre
            "llave_publica_rsa": datos.get("llave_publica_rsa", "") 
        })
    return farmacias

@router.post("/medico/emitir")
def emitir_receta(datos: RecetaCifradaEntrante, usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "medico":
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    id_unico = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    fecha_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 🛡️ SERVIDOR CIEGO: Toma los bloques encriptados y los arroja directo a Firebase
    db.collection("recetas").document(id_unico).set({
        "receta_cifrada": datos.receta_cifrada,
        "nonce_aes": datos.nonce_aes,
        "aes_medico": datos.aes_medico,
        "aes_paciente": datos.aes_paciente,
        "aes_farmacia": datos.aes_farmacia,
        "firma_ecdsa": datos.firma_ecdsa,
        "medico_id": usuario_actual["sub"],  
        "paciente_id": datos.usuario_paciente, 
        "estado": "PENDIENTE",
        "fecha_emision": fecha_actual,
        "sello_mac": None,
        "creado_en": firestore.SERVER_TIMESTAMP
    })

    return {"mensaje": "Receta E2EE subida a Firebase exitosamente.", "id_receta": id_unico}

@router.get("/api/medico/historial")
def obtener_historial_medico(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "medico":
        raise HTTPException(status_code=403, detail="Acceso denegado.")
    
    docs = db.collection("recetas").where("medico_id", "==", usuario_actual["sub"]).stream()
    historial = []
    for doc in docs:
        datos = doc.to_dict()
        historial.append({
            "id_receta": doc.id,
            "paciente_id": datos.get("paciente_id", "Desconocido"),
            "estado": datos.get("estado", "PENDIENTE"),
            "fecha_emision": datos.get("fecha_emision", "")
        })
    historial.sort(key=lambda x: x["fecha_emision"], reverse=True)
    return historial