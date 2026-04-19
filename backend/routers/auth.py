# routers/auth.py
from fastapi import APIRouter, HTTPException, Depends
import bcrypt  # 🛑 Usamos bcrypt directamente, adiós passlib
from datetime import datetime, timedelta
import jwt

from core.database import db
from core.config import CLAVE_SECRETA_JWT, ALGORITMO, ADMIN_USER, ADMIN_PASS
from models.schemas import Credenciales, RegistroEntrante
from core.security import verificar_token

router = APIRouter(tags=["Autenticación"])

@router.post("/api/registro")
def registrar_usuario(datos: RegistroEntrante):
    # 1. Verificar si el usuario ya existe
    doc_ref = db.collection("usuarios").document(datos.usuario)
    if doc_ref.get().exists:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso.")
    
    # 2. NUEVO: Hashear la contraseña con bcrypt nativo
    salt = bcrypt.gensalt()
    password_hasheada = bcrypt.hashpw(datos.password.encode('utf-8'), salt).decode('utf-8')
    
    # 3. Preparar los datos incluyendo la Bóveda E2EE
    usuario_db = {
        "password": password_hasheada,
        "nombre": datos.nombre,
        "edad": datos.edad,
        "rol": datos.rol,
        "llave_publica_ecc": datos.llave_publica_ecc,
        "llave_publica_rsa": datos.llave_publica_rsa,
        # --- Campos de la Bóveda Encriptada ---
        "llave_privada_encriptada": datos.llave_privada_encriptada,
        "salt": datos.salt,
        "iv": datos.iv
    }
    
    # 4. Guardar en Firebase
    doc_ref.set(usuario_db)
    
    return {"mensaje": "Identidad criptográfica registrada exitosamente."}


@router.post("/api/login")
def iniciar_sesion(credenciales: Credenciales):
    
    # 👑 PASE VIP: Verificamos primero si es el Administrador Hardcodeado
    if credenciales.usuario == ADMIN_USER and credenciales.password == ADMIN_PASS:
        expiracion = datetime.utcnow() + timedelta(hours=24)
        payload_admin = {
            "sub": credenciales.usuario,
            "rol": "admin",
            "exp": expiracion
        }
        token_admin = jwt.encode(payload_admin, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
        
        # El admin no usa bóveda criptográfica, solo le enviamos su token
        return {
            "access_token": token_admin,
            "rol": "admin"
        }

    # ---------------------------------------------------------
    # Si no es el admin, el flujo continúa normal buscando en Firebase...
    
    # 1. Buscar usuario en Firebase
    doc = db.collection("usuarios").document(credenciales.usuario).get()
    if not doc.exists:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
        
    usuario_db = doc.to_dict()
    
    # 2. Verificar contraseña con bcrypt nativo
    password_db = usuario_db.get("password", "").encode('utf-8')
    password_ingresada = credenciales.password.encode('utf-8')
    
    if not bcrypt.checkpw(password_ingresada, password_db):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
        
    # 3. Generar JWT (Token de sesión)
    expiracion = datetime.utcnow() + timedelta(hours=24)
    payload = {
        "sub": credenciales.usuario,
        "rol": usuario_db.get("rol"),
        "exp": expiracion
    }
    token = jwt.encode(payload, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
    
    # 4. Preparar respuesta OPTIMIZADA
    respuesta = {
        "access_token": token,
        "rol": usuario_db.get("rol")
    }
    
    # Extraemos su bóveda de Firebase y se la enviamos a React
    respuesta["boveda"] = {
        "llave_privada_encriptada": usuario_db.get("llave_privada_encriptada"),
        "salt": usuario_db.get("salt"),
        "iv": usuario_db.get("iv")
    }
        
    return respuesta