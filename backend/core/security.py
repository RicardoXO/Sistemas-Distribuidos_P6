# core/security.py
from fastapi import HTTPException, Header
import jwt
from cryptography.hazmat.primitives import serialization
from core.config import CLAVE_SECRETA_JWT, ALGORITMO
from core.database import db


def verificar_token(authorization: str = Header(...)):
    try:
        esquema, token = authorization.split()
        return jwt.decode(token, CLAVE_SECRETA_JWT, algorithms=[ALGORITMO])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido. Inicia sesión de nuevo.")

# Función auxiliar para descargar una llave pública específica de Firebase
def obtener_publica_firebase(id_usuario, campo_llave):
    if db is None:
        raise HTTPException(status_code=500, detail="Falta conectar Firebase.")
        
    doc = db.collection("usuarios").document(id_usuario).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"Usuario {id_usuario} no existe en la BD")
    
    llave_str = doc.to_dict().get(campo_llave)
    return serialization.load_pem_public_key(llave_str.encode('utf-8'))


