# core/config.py
import os
from dotenv import load_dotenv

# Carga las variables de entorno desde el archivo .env  si existe(para desarrollo local)
load_dotenv()

# Obtenemos las llaves. Si por alguna razón no existe el .env, usa un valor de respaldo (solo para no explotar)
CLAVE_SECRETA_JWT = os.getenv("CLAVE_SECRETA_JWT", "llave_respaldo_local")

# La llave MAC necesita ser bytes, así que la leemos como string y la convertimos
llave_mac_str = os.getenv("LLAVE_MAC_FARMACIA", "mac_respaldo_local")
LLAVE_MAC_FARMACIA = llave_mac_str.encode('utf-8')

ALGORITMO = os.getenv("ALGORITMO", "HS256")

# Credenciales del Administrador
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")