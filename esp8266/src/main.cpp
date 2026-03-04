#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <EEPROM.h>
#include <ArduinoJson.h> // Ensure you have ArduinoJson added to platformio.ini if using it, or handle JSON manually

// == Config ==
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* mqtt_server = "broker.benax.rw";

const char* TOPIC_STATUS = "rfid/kawacukennedy/card/status";
const char* TOPIC_BALANCE = "rfid/kawacukennedy/card/balance";
const char* TOPIC_TOPUP = "rfid/kawacukennedy/card/topup";
const char* TOPIC_PAY = "rfid/kawacukennedy/card/pay";

MFRC522* mfrc522 = nullptr;
WiFiClient espClient;
PubSubClient client(espClient);

// Auto-detection pin pairs (SS, RST)
struct PinPair { int ss; int rst; };
PinPair scanPairs[] = {
    {4, 5},   // D2, D1 (Common)
    {15, 0},  // D8, D3
    {2, 16},  // D4, D0
    {15, 2}   // D8, D4
};

String currentUid = "";
long localBalance = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  randomSeed(micros());
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

bool tryInitRFID(int ss, int rst) {
    if (mfrc522) delete mfrc522;
    mfrc522 = new MFRC522(ss, rst);
    mfrc522->PCD_Init();
    delay(50);
    byte v = mfrc522->PCD_ReadRegister(mfrc522->VersionReg);
    if (v == 0x00 || v == 0xFF) return false; 
    Serial.printf("RFID Module found at SS:%d RST:%d (Version: 0x%02X)\n", ss, rst, v);
    return true;
}

void scanAndInitRFID() {
    Serial.println("Scanning for RFID module...");
    for (auto pair : scanPairs) {
        if (tryInitRFID(pair.ss, pair.rst)) return;
    }
    Serial.println("Warning: RFID module not detected. Falling back to default.");
    tryInitRFID(4, 5);
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }
  Serial.println(messageTemp);
  
  // Note: Using a lightweight approach to parse JSON for simplicity 
  // without ArduinoJson library, assuming exact match for format `{"uid":"...","amount":...}`
  
  if (String(topic) == TOPIC_TOPUP) {
      // Find uid and amount
      int uidStart = messageTemp.indexOf("\"uid\":\"") + 7;
      int uidEnd = messageTemp.indexOf("\"", uidStart);
      String uid = messageTemp.substring(uidStart, uidEnd);
      
      int amtStart = messageTemp.indexOf("\"amount\":") + 9;
      int amtEnd = messageTemp.indexOf("}", amtStart);
      long amount = messageTemp.substring(amtStart, amtEnd).toInt();
      
      if (uid == currentUid) {
          localBalance += amount;
          // Store in EEPROM 
          EEPROM.put(0, localBalance);
          EEPROM.commit();
          
          String response = "{\"uid\":\"" + uid + "\",\"balance\":" + String(localBalance) + ",\"lastAmount\":" + String(amount) + ",\"lastType\":\"TOPUP\"}";
          client.publish(TOPIC_BALANCE, response.c_str());
          Serial.println("Top-Up applied. Emitted to BALANCE topic.");
      }
  } 
  if (String(topic) == TOPIC_PAY) {
      int uidStart = messageTemp.indexOf("\"uid\":\"") + 7;
      int uidEnd = messageTemp.indexOf("\"", uidStart);
      String uid = messageTemp.substring(uidStart, uidEnd);
      
      int amtStart = messageTemp.indexOf("\"amount\":") + 9;
      int amtEnd = messageTemp.indexOf("}", amtStart);
      long amount = messageTemp.substring(amtStart, amtEnd).toInt();
      
      if (uid == currentUid) {
          localBalance -= amount;
          if (localBalance < 0) localBalance = 0;
          
          EEPROM.put(0, localBalance);
          EEPROM.commit();
          
          // Print Receipt to Serial
          Serial.println("\n=========================");
          Serial.println("     DIGITAL RECEIPT    ");
          Serial.println("=========================");
          Serial.printf(" CARD:   %s\n", uid.c_str());
          Serial.printf(" PAID:   %ld CR\n", amount);
          Serial.printf(" BAL:    %ld CR\n", localBalance);
          Serial.println("=========================\n");

           String response = "{\"uid\":\"" + uid + "\",\"balance\":" + String(localBalance) + ",\"lastAmount\":" + String(amount) + ",\"lastType\":\"PAY\"}";
          client.publish(TOPIC_BALANCE, response.c_str());
      }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP8266Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.subscribe(TOPIC_TOPUP);
      client.subscribe(TOPIC_PAY);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  EEPROM.begin(512); 
  
  EEPROM.get(0, localBalance);
  if (localBalance < 0 || localBalance > 1000000) localBalance = 0;

  SPI.begin();
  scanAndInitRFID();
  setup_wifi();
  
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  if (!mfrc522 || !mfrc522->PICC_IsNewCardPresent()) return;
  if (!mfrc522->PICC_ReadCardSerial()) return;
  
  String uid = "";
  for (byte i = 0; i < mfrc522->uid.size; i++) {
        uid += String(mfrc522->uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  if (uid != currentUid) {
      currentUid = uid;
  }
  
  String statusMsg = "{\"uid\":\"" + currentUid + "\",\"balance\":" + String(localBalance) + "}";
  client.publish(TOPIC_STATUS, statusMsg.c_str());
  Serial.println("Card Tapped: " + currentUid);
  
  mfrc522->PICC_HaltA();
  delay(1000);
}
