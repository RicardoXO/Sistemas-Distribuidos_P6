import os
import secrets
import base64
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from pydantic import BaseModel
# routers/auth.py
from fastapi import APIRouter, HTTPException, Depends
import bcrypt  #  Usamos bcrypt directamente, adiós passlib
from datetime import datetime, timedelta
import jwt

from core.database import db
from core.config import CLAVE_SECRETA_JWT, ALGORITMO, ADMIN_USER, ADMIN_PASS
from models.schemas import Credenciales, RegistroEntrante, LoginAdminPEM
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
        #"llave_privada_encriptada": datos.llave_privada_encriptada,
        #"salt": datos.salt,
        #"iv": datos.iv
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
    return {
        "access_token": token,
        "rol": usuario_db.get("rol")
    }
    
    # Extraemos su bóveda de Firebase y se la enviamos a React
    #respuesta["boveda"] = {
    #    "llave_privada_encriptada": usuario_db.get("llave_privada_encriptada"),
    #    "salt": usuario_db.get("salt"),
    #    "iv": usuario_db.get("iv")
    #}
        
    #return respuesta

class LoginAdminPEM(BaseModel):
    reto: str
    firma: str # Firma en Base64 enviada por React

@router.get("/api/admin/reto")
def obtener_reto():
    # Creamos un reto y lo firmamos con JWT para que expire en 2 minutos (evita Replay Attacks)
    expiracion = datetime.utcnow() + timedelta(minutes=2)
    payload = {"nonce": secrets.token_hex(16), "exp": expiracion}
    reto = jwt.encode(payload, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
    return {"reto": reto}

@router.post("/api/admin/login-pem")
def login_admin_pem(datos: LoginAdminPEM):
    # 1. Verificar que el reto lo generamos nosotros y no ha expirado
    try:
        jwt.decode(datos.reto, CLAVE_SECRETA_JWT, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="El reto expiró. Intenta de nuevo.")
    
    # 2. Cargar llave pública del admin
    llave_publica_pem = os.getenv("LLAVE_PUBLICA_ADMIN", "").replace("\\n", "\n")
    if not llave_publica_pem:
        raise HTTPException(status_code=500, detail="Llave pública no configurada.")
        
    try:
        llave_pub = load_pem_public_key(llave_publica_pem.encode('utf-8'))
        firma_bytes = base64.b64decode(datos.firma)
        reto_bytes = datos.reto.encode('utf-8')
        
        # 3. TRADUCTOR CRIPTOGRÁFICO: 
        # React envía firmas en formato IEEE P1363 (64 bytes). Python exige ASN.1 DER.
        if len(firma_bytes) != 64:
            raise ValueError("Formato P1363 inválido")
            
        r = int.from_bytes(firma_bytes[:32], 'big')
        s = int.from_bytes(firma_bytes[32:], 'big')
        der_signature = encode_dss_signature(r, s)
        
        # 4. Verificar matemáticamente
        llave_pub.verify(der_signature, reto_bytes, ec.ECDSA(hashes.SHA256()))
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Firma criptográfica inválida. Archivo .pem incorrecto.")
        
    # 5. ¡Pase VIP concedido!
    expiracion = datetime.utcnow() + timedelta(hours=24)
    token_admin = jwt.encode({"sub": "admin_supremo", "rol": "admin", "exp": expiracion}, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
    
    return {"access_token": token_admin, "rol": "admin"}

@router.get("/api/admin/reto")
def obtener_reto():
    # Creamos un reto y lo firmamos con JWT para que expire en 2 minutos
    expiracion = datetime.utcnow() + timedelta(minutes=2)
    payload = {"nonce": secrets.token_hex(16), "exp": expiracion}
    reto = jwt.encode(payload, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
    return {"reto": reto}

@router.post("/api/admin/login-pem")
def login_admin_pem(datos: LoginAdminPEM):
    # 1. Verificar que el reto no ha expirado
    try:
        jwt.decode(datos.reto, CLAVE_SECRETA_JWT, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="El reto expiró. Intenta de nuevo.")
    
    # 2. Cargar llave pública del admin desde el .env
    llave_publica_pem = os.getenv("LLAVE_PUBLICA_ADMIN", "").replace("\\n", "\n")
    if not llave_publica_pem:
        raise HTTPException(status_code=500, detail="Llave pública no configurada en el servidor.")
        
    try:
        llave_pub = load_pem_public_key(llave_publica_pem.encode('utf-8'))
        firma_bytes = base64.b64decode(datos.firma)
        reto_bytes = datos.reto.encode('utf-8')
        
        # 3. TRADUCTOR CRIPTOGRÁFICO: React usa IEEE P1363 (64 bytes). Python exige ASN.1 DER.
        if len(firma_bytes) != 64:
            raise ValueError("Formato P1363 inválido")
            
        r = int.from_bytes(firma_bytes[:32], 'big')
        s = int.from_bytes(firma_bytes[32:], 'big')
        der_signature = encode_dss_signature(r, s)
        
        # 4. Verificar matemáticamente (Si falla, arroja un error automáticamente)
        llave_pub.verify(der_signature, reto_bytes, ec.ECDSA(hashes.SHA256()))
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Firma inválida. Archivo .pem incorrecto.")
        
    # 5. ¡Pase VIP concedido! Generar JWT del Administrador
    expiracion = datetime.utcnow() + timedelta(hours=24)
    token_admin = jwt.encode({"sub": "admin_supremo", "rol": "admin", "exp": expiracion}, CLAVE_SECRETA_JWT, algorithm=ALGORITMO)
    
    return {"access_token": token_admin, "rol": "admin"}