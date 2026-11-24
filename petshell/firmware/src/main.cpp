// XCPETS Pet Shell firmware (LilyGO T-Display-S3).
//
// What it does: shows one bonded pet, live. It reads only PUBLIC files: the published world on node.xcpets.fun (the same owner pages
// and pet files the site's fast load and the Telegram mini app read). Press a button for a feed QR: the phone opens xcpets.fun with
// the feed burn ready (the phone hand-off format of js/handoff.js), and the player's own wallet signs it there.
//
// What it never does: it holds NO wallet keys, signs nothing and sends nothing. The only things stored on it are the Wi-Fi name and
// password, a public wallet address, a pet id and the pet's pixel art. All of it arrives over USB from https://xcpets.fun/shell/.
//
// Buttons (both do the same, so it does not matter which is which):
//   press           next screen: pet -> feed QR -> info -> pet
//   hold 1.5 s      check for news now
//   hold 6 s        turn the picture upside down (saved)
// On battery the screen dims after 1 minute and the Pet Shell sleeps after 5 minutes; press the KEY button to wake it.
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <time.h>
#include "lgfx_tdisplay.h"
#include "logic.h"

static const char *FW_VERSION = "1.0.0";
static const char *NODE = "https://node.xcpets.fun";
static const char *SETUP_URL = "https://xcpets.fun/shell/";
static const uint32_t REFRESH_MS = 10UL * 60 * 1000;
static const uint32_t DIM_MS = 60UL * 1000, SLEEP_MS = 5UL * 60 * 1000;
static const int ART_W = 32, ART_H = 32, ART_STAGES = 6, ART_FRAMES = 4;
static const size_t ART_PIX = ART_W * ART_H;
static const size_t ART_BYTES = (size_t)ART_STAGES * ART_FRAMES * ART_PIX * 2;

// colours (RGB565), the site's palette
static const uint16_t C_BG = 0x0862, C_GOLD = 0xFE8C, C_GREEN = 0x4E91, C_RED = 0xF26A, C_TEXT = 0xCE7D, C_DIM = 0x9D18, C_PANEL = 0x18C6;

LGFX_TDisplayS3 lcd;
LGFX_Sprite screen(&lcd);
Preferences prefs;

// ----------------------------------------------------------------------------------------------------------- settings
struct Config {
  String ssid, pass, addr, petName;
  long pet = 0;
  int num = 0;
  bool flip = false;
  bool ok() const { return ssid.length() && addr.length() && pet > 0; }
} cfg;

uint16_t *art = nullptr;   // [stage][frame][pixel], RGB565
bool artLoaded = false;

// ----------------------------------------------------------------------------------------------------------- the pet, as last read
struct PetNow {
  bool valid = false;      // we have read it at least once
  bool owned = false;      // it is still a living pet of this wallet
  bool dead = false, released = false, zombie = false, hungry = false, fedToday = false;
  int stage = 0, tier = 0, streak = 0, wins = 0, losses = 0;
  double nextMeal = 0;
  long care = 0, tip = 0;
  String name, species;
  uint32_t readAt = 0;     // unix time of the read
} pet;

String lastError;
void serviceSerial();
uint32_t lastRefresh = 0, lastInput = 0;
int screenNo = 0;                 // 0 pet, 1 feed QR, 2 info
int frame = 0;
bool busy = false;

// ----------------------------------------------------------------------------------------------------------- storage
void loadConfig() {
  prefs.begin("petshell", true);
  cfg.ssid = prefs.getString("ssid", "");
  cfg.pass = prefs.getString("pass", "");
  cfg.addr = prefs.getString("addr", "");
  cfg.petName = prefs.getString("name", "");
  cfg.pet = prefs.getLong("pet", 0);
  cfg.num = prefs.getInt("num", 0);
  cfg.flip = prefs.getBool("flip", false);
  // last read of the pet, so the screen has something to show at once after waking
  pet.valid = prefs.getBool("pv", false);
  pet.owned = prefs.getBool("po", false);
  pet.dead = prefs.getBool("pd", false);
  pet.hungry = prefs.getBool("ph", false);
  pet.fedToday = prefs.getBool("pf", false);
  pet.zombie = prefs.getBool("pz", false);
  pet.stage = prefs.getInt("ps", 0);
  pet.tier = prefs.getInt("pt", 0);
  pet.streak = prefs.getInt("pk", 0);
  pet.nextMeal = prefs.getDouble("pm", 0);
  pet.tip = prefs.getLong("pp", 0);
  pet.readAt = prefs.getULong("pr", 0);
  pet.name = prefs.getString("pn", cfg.petName);
  prefs.end();
}

void savePet() {
  prefs.begin("petshell", false);
  prefs.putBool("pv", pet.valid); prefs.putBool("po", pet.owned); prefs.putBool("pd", pet.dead); prefs.putBool("ph", pet.hungry);
  prefs.putBool("pf", pet.fedToday); prefs.putBool("pz", pet.zombie); prefs.putInt("ps", pet.stage); prefs.putInt("pt", pet.tier);
  prefs.putInt("pk", pet.streak); prefs.putDouble("pm", pet.nextMeal); prefs.putLong("pp", pet.tip); prefs.putULong("pr", pet.readAt);
  prefs.putString("pn", pet.name);
  prefs.end();
}

void loadArt() {
  artLoaded = false;
  if (!LittleFS.exists("/art.bin")) return;
  File f = LittleFS.open("/art.bin", "r");
  if (!f) return;
  if (f.size() == ART_BYTES && f.read((uint8_t *)art, ART_BYTES) == ART_BYTES) artLoaded = true;
  f.close();
}

// ----------------------------------------------------------------------------------------------------------- drawing
void header() {
  screen.setFont(&fonts::Font8x8C64);
  screen.setTextSize(1);
  screen.setTextDatum(top_left);
  screen.setTextColor(C_GOLD);
  screen.drawString("XCPETS", 6, 5);
  int mv = analogReadMilliVolts(PIN_BAT_VOLT) * 2;
  screen.setTextDatum(top_right);
  if (mv > 4500) { screen.setTextColor(C_GREEN); screen.drawString("USB", 164, 5); }
  else { int p = xp::batteryPercent(mv); screen.setTextColor(p < 20 ? C_RED : C_GREEN); screen.drawString(String(p) + "%", 164, 5); }
}

void drawEggPlaceholder(int x, int y) {
  screen.fillEllipse(x + 80, y + 86, 46, 60, 0xF79E);
  screen.drawEllipse(x + 80, y + 86, 46, 60, 0x0000);
  screen.setFont(&fonts::Font8x8C64); screen.setTextSize(3); screen.setTextDatum(middle_center); screen.setTextColor(0x0000);
  screen.drawString("?", x + 80, y + 90);
}

void drawPetArt(int x, int y) {
  if (!artLoaded) { drawEggPlaceholder(x, y); return; }
  int st = pet.valid ? pet.stage : 3;
  if (st < 0) st = 0;
  if (st > 5) st = 5;
  const uint16_t *px = art + ((size_t)st * ART_FRAMES + (frame % ART_FRAMES)) * ART_PIX;
  for (int j = 0; j < ART_H; j++)
    for (int i = 0; i < ART_W; i++) screen.fillRect(x + i * 5, y + j * 5, 5, 5, px[j * ART_W + i]);
  if (pet.dead || (pet.valid && !pet.owned)) {
    for (int j = 0; j < 160; j += 2) screen.drawFastHLine(x, y + j, 160, 0x0000);   // faded: gone or moved away
  }
}

void centered(const String &s, int y, uint16_t col, int size = 1) {
  screen.setFont(&fonts::Font8x8C64); screen.setTextSize(size); screen.setTextDatum(top_center); screen.setTextColor(col);
  screen.drawString(s, 85, y);
}

String ago() {
  time_t now = time(nullptr);
  if (!pet.readAt || now < 1700000000) return "";
  long m = (now - (long)pet.readAt) / 60;
  if (m < 1) return "just now";
  if (m < 90) return String(m) + " min ago";
  return String(m / 60) + " h ago";
}

void drawPetScreen() {
  header();
  drawPetArt(5, 20);
  String nm = pet.name.length() ? pet.name : (cfg.petName.length() ? cfg.petName : String("#") + cfg.pet);
  if (nm.length() > 12) nm = nm.substring(0, 11) + ".";
  centered(nm, 188, C_GOLD, 2);
  centered(String("#") + cfg.pet + " " + (pet.valid ? xp::stageName(pet.stage) : "") + " " + (pet.valid ? xp::tierName(pet.tier) : ""), 210, C_TEXT);
  if (!pet.valid) {
    centered(lastError.length() ? "CAN'T REACH XCPETS" : "LOADING...", 236, C_DIM);
  } else if (pet.dead) {
    centered("R.I.P.", 232, C_RED, 2);
    centered("visit the cemetery", 254, C_DIM);
  } else if (!pet.owned) {
    centered("NOT IN YOUR WALLET", 234, C_RED);
    centered("pick a new pet at", 252, C_DIM);
    centered("xcpets.fun/shell", 264, C_DIM);
  } else {
    if (pet.zombie) centered("ZOMBIE!", 230, C_GREEN, 2);
    else if (pet.stage >= 5) centered("MYTHIC", 232, C_GOLD, 2);
    else if (pet.fedToday) centered("FED TODAY", 234, C_GREEN, 1);
    else if (pet.hungry) centered((frame & 1) ? "HUNGRY!" : "FEED ME!", 230, C_RED, 2);
    else centered("CHILLING", 234, C_TEXT, 1);
    if (pet.streak > 0) centered(String("STREAK ") + pet.streak + (pet.streak == 1 ? " DAY" : " DAYS"), 256, C_GOLD);
    if (pet.tip) centered(String(xp::blocksLeftToday(pet.tip)) + " blocks left today", 270, C_DIM);
  }
  centered(busy ? "checking..." : ago(), 288, C_DIM);
  centered("PRESS: FEED QR", 304, C_DIM);
}

void drawQrScreen() {
  header();
  if (!pet.valid || !pet.owned || pet.dead) {
    centered("NO FEED NOW", 120, C_RED, 2);
    centered("this pet can't eat", 150, C_DIM);
    return;
  }
  if (pet.stage >= 5 && !pet.zombie) { centered("MYTHICS", 110, C_GOLD, 2); centered("never need food", 136, C_DIM); return; }
  if (pet.fedToday) { centered("ALREADY FED", 110, C_GREEN, 2); centered("come back tomorrow", 136, C_DIM); centered(String(xp::blocksLeftToday(pet.tip)) + " blocks to go", 152, C_DIM); return; }
  time_t now = time(nullptr);
  long long atMs = now > 1700000000 ? (long long)now * 1000LL : 0;
  std::string link = xp::feedLink(cfg.addr.c_str(), cfg.pet, pet.nextMeal, atMs);
  centered("FEED " + (pet.name.length() ? pet.name.substring(0, 10) : String("#") + cfg.pet), 22, C_GOLD);
  screen.fillRect(0, 36, 170, 170, 0xFFFF);
  screen.qrcode(link.c_str(), 3, 39, 164, 6);
  centered("SCAN WITH YOUR PHONE", 214, C_TEXT);
  centered("sign it in your wallet", 230, C_DIM);
  centered("on xcpets.fun", 242, C_DIM);
  centered(String("about ") + xp::amountText(pet.nextMeal).c_str() + " XCPETS", 262, C_GOLD);
  centered("the site checks the price", 278, C_DIM);
  centered("nothing is signed here", 300, C_GREEN);
}

void drawInfoScreen() {
  header();
  centered("PET SHELL", 26, C_GOLD, 2);
  if (cfg.num > 0) centered(String("No. ") + cfg.num + " / 21", 48, C_TEXT);
  String a = cfg.addr;
  centered("WALLET", 72, C_DIM);
  centered(a.length() > 16 ? a.substring(0, 8) + ".." + a.substring(a.length() - 6) : a, 84, C_TEXT);
  centered("WI-FI", 104, C_DIM);
  centered(WiFi.status() == WL_CONNECTED ? cfg.ssid.substring(0, 18) + " (on)" : cfg.ssid.substring(0, 18), 116, C_TEXT);
  if (pet.tip) { centered("CHAIN BLOCK", 136, C_DIM); centered(String(pet.tip), 148, C_TEXT); }
  if (pet.valid && pet.owned) { centered("CARE", 168, C_DIM); centered(String(pet.care), 180, C_TEXT); centered(String("WINS ") + pet.wins + "  LOSSES " + pet.losses, 196, C_TEXT); }
  if (lastError.length()) { centered("LAST PROBLEM", 220, C_RED); centered(lastError.substring(0, 20), 232, C_DIM); }
  centered("hold a button: refresh", 262, C_DIM);
  centered(String("software ") + FW_VERSION, 280, C_DIM);
  centered("NO KEYS INSIDE", 300, C_GREEN);
}

void drawSetupScreen() {
  header();
  centered("HI!", 24, C_GOLD, 3);
  centered("SET ME UP AT", 60, C_TEXT);
  centered("xcpets.fun/shell", 74, C_GOLD);
  screen.fillRect(25, 96, 120, 120, 0xFFFF);
  screen.qrcode(SETUP_URL, 27, 98, 116, 2);
  centered("on a computer with", 228, C_DIM);
  centered("Chrome or Edge,", 240, C_DIM);
  centered("then plug me in", 252, C_DIM);
  centered("with a USB-C cable", 264, C_DIM);
  centered("NO KEYS INSIDE", 300, C_GREEN);
}

void render() {
  screen.fillScreen(C_BG);
  if (!cfg.ok()) drawSetupScreen();
  else if (screenNo == 1) drawQrScreen();
  else if (screenNo == 2) drawInfoScreen();
  else drawPetScreen();
  screen.pushSprite(0, 0);
}

// ----------------------------------------------------------------------------------------------------------- network
// Every file read is public. TLS still runs, but the certificate is not checked (no CA list to keep up to date on the device):
// the worst a fake server could do is show a wrong number. The feed QR is built here from the saved address and pet id,
// and xcpets.fun re-checks everything before a wallet signs, so nothing it reads can redirect a burn.
struct PsramAllocator : ArduinoJson::Allocator {
  void *allocate(size_t n) override { return heap_caps_malloc(n, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT); }
  void deallocate(void *p) override { heap_caps_free(p); }
  void *reallocate(void *p, size_t n) override { return heap_caps_realloc(p, n, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT); }
} psram;

int getJson(const String &url, JsonDocument &doc, JsonDocument &filter) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.useHTTP10(true);        // no chunked replies, so the JSON parser can read the body as it arrives
  http.setTimeout(20000);
  http.setConnectTimeout(10000);
  if (!http.begin(client, url)) return -1;
  http.addHeader("Cache-Control", "no-cache");
  int code = http.GET();
  if (code == 200) {
    DeserializationError e = deserializeJson(doc, http.getStream(), DeserializationOption::Filter(filter));
    if (e) code = -2;
  }
  http.end();
  return code;
}

bool wifiUp() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfg.ssid.c_str(), cfg.pass.c_str());
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) { delay(200); serviceSerial(); }
  if (WiFi.status() != WL_CONNECTED) { lastError = "no Wi-Fi " + cfg.ssid.substring(0, 10); return false; }
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  return true;
}

void wifiDown() {
  if (analogReadMilliVolts(PIN_BAT_VOLT) * 2 > 4500) return;   // on USB power: stay connected
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

// pet fields we keep from the world files
void petFields(JsonObject f) {
  for (const char *k : {"id", "name", "species", "tier", "stage", "care", "dead", "released", "zombie", "hungry", "fedToday", "nextMeal", "feedDays", "wins", "losses"}) f[k] = true;
}

void takePet(JsonObject p, long tip) {
  pet.name = p["name"] | "";
  pet.species = p["species"] | "";
  pet.tier = p["tier"] | 0;
  pet.stage = p["stage"] | 0;
  pet.care = p["care"] | 0L;
  pet.dead = p["dead"] | false;
  pet.released = p["released"] | false;
  pet.zombie = !p["zombie"].isNull() && !(p["zombie"]["end"] | false);
  pet.nextMeal = p["nextMeal"] | 0.0;
  pet.wins = p["wins"] | 0;
  pet.losses = p["losses"] | 0;
  std::vector<long> days;
  JsonVariant fd = p["feedDays"];
  if (fd.is<JsonObject>()) for (JsonPair kv : fd.as<JsonObject>()) { if (kv.value().as<bool>() || kv.value().as<long>()) days.push_back(atol(kv.key().c_str())); }
  else if (fd.is<JsonArray>()) for (JsonVariant v : fd.as<JsonArray>()) days.push_back(v.as<long>());
  bool today = false;
  pet.streak = xp::feedStreak(days, tip, &today);
  pet.fedToday = (p["fedToday"] | false) || today;
  // the world's own flag (it also knows quests and Mythics); our own reading of today's meals as a fallback
  pet.hungry = p["hungry"].isNull() ? (!pet.dead && !pet.released && !pet.fedToday && pet.nextMeal > 0) : (p["hungry"].as<bool>() && !pet.fedToday);
  pet.tip = tip;
}

bool refresh() {
  busy = true; render();
  lastError = "";
  bool ok = false;
  do {
    if (!wifiUp()) break;
    // 1. where the newest published world lives
    JsonDocument f0(&psram), d0(&psram);
    f0["manifest"] = true; f0["url"] = true;
    int c = getJson(String(NODE) + "/xp/v1/world/latest.json", d0, f0);
    if (c != 200) { lastError = String("world ") + c; break; }
    String path = d0["manifest"] | (d0["url"] | "");
    if (!path.length()) { lastError = "no world"; break; }
    String man = path.startsWith("http") ? path : String(NODE) + path;
    String folder = man.substring(0, man.lastIndexOf('/') + 1);
    String hex = xp::sha256hex(cfg.addr.c_str()).c_str();
    String idS = String(cfg.pet);

    // 2. the wallet's first owner page: the first 24 living pets in full, the page count and the ids
    JsonDocument f1(&psram), d1(&psram);
    f1["tip"] = true; f1["pages"] = true; f1["ids"] = true;
    petFields(f1["pets"][0].to<JsonObject>());
    c = getJson(folder + "view/own/" + hex + ".json", d1, f1);
    long tip = d1["tip"] | 0L;
    bool owned = false, have = false;
    if (c == 200) {
      for (JsonVariant v : d1["ids"].as<JsonArray>()) if (v.as<long>() == cfg.pet) owned = true;
      for (JsonObject p : d1["pets"].as<JsonArray>()) if ((p["id"] | 0L) == cfg.pet) { takePet(p, tip); have = true; }
      // 3. later pages hold ids only, in id order: a short search finds the page that would hold our pet
      int pages = d1["pages"] | 1;
      if (!owned && pages > 1) {
        int lo = 1, hi = pages - 1, tries = 0;
        while (lo <= hi && tries++ < 12) {
          int mid = (lo + hi) / 2;
          JsonDocument f2(&psram), d2(&psram);
          f2["ids"] = true;
          if (getJson(folder + "view/own/" + hex + "." + mid + ".json", d2, f2) != 200) break;
          JsonArray ids = d2["ids"].as<JsonArray>();
          if (!ids.size()) break;
          int dir = xp::pageDirection(cfg.pet, ids[0].as<long>(), ids[ids.size() - 1].as<long>());
          if (dir == 0) { for (JsonVariant v : ids) if (v.as<long>() == cfg.pet) owned = true; break; }
          if (dir < 0) hi = mid - 1; else lo = mid + 1;
        }
      }
    } else if (c != 404) { lastError = String("owner page ") + c; break; }
    // 4. the pet's own record (also tells us if it died or left the wallet)
    if (!have) {
      JsonDocument f3(&psram), d3(&psram);
      f3["tip"] = true;
      petFields(f3["pets"][idS].to<JsonObject>());
      c = getJson(folder + "view/p/" + xp::petShardName(cfg.pet).c_str() + ".json", d3, f3);
      if (c != 200) { lastError = String("pet file ") + c; break; }
      if (!tip) tip = d3["tip"] | 0L;
      JsonObject p = d3["pets"][idS];
      if (p.isNull()) { lastError = "pet not found"; break; }
      takePet(p, tip);
    }
    pet.owned = owned && !pet.dead && !pet.released;
    pet.valid = true;
    time_t now = time(nullptr);
    pet.readAt = now > 1700000000 ? (uint32_t)now : 0;
    savePet();
    ok = true;
  } while (false);
  wifiDown();
  lastRefresh = millis();
  busy = false;
  return ok;
}

// ----------------------------------------------------------------------------------------------------------- USB setup (from xcpets.fun/shell)
// One command per line:
//   HELLO                         -> PETSHELL <version>
//   CFG {json}                    ssid, pass, addr, pet, name, num, flip
//   ART <stage> <frame> <base64>  2,048 bytes of RGB565 (little endian) for a 32 x 32 frame
//   SAVE                          store everything and restart
//   INFO                          the saved settings, without the Wi-Fi password
//   FORGET                        erase everything
String line;
Config pending;
bool pendingCfg = false;
uint32_t artMask = 0;
uint8_t *artIn = nullptr;

void reply(const String &s) { Serial.println(s); }

void handleLine(String &l) {
  l.trim();
  if (!l.length()) return;
  if (l == "HELLO") { reply(String("PETSHELL ") + FW_VERSION); return; }
  if (l == "INFO") {
    JsonDocument d;
    d["version"] = FW_VERSION; d["addr"] = cfg.addr; d["pet"] = cfg.pet; d["name"] = cfg.petName; d["num"] = cfg.num; d["ssid"] = cfg.ssid; d["art"] = artLoaded;
    String s; serializeJson(d, s); reply("INFO " + s); return;
  }
  if (l == "FORGET") {
    prefs.begin("petshell", false); prefs.clear(); prefs.end();
    LittleFS.remove("/art.bin");
    reply("OK forgot"); delay(300); ESP.restart(); return;
  }
  if (l.startsWith("CFG ")) {
    JsonDocument d;
    if (deserializeJson(d, l.substring(4))) { reply("ERR bad settings"); return; }
    pending = Config();
    pending.ssid = d["ssid"] | ""; pending.pass = d["pass"] | ""; pending.addr = d["addr"] | ""; pending.petName = d["name"] | "";
    pending.pet = d["pet"] | 0L; pending.num = d["num"] | 0; pending.flip = d["flip"] | false;
    if (!xp::validAddr(pending.addr.c_str())) { reply("ERR that wallet address does not look right"); return; }
    if (pending.pet <= 0) { reply("ERR no pet picked"); return; }
    if (!pending.ssid.length()) { reply("ERR no Wi-Fi name"); return; }
    pendingCfg = true; artMask = 0;
    reply("OK settings"); return;
  }
  if (l.startsWith("ART ")) {
    int a = l.indexOf(' ', 4), b = l.indexOf(' ', a + 1);
    if (a < 0 || b < 0) { reply("ERR art line"); return; }
    int st = l.substring(4, a).toInt(), fr = l.substring(a + 1, b).toInt();
    if (st < 0 || st >= ART_STAGES || fr < 0 || fr >= ART_FRAMES) { reply("ERR art index"); return; }
    uint8_t *dst = artIn + ((size_t)st * ART_FRAMES + fr) * ART_PIX * 2;
    long n = xp::b64decode(l.c_str() + b + 1, l.length() - b - 1, dst, ART_PIX * 2);
    if (n != (long)(ART_PIX * 2)) { reply("ERR art size"); return; }
    artMask |= 1UL << (st * ART_FRAMES + fr);
    reply(String("OK art ") + st + " " + fr); return;
  }
  if (l == "SAVE") {
    if (!pendingCfg) { reply("ERR send settings first"); return; }
    prefs.begin("petshell", false);
    prefs.clear();
    prefs.putString("ssid", pending.ssid); prefs.putString("pass", pending.pass); prefs.putString("addr", pending.addr);
    prefs.putString("name", pending.petName); prefs.putLong("pet", pending.pet); prefs.putInt("num", pending.num); prefs.putBool("flip", pending.flip);
    prefs.end();
    if (artMask == (1UL << (ART_STAGES * ART_FRAMES)) - 1) {
      File f = LittleFS.open("/art.bin", "w");
      if (!f || f.write(artIn, ART_BYTES) != ART_BYTES) { reply("ERR could not save the art"); if (f) f.close(); return; }
      f.close();
    } else {
      LittleFS.remove("/art.bin");
    }
    reply("OK saved");
    Serial.flush();
    delay(400);
    ESP.restart();
    return;
  }
  reply("ERR unknown command");
}

void serviceSerial() {
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n') { handleLine(line); line = ""; }
    else if (line.length() < 6000) line += ch;
  }
}

// ----------------------------------------------------------------------------------------------------------- buttons and power
bool down() { return digitalRead(PIN_BUTTON_1) == LOW || digitalRead(PIN_BUTTON_2) == LOW; }
uint32_t pressedAt = 0;
bool held = false, flipped = false;

void goToSleep() {
  screen.fillScreen(C_BG);
  centered("Zzz", 140, C_DIM, 3);
  centered("press KEY to wake", 180, C_DIM);
  screen.pushSprite(0, 0);
  delay(1200);
  lcd.setBrightness(0);
  lcd.sleep();
  digitalWrite(PIN_POWER_ON, LOW);
  rtc_gpio_pullup_en(GPIO_NUM_14);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_14, 0);
  esp_deep_sleep_start();
}

void buttons() {
  bool d = down();
  uint32_t now = millis();
  if (d && !pressedAt) { pressedAt = now; held = false; flipped = false; lastInput = now; lcd.setBrightness(200); }
  if (d && pressedAt && !held && now - pressedAt > 1500) { held = true; if (cfg.ok()) refresh(); }
  if (d && pressedAt && !flipped && now - pressedAt > 6000) {
    flipped = true; cfg.flip = !cfg.flip; lcd.setRotation(cfg.flip ? 2 : 0);
    prefs.begin("petshell", false); prefs.putBool("flip", cfg.flip); prefs.end();
  }
  if (!d && pressedAt) {
    if (!held && now - pressedAt > 40) { screenNo = (screenNo + 1) % 3; }
    pressedAt = 0;
    render();
  }
}

// ----------------------------------------------------------------------------------------------------------- main
void setup() {
  pinMode(PIN_POWER_ON, OUTPUT);
  digitalWrite(PIN_POWER_ON, HIGH);
  pinMode(PIN_BUTTON_1, INPUT_PULLUP);
  pinMode(PIN_BUTTON_2, INPUT_PULLUP);
  Serial.setRxBufferSize(8192);
  Serial.begin(115200);
  analogReadResolution(12);
  art = (uint16_t *)heap_caps_malloc(ART_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  artIn = (uint8_t *)heap_caps_malloc(ART_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  LittleFS.begin(true);
  loadConfig();
  if (art) loadArt();
  lcd.init();
  lcd.setRotation(cfg.flip ? 2 : 0);
  lcd.setBrightness(200);
  screen.setPsram(true);
  screen.setColorDepth(16);
  screen.createSprite(170, 320);
  // splash
  screen.fillScreen(C_BG);
  centered("XCPETS", 120, C_GOLD, 3);
  centered("PET SHELL", 152, C_TEXT, 1);
  if (cfg.num > 0) centered(String("No. ") + cfg.num + " / 21", 168, C_DIM);
  centered("no keys inside", 300, C_GREEN);
  screen.pushSprite(0, 0);
  delay(900);
  lastInput = millis();
  render();
  if (cfg.ok()) refresh();
  render();
}

uint32_t lastFrame = 0;

void loop() {
  serviceSerial();
  buttons();
  uint32_t now = millis();
  if (cfg.ok() && now - lastRefresh > REFRESH_MS) refresh();
  if (now - lastFrame > 260) {
    lastFrame = now;
    frame++;
    if (!pressedAt) render();
  }
  bool usb = analogReadMilliVolts(PIN_BAT_VOLT) * 2 > 4500;
  if (!usb && now - lastInput > DIM_MS) lcd.setBrightness(40);
  if (!usb && now - lastInput > SLEEP_MS) goToSleep();
  delay(10);
}
