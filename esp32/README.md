# Conexión app ↔ ESP32 (Vision360)

La app y el ESP32 **no se hablan directo**. Supabase es el puente y se usa
únicamente la tabla `evento` que ya existe:

```
App (botón pánico / incendio / emergencia)
        │  inserta una fila en public.evento
        ▼
   Supabase (Postgres)  ← evento.estado_alarma
        ▲  esp32_poll() cada 2 s con un token
        │
     ESP32 (WiFi)
```

Así funciona aunque el celular esté con datos móviles y el ESP32 en otra red.

## 1. Preparar Supabase

1. Abrí el proyecto en [supabase.com](https://supabase.com).
2. Entrá a **SQL Editor**.
3. Pegá y ejecutá completo `supabase/esp32.sql`.

El script **no crea tablas**. Solo agrega dos funciones:

| Función | Para qué |
| --- | --- |
| `esp32_poll(p_token, p_after, p_evento_actual)` | El ESP32 recibe los eventos nuevos y el estado de la alarma que está sonando. |
| `marcar_estado_alarma(p_id_evento, p_estado)` | La app cambia `estado_alarma` a `silenciada` o `detenida`. |

> El token que viene por defecto es `v360_esp32_9f4c2a7b1e6d8053`.
> Cambialo por uno propio en el SQL **y** en el `.ino`.

Verificación rápida:

```sql
select id_evento, tipo, estado_alarma, fecha_hora
  from public.evento
 order by id_evento desc
 limit 10;
```

## 2. Cargar el ESP32

Abrí `esp32/esp32code/esp32code.ino` en Arduino IDE.

Instalá la librería **ArduinoJson** (Gestor de librerías → buscar
"ArduinoJson" → versión 7.x). `WiFi`, `HTTPClient` y `Preferences` ya vienen
con el core del ESP32.

Revisá estas constantes:

```cpp
const char *WIFI_SSID = "HULGUO";
const char *WIFI_PASS = "alumnos24";
const char *SUPABASE_KEY = "sb_publishable_...";   // la misma del .env
const char *DEVICE_TOKEN = "v360_esp32_9f4c2a7b1e6d8053";
```

Placa: **ESP32 Dev Module**. Subí el sketch y abrí el Monitor Serie a
**115200 baudios**.

Si todo está bien vas a ver:

```
WiFi OK. IP: 192.168.x.x
Cursor inicial: 12
```

En el primer arranque el ESP32 se posiciona en el último evento existente para
no repetir alarmas viejas. Después guarda el cursor en su memoria.

## 3. Probar

1. Abrí la app y tocá **PÁNICO**, **INCENDIO** o **MÉDICA**.
2. En el monitor serie debería aparecer `Evento N: panico` (o el tipo).
3. El hardware reacciona:
   - Pánico → LED rojo + sirena + relay.
   - Médica → LED azul intermitente + beep.
   - Incendio → LED naranja intermitente + beep.
4. En la app aparece el panel **CONTROL DE ALARMA** con **SILENCIAR** y
   **DETENER**. También podés entrar desde el menú lateral → **Control ESP32**.

### Silenciar vs. detener

| Acción | `estado_alarma` | Hardware |
| --- | --- | --- |
| Silenciar | `silenciada` | Apaga el buzzer. LED y relay siguen activos. |
| Detener | `detenida` | Apaga buzzer, LED y relay. |
| Nueva alarma | `activa` | Vuelve a sonar normalmente. |

## 4. Conexiones

| Elemento | Pin ESP32 |
| --- | --- |
| Buzzer pasivo | 19 |
| LED RGB – rojo | 22 |
| LED RGB – verde | 21 |
| LED RGB – azul | 18 |
| Relay | 23 |

El relay se activa en HIGH. Si tu módulo relay es activo en LOW, invertí los
`digitalWrite` o usá un inversor.

## Problemas comunes

| Síntoma | Causa |
| --- | --- |
| `HTTP 401` | La `SUPABASE_KEY` está mal copiada. |
| `HTTP 404` | No ejecutaste `supabase/esp32.sql` o la función no se creó. |
| `HTTP 400` / `Token de dispositivo inválido` | El `DEVICE_TOKEN` del `.ino` no coincide con el del SQL. |
| El ESP32 no recibe nada | Revisá que el evento esté en `evento` y que el ESP32 tenga WiFi. |
| La alarma no se detiene | Entrá a **Control ESP32** y tocá **DETENER**; verificá el monitor serie. |
| La app no guarda el evento | Revisá las políticas RLS de `evento` para usuarios logueados. |

## Notas

- El ESP32 usa la *publishable key* (segura para clientes) y un token propio.
  **No** usa la `service_role`.
- Las funciones son `SECURITY DEFINER`: el rol `anon` no puede leer ni escribir
  la tabla `evento` directamente.
- `setInsecure()` desactiva la validación del certificado TLS para simplificar
  el proyecto escolar. En producción se debería cargar el certificado raíz.
- El estado se guarda en `evento.estado_alarma`, así que el ESP32 se pone al día
  aunque haya perdido un cambio de estado por un corte de WiFi.
