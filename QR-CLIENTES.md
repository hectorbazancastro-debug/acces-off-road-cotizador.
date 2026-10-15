# Acceso temporal para clientes

El personal inicia sesión y genera el QR desde el cotizador. Cada QR dura una hora desde su creación y puede desactivarse antes. El cliente abre una página separada sin cuenta, agrega productos y descarga o imprime su cotización. No se guarda en el historial del personal.

El enlace permite acceder a cualquiera que lo tenga durante su vigencia. No verifica presencia física en la tienda. La caducidad impide nuevas lecturas; no elimina las cotizaciones descargadas.

Firebase entrega únicamente la copia pública del catálogo (sin existencias ni proveedores). Las reglas bloquean la enumeración de enlaces y las lecturas tras su vencimiento o revocación. El cliente revalida al cotizar, exportar, regresar a la página y cada 30 segundos.

Los vendedores tienen catálogo de consulta y cotizador; clientes, reportes, historial y administración no aparecen. Las reglas impiden a vendedores leer la colección de clientes y modificar el catálogo.

## Activación

1. Publicar firestore.rules en el proyecto acces-off-road.
2. Integrar esta rama y desplegar el sitio en Render.
3. Con un usuario aprobado y catálogo cargado, generar un QR y probarlo en un teléfono sin sesión.

## Verificación

20 pruebas de reglas aprobadas en el emulador Firestore (firebase-tools 14.22.0, Java 17). Incluyen vencimiento, revocación, aislamiento del cliente, restricciones de vendedor y protección contra extender la vigencia.

Para repetir: instalar firebase, @firebase/rules-unit-testing y firebase-tools como dependencias de desarrollo, configurar el emulador Firestore en puerto 8088 con firestore.rules y ejecutar `firebase emulators:exec --only firestore --project demo-acces-qr 'node tests/guest-rules.mjs'`.
