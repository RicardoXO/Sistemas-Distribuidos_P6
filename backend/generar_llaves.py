import os
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def generar_par_llaves_medico():
    print("Generando par de llaves ECC para el Médico...")

    # 1. Generar la llave privada usando la curva SECP256R1
    # Esta curva es el estándar de la industria y es perfecta para usar ECDSA después
    llave_privada = ec.generate_private_key(ec.SECP256R1())
    
    # 2. Derivar la llave pública a partir de la privada
    llave_publica = llave_privada.public_key()
    
    # --- Configuración de Rutas Seguras ---
    # Obtenemos la dirección base exacta desde donde se está ejecutando el script
    directorio_base = os.path.dirname(os.path.abspath(__file__))
    
    # 3. Guardar la Llave Privada
    # Usamos os.path.join para que Python maneje las barras (/, \) correctamente según tu sistema
    ruta_privada = os.path.join(directorio_base, "medico_privada.pem")
    with open(ruta_privada, "wb") as f:
        f.write(llave_privada.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption() # Sin contraseña por ahora para el PoC
        ))
        
    # 4. Guardar la Llave Pública
    ruta_publica = os.path.join(directorio_base, "medico_publica.pem")
    with open(ruta_publica, "wb") as f:
        f.write(llave_publica.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))

    print(f"¡Éxito! Llaves generadas en la ruta:\n{directorio_base}")
    return llave_privada, llave_publica

if __name__ == '__main__':
    generar_par_llaves_medico()