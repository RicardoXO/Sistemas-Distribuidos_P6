# models/schemas.py
from pydantic import BaseModel
from typing import Optional

class Credenciales(BaseModel):
    usuario: str
    password: str

#class RecetaEntrante(BaseModel):
class RecetaCifradaEntrante(BaseModel):
    usuario_paciente: str 
    receta_cifrada: str
    nonce_aes: str
    aes_medico: str
    aes_paciente: str
    aes_farmacia: str
    firma_ecdsa: str

class PeticionDescifrar(BaseModel):
    id_receta: str
    #llave_privada_rsa_pem: str

class PeticionSurtir(BaseModel):
    id_receta: str

class RegistroEntrante(BaseModel):
    usuario: str
    password: str
    nombre: str
    edad: int
    rol: str
    llave_publica_ecc: Optional[str] = None
    llave_publica_rsa: Optional[str] = None
    # --- NUEVOS CAMPOS PARA EL KEYSTORE SINCRONIZADO ---
    llave_privada_encriptada: Optional[str] = None
    salt: Optional[str] = None
    iv: Optional[str] = None