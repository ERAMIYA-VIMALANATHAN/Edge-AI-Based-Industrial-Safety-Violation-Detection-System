# ESP8266 Safety Alarm

ESP8266 firmware for the industrial safety alarm controller. It drives an OLED display, buzzer, and vibration motor, and exposes alarm controls over a local HTTP server.

Install the ESP8266 board support package, Adafruit GFX Library, and Adafruit SSD1306 through the Arduino IDE Library Manager. Update the Wi-Fi values at the top of `esp8266_safety_alarm.ino` before uploading.

Default pin mapping:

- Buzzer: `D5`
- Motor: `D7`
- Button: `D6`