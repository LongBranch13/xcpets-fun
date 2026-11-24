// XCPETS Pet Shell: the small pure helpers (no Arduino, no network), so they can be tested on a computer.
// tools/petshell-test.js compiles this file with g++ and checks it against js/handoff.js (the phone hand-off code format).
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string>
#include <vector>
#include <cstdio>
#include <cmath>

namespace xp {

// ------------------------------------------------------------------------------------------- base64 (standard and url-safe)
static const char *B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

inline std::string b64url(const std::string &in) {
  std::string out;
  size_t i = 0;
  while (i + 2 < in.size()) {
    uint32_t n = ((uint8_t)in[i] << 16) | ((uint8_t)in[i + 1] << 8) | (uint8_t)in[i + 2];
    out += B64[(n >> 18) & 63]; out += B64[(n >> 12) & 63]; out += B64[(n >> 6) & 63]; out += B64[n & 63];
    i += 3;
  }
  if (i + 1 == in.size()) {
    uint32_t n = ((uint8_t)in[i] << 16);
    out += B64[(n >> 18) & 63]; out += B64[(n >> 12) & 63];
  } else if (i + 2 == in.size()) {
    uint32_t n = ((uint8_t)in[i] << 16) | ((uint8_t)in[i + 1] << 8);
    out += B64[(n >> 18) & 63]; out += B64[(n >> 12) & 63]; out += B64[(n >> 6) & 63];
  }
  for (auto &c : out) { if (c == '+') c = '-'; else if (c == '/') c = '_'; }
  return out;
}

inline int b64val(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+' || c == '-') return 62;
  if (c == '/' || c == '_') return 63;
  return -1;
}

// decodes standard or url-safe base64 (padding optional) into out; returns the number of bytes, or -1 on a bad character / too long
inline long b64decode(const char *s, size_t len, uint8_t *out, size_t cap) {
  uint32_t acc = 0; int bits = 0; size_t n = 0;
  for (size_t i = 0; i < len; i++) {
    char c = s[i];
    if (c == '=' || c == '\r' || c == '\n') continue;
    int v = b64val(c);
    if (v < 0) return -1;
    acc = (acc << 6) | (uint32_t)v; bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (n >= cap) return -1;
      out[n++] = (uint8_t)((acc >> bits) & 0xFF);
    }
  }
  return (long)n;
}

// ------------------------------------------------------------------------------------------- addresses and amounts
inline bool isAddrChar58(char c) { return (c >= '1' && c <= '9') || (c >= 'A' && c <= 'H') || (c >= 'J' && c <= 'N') || (c >= 'P' && c <= 'Z') || (c >= 'a' && c <= 'k') || (c >= 'm' && c <= 'z'); }
inline bool isBech32Char(char c) { return (c >= '0' && c <= '9' && c != '1') || (c >= 'a' && c <= 'z' && c != 'b' && c != 'i' && c != 'o'); }

// same rule as js/handoff.js isAddr(): legacy 1.../3... or bech32 bc1...
inline bool validAddr(const std::string &a) {
  if (a.size() >= 14 && a.compare(0, 3, "bc1") == 0) {
    if (a.size() > 90) return false;
    for (size_t i = 3; i < a.size(); i++) if (!isBech32Char(a[i])) return false;
    return true;
  }
  if (a.size() >= 26 && a.size() <= 35 && (a[0] == '1' || a[0] == '3')) {
    for (size_t i = 1; i < a.size(); i++) if (!isAddrChar58(a[i])) return false;
    return true;
  }
  return false;
}

// an XCPETS amount as a JSON number: at most 8 decimals, no trailing zeros
inline std::string amountText(double v) {
  if (!(v > 0) || !std::isfinite(v)) v = 1;
  char buf[48];
  long long sats = (long long)std::llround(v * 1e8);
  long long whole = sats / 100000000LL, frac = sats % 100000000LL;
  if (frac == 0) { snprintf(buf, sizeof buf, "%lld", whole); return buf; }
  snprintf(buf, sizeof buf, "%lld.%08lld", whole, frac);
  std::string s(buf);
  while (!s.empty() && s.back() == '0') s.pop_back();
  return s;
}

// ------------------------------------------------------------------------------------------- the feed QR
// The phone hand-off link (js/handoff.js, format v1): https://xcpets.fun/play.html#xh=<base64url JSON {v, a, p:[[tag, amount]], at}>.
// The site re-prices the meal from the live world and runs every usual check before the player's own wallet asks to sign.
// Kept short on purpose: a shorter link makes a bigger, easier QR on the small screen.
inline std::string feedLink(const std::string &addr, long petId, double amount, long long atMs) {
  std::string j = "{\"v\":1,\"a\":\"" + addr + "\",\"p\":[[\"pet:feed:" + std::to_string(petId) + "\"," + amountText(amount) + "]]";
  if (atMs > 0) j += ",\"at\":" + std::to_string(atMs);
  j += "}";
  return "https://xcpets.fun/play.html#xh=" + b64url(j);
}


// ------------------------------------------------------------------------------------------- sha256 (owner pages are named by sha256 of the address)
inline std::string sha256hex(const std::string &msg) {
  static const uint32_t K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
    0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
    0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
    0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
  uint32_t h[8] = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
  std::string m = msg;
  uint64_t bitlen = (uint64_t)msg.size() * 8;
  m += (char)0x80;
  while (m.size() % 64 != 56) m += (char)0;
  for (int i = 7; i >= 0; i--) m += (char)((bitlen >> (i * 8)) & 0xff);
  auto ror = [](uint32_t x, int n) { return (x >> n) | (x << (32 - n)); };
  for (size_t off = 0; off < m.size(); off += 64) {
    uint32_t w[64];
    for (int i = 0; i < 16; i++)
      w[i] = ((uint32_t)(uint8_t)m[off + i * 4] << 24) | ((uint32_t)(uint8_t)m[off + i * 4 + 1] << 16) | ((uint32_t)(uint8_t)m[off + i * 4 + 2] << 8) | (uint8_t)m[off + i * 4 + 3];
    for (int i = 16; i < 64; i++) {
      uint32_t s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >> 3);
      uint32_t s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (int i = 0; i < 64; i++) {
      uint32_t S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25), ch = (e & f) ^ (~e & g), t1 = hh + S1 + ch + K[i] + w[i];
      uint32_t S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = S0 + mj;
      hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  char out[65];
  for (int i = 0; i < 8; i++) snprintf(out + i * 8, 9, "%08x", (unsigned)h[i]);
  return std::string(out, 64);
}

// the published world puts 2,000 pets in each pet file: view/p/<5 digits>.json
inline std::string petShardName(long id) { char b[16]; snprintf(b, sizeof b, "%05ld", id / 2000); return b; }

// ------------------------------------------------------------------------------------------- game time
static const long DAY_BLOCKS = 144;          // a new chain day every 144 blocks
inline long chainDay(long tip) { return tip / DAY_BLOCKS; }
inline long blocksLeftToday(long tip) { return DAY_BLOCKS - (tip % DAY_BLOCKS); }

// feed streak from the pet's feedDays (days it ate), same as tools/sync-server/split.js streakAt():
// today counts if fed; if not fed yet today the streak is still alive until the day ends
inline int feedStreak(const std::vector<long> &fedDays, long tip, bool *fedToday) {
  long d0 = chainDay(tip);
  auto has = [&](long d) { for (long x : fedDays) if (x == d) return true; return false; };
  bool today = has(d0);
  if (fedToday) *fedToday = today;
  long d = today ? d0 : d0 - 1;
  int n = 0;
  while (has(d) && n < 100000) { n++; d--; }
  return n;
}

// ------------------------------------------------------------------------------------------- owner pages
// Owner pages list a wallet's living pets in id order, PAGE (24) per page. Given the first and last id of a page,
// which way should the search go? -1 = earlier pages, +1 = later pages, 0 = it would be on this page.
inline int pageDirection(long id, long firstId, long lastId) {
  if (id < firstId) return -1;
  if (id > lastId) return 1;
  return 0;
}

// ------------------------------------------------------------------------------------------- battery
// LiPo voltage (millivolts) to a rough percentage
inline int batteryPercent(int mv) {
  static const int T[][2] = {{4180, 100}, {4100, 92}, {4000, 80}, {3900, 66}, {3800, 50}, {3740, 38}, {3680, 25}, {3600, 12}, {3500, 5}, {3300, 0}};
  if (mv >= T[0][0]) return 100;
  for (int i = 1; i < 10; i++) {
    if (mv >= T[i][0]) {
      int a = T[i][0], b = T[i - 1][0], pa = T[i][1], pb = T[i - 1][1];
      return pa + (pb - pa) * (mv - a) / (b - a);
    }
  }
  return 0;
}

static const char *STAGES[] = {"Egg", "Hatchling", "Juvenile", "Adult", "Elder", "Mythic"};
static const char *TIERS[] = {"Common", "Uncommon", "Rare", "Legendary"};
inline const char *stageName(int s) { return (s >= 0 && s <= 5) ? STAGES[s] : "?"; }
inline const char *tierName(int t) { return (t >= 0 && t <= 3) ? TIERS[t] : "?"; }

}  // namespace xp
