#!/bin/bash

# Script de Instalación desde Cero para Imagine CRM Pro
# Probado en Ubuntu 20.04 / 22.04 LTS

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   INSTALADOR IMAGINE CRM PRO (VPS SETUP)     ${NC}"
echo -e "${BLUE}==============================================${NC}"

# 1. Comprobar si es root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, ejecuta este script como root (sudo).${NC}"
  exit 1
fi

echo -e "${GREEN}[1/5] Actualizando sistema...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip

# 2. Instalar Docker si no existe
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}[2/5] Instalando Docker & Docker Compose...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo "Docker instalado."
else
    echo -e "${GREEN}[2/5] Docker ya está instalado. Saltando...${NC}"
fi

# 3. Preparar directorio del proyecto (asumiendo que ya se clonó, pero si no, estamos dentro)
# Nos movemos al directorio raíz del proyecto (un nivel arriba de deploy)
cd "$(dirname "$0")/.." || exit

APP_DIR=$(pwd)
echo -e "${GREEN}[3/5] Configurando proyecto en: $APP_DIR${NC}"

# 4. Configurar .env si no existe
if [ ! -f .env ]; then
    echo -e "${GREEN}[4/5] Creando archivo .env desde ejemplo...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${BLUE}IMPORTANTE: Se ha creado el archivo .env.${NC}"
        echo -e "${BLUE}Por favor edítalo con tus secretos reales antes de continuar.${NC}"
        echo -e "${BLUE}Escribe: nano .env${NC}"
        read -p "Presiona ENTER para abrir el editor ahora..."
        nano .env
    else
        echo -e "${RED}No se encontró .env.example. Por favor crea el .env manualmente.${NC}"
    fi
else
    echo -e "${GREEN}[4/5] Archivo .env ya existe. Saltando...${NC}"
fi

# 5. Levantar Docker
echo -e "${GREEN}[5/5] Iniciando contenedores...${NC}"
docker compose up -d --build

echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}¡INSTALACIÓN COMPLETADA!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "Tu CRM debería estar corriendo en el puerto 3000."
echo -e "Verifica los logs con: docker compose logs -f app"
echo -e ""
echo -e "Para crear tu usuario ADMIN (Owner), ejecuta:"
echo -e "docker compose exec mysql mysql -u root -pchange_me chin_crm -e \"UPDATE users SET role='owner' WHERE email='tu@email.com';\""
