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

## Pasos para la puesta en marcha (sin plan Blaze)

1. Firebase Console > Authentication > Usuarios > Agregar usuario. Crear al administrador maestro con su correo propio y una contraseña que **no se debe compartir**. Copiar su UID de la lista de usuarios.
2. Sustituir `REEMPLAZAR_UID_MAESTRO` por ese UID en `firestore.rules` **y** `firebase-multiusuario.js` de esta rama. El rol propietario se asigna por UID validado por Firebase Auth, nunca por correo no verificado ni por orden de alta.
3. Abrir Firestore > Reglas, pegar las reglas actualizadas y pulsar Publicar. Mantener modo de producción: no abrir temporalmente la base de datos.
4. Authentication > Configuración > Dominios autorizados: agregar `acces-off-road-cotizador.onrender.com` si no se encuentra. Nunca compartir contraseñas ni claves privadas de servicio.
5. Solo después de publicar las reglas, fusionar la rama `preparacion-multiusuario-firebase` hacia `main` de ACCES y desplegar manualmente el mismo sitio estático gratuito de Render. No editar repositorios ni bases de 7K.
6. Entrar como propietario y usar el botón **Cargar los 42 productos de muestra a Firebase**. Crear cuenta de prueba de vendedor, aprobarla desde Usuarios y comprobar que el vendedor no puede editar el catálogo ni ver cotizaciones de otros vendedores.
7. Verificar recuperación de contraseñas, cotización desde dos dispositivos, permisos y respaldos manuales. No se sincronizan automáticamente los datos antiguos guardados en el navegador: deben migrarse solo con aprobación explícita.

Estado a 14 de octubre de 2026: código integrado en rama aislada; **no publicado en producción**. Falta UID del dueño y publicación manual de reglas de Firebase. Ningún servicio de pago activado.
