import os
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography.hazmat.primitives import serialization

def generar_par_rsa(nombre_actor, directorio):
    # Genera llaves RSA (Para Cifrar/Descifrar)
    privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    publica = privada.public_key()
    
    with open(os.path.join(directorio, f"{nombre_actor}_privada_rsa.pem"), "wb") as f:
        f.write(privada.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    with open(os.path.join(directorio, f"{nombre_actor}_publica_rsa.pem"), "wb") as f:
        f.write(publica.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print(f"Llaves RSA de {nombre_actor} generadas.")

def generar_par_ecc(nombre_actor, directorio):
    # Genera llaves ECC (Exclusivo para la Firma Digital ECDSA)
    privada = ec.generate_private_key(ec.SECP256R1())
    publica = privada.public_key()
    
    with open(os.path.join(directorio, f"{nombre_actor}_privada_ecc.pem"), "wb") as f:
        f.write(privada.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    with open(os.path.join(directorio, f"{nombre_actor}_publica_ecc.pem"), "wb") as f:
        f.write(publica.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print(f"Llaves ECC de {nombre_actor} generadas.")

if __name__ == '__main__':
    DIR_BASE = os.path.dirname(os.path.abspath(__file__))
    print("Generando infraestructura de llaves completas...")
    
    # Llaves para Cifrar/Descifrar (Confidencialidad)
    generar_par_rsa("medico", DIR_BASE)
    generar_par_rsa("paciente", DIR_BASE)
    generar_par_rsa("farmacia", DIR_BASE)
    
    # Llave para Firmar (Autenticidad e Integridad)
    generar_par_ecc("medico", DIR_BASE)