# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, medico, paciente, farmacia, admin

app = FastAPI(title="API E2EE - Firebase Cloud Modular")

# Permitir conexión con React
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",       # Para tus pruebas locales
        "http://127.0.0.1:5173",       # Variante de localhost
        "https://secure-eprescriptions.vercel.app" # Para cuando subas a producción
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectar todos los módulos
app.include_router(auth.router)
app.include_router(medico.router)
app.include_router(paciente.router)
app.include_router(farmacia.router)
app.include_router(admin.router)

print("🚀 Servidor FastAPI estructurado correctamente.")