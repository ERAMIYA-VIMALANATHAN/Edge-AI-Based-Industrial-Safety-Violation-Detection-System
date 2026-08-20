#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>


// -------- WiFi --------

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";


// -------- OLED --------

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);


// -------- Hardware Pins --------

#define BUZZER D5
#define MOTOR  D7
#define BUTTON D6


ESP8266WebServer server(80);


// -------- Alarm State --------

bool alarmActive = false;

bool lastButtonState = HIGH;

unsigned long lastDebounceMs = 0;



// -------- OLED Function --------

void showDisplay(String line1, String line2)
{

  display.clearDisplay();

  display.setTextSize(1);

  display.setTextColor(SSD1306_WHITE);


  display.setCursor(0,10);
  display.println(line1);


  display.setCursor(0,30);
  display.println(line2);


  display.display();

}



// -------- Hardware Control --------

void setAlarmState(bool state)
{

  alarmActive = state;


  digitalWrite(
    BUZZER,
    state ? HIGH : LOW
  );


  digitalWrite(
    MOTOR,
    state ? HIGH : LOW
  );

}



// -------- Backend Data Handler --------

void handlePpeUpdate()
{

  String body = server.arg("plain");


  Serial.println("----------------");
  Serial.println("Backend Data Received:");
  Serial.println(body);



  bool helmetMissing =
      body.indexOf("\"helmetMissing\":true") >= 0 ||
      body.indexOf("\"missingPpe\":[\"helmet\"") >= 0;



  bool vestMissing =
      body.indexOf("\"vestMissing\":true") >= 0 ||
      body.indexOf("\"missingPpe\":[\"vest\"") >= 0;



  bool alarm =
      body.indexOf("\"alarm\":true") >= 0 ||
      body.indexOf("\"status\":\"violation\"") >= 0;



  Serial.print("Helmet Missing: ");
  Serial.println(helmetMissing);


  Serial.print("Vest Missing: ");
  Serial.println(vestMissing);


  Serial.print("Alarm: ");
  Serial.println(alarm);



  // -------- Decision --------


  if(helmetMissing && vestMissing)
  {

    showDisplay(
      "HELMET + VEST",
      "MISSING"
    );

    setAlarmState(true);

  }


  else if(helmetMissing)
  {

    showDisplay(
      "HELMET",
      "MISSING"
    );

    setAlarmState(true);

  }


  else if(vestMissing)
  {

    showDisplay(
      "VEST",
      "MISSING"
    );

    setAlarmState(true);

  }


  else if(alarm)
  {

    showDisplay(
      "PPE ALERT",
      "Violation"
    );

    setAlarmState(true);

  }


  else
  {

    showDisplay(
      "PPE STATUS",
      "SAFE"
    );

    setAlarmState(false);

  }



  server.send(
    200,
    "application/json",
    "{\"ok\":true}"
  );

}



// -------- Browser Test --------

void handleRoot()
{

  server.send(
    200,
    "text/plain",
    "ESP8266 PPE Monitoring Server Running"
  );

}



// -------- Setup --------

void setup()
{

  Serial.begin(115200);


  pinMode(BUZZER, OUTPUT);

  pinMode(MOTOR, OUTPUT);

  pinMode(BUTTON, INPUT_PULLUP);



  digitalWrite(BUZZER, LOW);

  digitalWrite(MOTOR, LOW);



  // OLED I2C

  Wire.begin(D2,D1);



  if(!display.begin(
      SSD1306_SWITCHCAPVCC,
      0x3C))
  {

    Serial.println("OLED Failed");

    while(true);

  }


  Serial.println("OLED Ready");



  showDisplay(
    "Connecting",
    "WiFi..."
  );



  // -------- WiFi --------


  WiFi.mode(WIFI_STA);


  WiFi.begin(
    ssid,
    password
  );


  Serial.print("Connecting WiFi");


  while(WiFi.status()!=WL_CONNECTED)
  {

    delay(500);

    Serial.print(".");

  }



  Serial.println();


  Serial.println("WiFi connected");



  Serial.print("IP address: ");

  Serial.println(
    WiFi.localIP()
  );



  // -------- HTTP Routes --------


  server.on(
    "/",
    HTTP_GET,
    handleRoot
  );



  server.on(
    "/ppe-update",
    HTTP_POST,
    handlePpeUpdate
  );



  server.begin();



  Serial.println("HTTP server started");


  Serial.print("Serving on http://");

  Serial.print(
    WiFi.localIP()
  );

  Serial.println(":80");



  showDisplay(
    "WiFi Ready",
    WiFi.localIP().toString()
  );

}



// -------- Loop --------

void loop()
{

  server.handleClient();



  // Button Reset

  bool buttonState =
      digitalRead(BUTTON);



  if(buttonState == LOW &&
     lastButtonState == HIGH &&
     millis()-lastDebounceMs > 200)
  {


    lastDebounceMs = millis();



    if(alarmActive)
    {

      setAlarmState(false);


      showDisplay(
        "ALARM OFF",
        "Reset"
      );

    }

  }


  lastButtonState = buttonState;

}