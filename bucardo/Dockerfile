# Utilizar la imagen base de Debian
FROM debian:bullseye-slim

# Instalar las dependencias necesarias para Bucardo y PostgreSQL
RUN apt-get update && \
    apt-get install -y postgresql-client postgresql-plperl libdbd-pg-perl \
    libdbix-safe-perl libboolean-perl libdatetime-perl git make gcc perl

# Clonar Bucardo desde su repositorio oficial
RUN git clone https://github.com/bucardo/bucardo.git /opt/bucardo

# Instalar Bucardo
WORKDIR /opt/bucardo
RUN perl Makefile.PL && make && make install

# Crear directorios para la configuración de Bucardo
RUN mkdir -p /etc/bucardo /var/run/bucardo /var/log/bucardo

# Copiar el archivo de configuración de Bucardo
COPY bucardo.conf /etc/bucardo/bucardo.conf

# Establecer el comando por defecto para iniciar Bucardo
CMD ["bucardo", "start"]
