// LovyanGFX setup for the LilyGO T-Display-S3 (ESP32-S3, 1.9" ST7789 170x320 on an 8-bit parallel bus).
// Pins from LilyGO's own examples (github.com/Xinyuan-LilyGO/T-Display-S3, examples/*/pin_config.h).
#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>

static const int PIN_POWER_ON = 15;   // must be HIGH to power the screen (and the battery on battery power)
static const int PIN_BUTTON_1 = 0;    // BOOT
static const int PIN_BUTTON_2 = 14;   // KEY
static const int PIN_BAT_VOLT = 4;    // battery voltage through a 1:2 divider

class LGFX_TDisplayS3 : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 panel_;
  lgfx::Bus_Parallel8 bus_;
  lgfx::Light_PWM light_;

 public:
  LGFX_TDisplayS3() {
    {
      auto cfg = bus_.config();
      cfg.freq_write = 20000000;
      cfg.pin_wr = 8;
      cfg.pin_rd = 9;
      cfg.pin_rs = 7;  // D/C
      cfg.pin_d0 = 39; cfg.pin_d1 = 40; cfg.pin_d2 = 41; cfg.pin_d3 = 42;
      cfg.pin_d4 = 45; cfg.pin_d5 = 46; cfg.pin_d6 = 47; cfg.pin_d7 = 48;
      bus_.config(cfg);
      panel_.setBus(&bus_);
    }
    {
      auto cfg = panel_.config();
      cfg.pin_cs = 6;
      cfg.pin_rst = 5;
      cfg.pin_busy = -1;
      cfg.panel_width = 170;
      cfg.panel_height = 320;
      cfg.offset_x = 35;
      cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.readable = false;
      cfg.invert = true;
      cfg.rgb_order = false;
      cfg.dlen_16bit = false;
      cfg.bus_shared = false;
      panel_.config(cfg);
    }
    {
      auto cfg = light_.config();
      cfg.pin_bl = 38;
      cfg.invert = false;
      cfg.freq = 22000;
      cfg.pwm_channel = 7;
      light_.config(cfg);
      panel_.setLight(&light_);
    }
    setPanel(&panel_);
  }
};
