# ACCES OFF-ROAD — preparación del acceso multiusuario

Esta rama NO cambia la aplicación publicada ni modifica 7K.

Backend elegido: Firebase Authentication (correo y contraseña) + Cloud Firestore, plan Spark **sin facturación**. El sitio seguirá en Render.

Estado: **PREPARADO, NO ACTIVADO**. Para habilitar sesiones reales falta conectar/autorizar un proyecto de Firebase independiente, habilitar Authentication (Email/Password), crear Firestore, configurar dominio autorizado y publicar las reglas.

Principales permisos previstos:
- Administrador maestro: administra vendedores, catálogo, clientes, cotizaciones y reportes.
- Administrador: aprueba y bloquea vendedores; no puede nombrar nuevos administradores.
- Vendedor: cuenta con aprobación previa; puede cotizar, administrar sus propios clientes y consultar únicamente sus cotizaciones. Puede consultar catálogo y vehículos.
- Usuarios pendientes o bloqueados: sin acceso a datos comerciales.

No registrar contraseñas en Firestore, en GitHub ni en el navegador. La autenticación será administrada por Firebase Auth.

Seguridad: la clave `REEMPLAZAR_UID_MAESTRO` en firestore.rules debe sustituirse por el UID auténtico del administrador maestro antes de desplegar reglas. No crear permisos abiertos para facilitar pruebas.

**No usar base de datos Free de Render** para las cotizaciones: sus datos caducan a 30 días, y Render Key Value gratuito pierde los datos en reinicios.

El catálogo inicial seguirá siendo el de muestra sin conexiones a precios en línea. Todo ACCES estará separado de proyectos, usuarios y bases de 7K.
