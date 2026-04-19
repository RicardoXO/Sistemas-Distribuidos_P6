# core/database.py
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Inicializar Firebase
try:
    cred = credentials.Certificate("firebase_credenciales.json") # Busca el archivo en la raíz del backend
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Conectado a Firebase Firestore exitosamente.")
except Exception as e:
    print(f"Error al conectar a Firebase: {e}")
    db = None

