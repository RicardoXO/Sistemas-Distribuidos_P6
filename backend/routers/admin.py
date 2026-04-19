# routers/admin.py
from fastapi import APIRouter, Depends, HTTPException
from core.security import verificar_token
from core.database import db

router = APIRouter(tags=["Administrador"])

@router.get("/admin/usuarios")
def obtener_todos_usuarios(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores.")
    
    usuarios = {}
    docs = db.collection("usuarios").stream()
    for doc in docs:
        datos = doc.to_dict()
        datos.pop("password", None) 
        usuarios[doc.id] = datos
        
    return usuarios

@router.get("/admin/recetas")
def obtener_todas_recetas(usuario_actual: dict = Depends(verificar_token)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores.")
    
    recetas = {}
    docs = db.collection("recetas").stream()
    for doc in docs:
        recetas[doc.id] = doc.to_dict()
        
    return recetas