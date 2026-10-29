// ============================================================
// Vision360 - ESP32
//
// Las alarmas viajan por Supabase:
//   App -> tabla public.evento -> ESP32 (WiFi)
//
// Silenciar / detener: la app cambia evento.estado_alarma y el
// ESP32 lo lee en la próxima consulta.
//
// Librerías (Arduino IDE -> Gestor de librerías):
//   - ArduinoJson 7.x
//   WiFi, HTTPClient y Preferences vienen con el core del ESP32.
//
// Placa: "ESP32 Dev Module".
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <string.h>

// ------------------- CONFIGURACIÓN -------------------
const char *WIFI_SSID = "Aula68";
const char *WIFI_PASS = "alumnos24";

const char *SUPABASE_URL = "https://frvximxjzsefbcveicdk.supabase.co";
// Publishable key del proyecto (la misma del .env de la app).
const char *SUPABASE_KEY = "sb_publishable_sA1pzB058BtHCt-Y5S3Zcw_C0RlEjla";
// Tiene que ser EXACTAMENTE el token de supabase/esp32.sql.
const char *DEVICE_TOKEN = "v360_esp32_9f4c2a7b1e6d8053";

// ------------------- PINES -------------------
const int BUZZER_PIN = 19;
const int PIN_ROJO = 22;
const int PIN_VERDE = 21;
const int PIN_AZUL = 18;
const int RELAY_PIN = 23;

// ------------------- TIEMPOS -------------------
const unsigned long INTERVALO_POLL_MS = 2000;  // consultar Supabase
const unsigned long INTERVALO_WIFI_MS = 15000; // reintentar WiFi
const unsigned long TIMEOUT_HTTP_MS = 8000;
const uint32_t CURSOR_INICIAL = 2147483647UL; // "no traigas eventos viejos"

// ------------------- ESTADOS -------------------
enum EstadoAlarma
{
  NORMAL = 0,
  PANICO = 1,
  MEDICA = 2,
  INCENDIO = 3
};

int estadoSistema = NORMAL;
bool buzzerSilenciado = false;

uint32_t ultimoEventoId = 0; // cursor: último evento ya procesado
uint32_t eventoActualId = 0; // alarma que está sonando (0 = ninguna)
bool cursorListo = false;

unsigned long ultimoPoll = 0;
unsigned long ultimoIntentoWifi = 0;
unsigned long inicioAlarma = 0;

Preferences prefs;

// Buzzer no bloqueante
unsigned long buzzerUltimoToggle = 0;
bool buzzerNivel = false;
int buzzerFreq = 0;

// ------------------- DECLARACIONES -------------------
void conectarWiFi();
bool llamarRpc(const String &body, JsonDocument &doc);
bool inicializarCursor();
void consultarServidor();
void aplicarEstado(const char *estado);
bool procesarEvento(const char *tipo);
void detenerAlarma();
void actualizarAlarma(unsigned long ahora);
void setColorRGB(int rojo, int verde, int azul);
void actualizarBuzzer();

// ============================================================
// SETUP
// ============================================================
void setup()
{
  Serial.begin(115200);
  delay(200);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PIN_ROJO, OUTPUT);
  pinMode(PIN_VERDE, OUTPUT);
  pinMode(PIN_AZUL, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  detenerAlarma();
  Serial.println("\n--- VISION360 ESP32 ---");

  prefs.begin("vision360", false);

  if (prefs.getBool("inicializado", false))
  {
    ultimoEventoId = prefs.getUInt("cursor", 0);
    cursorListo = true;
    Serial.printf("Cursor guardado: %u\n", ultimoEventoId);
  }
  else
  {
    // Primera vez: arrancamos desde el final para no repetir
    // alarmas viejas al encender.
    Serial.println("Primer arranque: buscando el último evento...");
  }

  conectarWiFi();
}

// ============================================================
// LOOP
// ============================================================
void loop()
{
  unsigned long ahora = millis();

  if (WiFi.status() != WL_CONNECTED)
  {
    if (ahora - ultimoIntentoWifi >= INTERVALO_WIFI_MS)
    {
      ultimoIntentoWifi = ahora;
      Serial.println("WiFi desconectado, reintentando...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }
  else if (ahora - ultimoPoll >= INTERVALO_POLL_MS)
  {
    ultimoPoll = ahora;
    consultarServidor();
  }

  actualizarAlarma(ahora);
  actualizarBuzzer();
}

// ============================================================
// WIFI
// ============================================================
void conectarWiFi()
{
  Serial.printf("Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 20000)
  {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED)
    Serial.printf("\nWiFi OK. IP: %s\n", WiFi.localIP().toString().c_str());
  else
    Serial.println("\nSin WiFi por ahora. Se reintenta solo.");
}

// ============================================================
// SUPABASE
// ============================================================
bool llamarRpc(const String &body, JsonDocument &doc)
{
  if (WiFi.status() != WL_CONNECTED)
    return false;

  WiFiClientSecure client;
  client.setInsecure(); // Proyecto escolar: no validamos el certificado.

  HTTPClient http;
  http.setTimeout(TIMEOUT_HTTP_MS);

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/esp32_poll";
  if (!http.begin(client, url))
  {
    Serial.println("No se pudo iniciar HTTP");
    return false;
  }

  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  int codigo = http.POST(body);
  bool ok = false;

  if (codigo == 200)
  {
    String payload = http.getString();
    DeserializationError error = deserializeJson(doc, payload);
    if (error)
    {
      Serial.printf("Error JSON: %s\n", error.c_str());
      Serial.println(payload);
    }
    else
    {
      ok = true;
    }
  }
  else
  {
    Serial.printf("HTTP %d en esp32_poll: %s\n", codigo,
                  http.getString().c_str());
  }

  http.end();
  return ok;
}

bool inicializarCursor()
{
  // p_after enorme => no trae eventos, solo el último id.
  String body = String("{\"p_token\":\"") + DEVICE_TOKEN +
                "\",\"p_after\":" + String(CURSOR_INICIAL) +
                ",\"p_evento_actual\":0}";

  JsonDocument doc;
  if (!llamarRpc(body, doc))
    return false;

  ultimoEventoId = (uint32_t)(doc["ultimo_id"] | 0);
  prefs.putUInt("cursor", ultimoEventoId);
  prefs.putBool("inicializado", true);
  Serial.printf("Cursor inicial: %u\n", ultimoEventoId);
  return true;
}

void consultarServidor()
{
  if (!cursorListo)
  {
    cursorListo = inicializarCursor();
    return;
  }

  String body = String("{\"p_token\":\"") + DEVICE_TOKEN +
                "\",\"p_after\":" + String(ultimoEventoId) +
                ",\"p_evento_actual\":" + String(eventoActualId) + "}";

  JsonDocument doc;
  if (!llamarRpc(body, doc))
    return;

  // 1. Estado de la alarma que está sonando (silenciar / detener).
  aplicarEstado(doc["estado_actual"] | "");

  // 2. Eventos nuevos.
  uint32_t cursorAnterior = ultimoEventoId;
  JsonArray eventos = doc["eventos"].as<JsonArray>();

  for (JsonObject evento : eventos)
  {
    uint32_t id = (uint32_t)(evento["id_evento"] | 0);
    const char *tipo = evento["tipo"] | "";

    Serial.printf("Evento %u: %s\n", id, tipo);

    if (procesarEvento(tipo))
      eventoActualId = id;

    if (id > ultimoEventoId)
      ultimoEventoId = id;
  }

  // Si la secuencia se reinició, acomodamos el cursor.
  uint32_t ultimoId = (uint32_t)(doc["ultimo_id"] | 0);
  if (ultimoId > 0 && ultimoId < ultimoEventoId)
    ultimoEventoId = ultimoId;

  // Guardamos en NVS solo si cambió (evita desgaste de la flash).
  if (ultimoEventoId != cursorAnterior)
  {
    prefs.putUInt("cursor", ultimoEventoId);
    Serial.printf("Cursor actualizado: %u\n", ultimoEventoId);
  }
}

// ============================================================
// CONTROL DE LA ALARMA
// ============================================================
void aplicarEstado(const char *estado)
{
  if (estado == NULL || estado[0] == '\0')
    return;

  if (strcmp(estado, "detenida") == 0)
  {
    if (estadoSistema != NORMAL)
      Serial.println("Estado remoto: DETENIDA");
    detenerAlarma();
    eventoActualId = 0;
  }
  else if (strcmp(estado, "silenciada") == 0)
  {
    if (!buzzerSilenciado)
      Serial.println("Estado remoto: SILENCIADA");
    buzzerSilenciado = true;
  }
  else if (strcmp(estado, "activa") == 0)
  {
    buzzerSilenciado = false;
  }
}

// Devuelve true si el evento es una alarma (activa el hardware).
bool procesarEvento(const char *tipo)
{
  int nuevoEstado = NORMAL;

  if (strcasecmp(tipo, "panico") == 0)
    nuevoEstado = PANICO;
  else if (strcasecmp(tipo, "emergencia") == 0)
    nuevoEstado = MEDICA;
  else if (strcasecmp(tipo, "incendio") == 0)
    nuevoEstado = INCENDIO;
  else
  {
    // "manual" o "movimiento" no hacen sonar el hardware.
    Serial.println("Evento informativo, no activa alarma");
    return false;
  }

  estadoSistema = nuevoEstado;
  buzzerSilenciado = false;
  inicioAlarma = millis();
  Serial.printf("ALARMA ACTIVADA: %s\n", tipo);
  return true;
}

void detenerAlarma()
{
  estadoSistema = NORMAL;
  buzzerSilenciado = false;
  buzzerFreq = 0;
  buzzerNivel = false;

  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  setColorRGB(0, 40, 0); // verde tenue = normal
}

void actualizarAlarma(unsigned long ahora)
{
  if (estadoSistema == NORMAL)
  {
    digitalWrite(RELAY_PIN, LOW);
    buzzerFreq = 0;
    setColorRGB(0, 40, 0);
    return;
  }

  digitalWrite(RELAY_PIN, HIGH);
  unsigned long t = ahora - inicioAlarma;

  switch (estadoSistema)
  {
  case PANICO:
    setColorRGB(255, 0, 0); // rojo fijo
    if (buzzerSilenciado)
    {
      buzzerFreq = 0;
    }
    else
    {
      // Sirena: sube y baja cada 600 ms
      unsigned long fase = t % 1200;
      if (fase < 600)
        buzzerFreq = 700 + (fase * 2); // 700 -> 1900 Hz
      else
        buzzerFreq = 1900 - ((fase - 600) * 2); // 1900 -> 700 Hz
    }
    break;

  case MEDICA:
  {
    bool encendido = (t % 1000) < 500;
    setColorRGB(0, 0, encendido ? 255 : 0);
    buzzerFreq = (!buzzerSilenciado && (t % 1000) < 200) ? 1000 : 0;
    break;
  }

  case INCENDIO:
  {
    bool encendido = (t % 500) < 250;
    setColorRGB(encendido ? 255 : 0, encendido ? 40 : 0, 0);
    buzzerFreq = (!buzzerSilenciado && (t % 500) < 100) ? 3000 : 0;
    break;
  }
  }
}

// ============================================================
// SALIDAS
// ============================================================
void setColorRGB(int rojo, int verde, int azul)
{
  analogWrite(PIN_ROJO, rojo);
  analogWrite(PIN_VERDE, verde);
  analogWrite(PIN_AZUL, azul);
}

void actualizarBuzzer()
{
  if (buzzerFreq <= 0)
  {
    if (buzzerNivel)
    {
      digitalWrite(BUZZER_PIN, LOW);
      buzzerNivel = false;
    }
    return;
  }

  unsigned long medioPeriodo = (1000000UL / (unsigned long)buzzerFreq) / 2;
  if (medioPeriodo < 10)
    medioPeriodo = 10;

  if (micros() - buzzerUltimoToggle >= medioPeriodo)
  {
    buzzerUltimoToggle = micros();
    buzzerNivel = !buzzerNivel;
    digitalWrite(BUZZER_PIN, buzzerNivel ? HIGH : LOW);
  }
}
