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

#define RST_PIN         5          // Configurable, see typical pin layout
#define SS_PIN          4          // Configurable, see typical pin layout

MFRC522 mfrc522(SS_PIN, RST_PIN);  // Create MFRC522 instance
WiFiClient espClient;
PubSubClient client(espClient);

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
  else if (String(topic) == TOPIC_PAY) {
      int uidStart = messageTemp.indexOf("\"uid\":\"") + 7;
      int uidEnd = messageTemp.indexOf("\"", uidStart);
      String uid = messageTemp.substring(uidStart, uidEnd);
      
      int amtStart = messageTemp.indexOf("\"amount\":") + 9;
      int amtEnd = messageTemp.indexOf("}", amtStart);
      long amount = messageTemp.substring(amtStart, amtEnd).toInt();
      
      if (uid == currentUid) {
          localBalance -= amount;
          if (localBalance < 0) localBalance = 0;
          
          // Store in EEPROM 
          EEPROM.put(0, localBalance);
          EEPROM.commit();
          
           String response = "{\"uid\":\"" + uid + "\",\"balance\":" + String(localBalance) + ",\"lastAmount\":" + String(amount) + ",\"lastType\":\"PAY\"}";
          client.publish(TOPIC_BALANCE, response.c_str());
          Serial.println("Payment applied. Emitted to BALANCE topic.");
      }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP8266Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.subscribe(TOPIC_TOPUP);
      client.subscribe(TOPIC_PAY);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  EEPROM.begin(512); // Initialize EEPROM
  
  // Read basic balance for last card for demo purposes
  EEPROM.get(0, localBalance);
  if (localBalance < 0 || localBalance > 1000000) {
      localBalance = 0; // initialize if garbage
  }
  
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  
  SPI.begin();			// Init SPI bus
  mfrc522.PCD_Init();		// Init MFRC522
  delay(4);				// Optional delay. Some board do need more time after init to be ready, see Readme
  Serial.println("Ready to scan RFID cards...");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Look for new cards
  if ( ! mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  // Select one of the cards
  if ( ! mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
        uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  if (uid != currentUid) {
      currentUid = uid;
      // You'd ideally fetch balance from Server, but if we trust EEPROM 
      // for this mocked 1-card local storage system context:
  }
  
  // Publish card tap status
  String statusMsg = "{\"uid\":\"" + currentUid + "\",\"balance\":" + String(localBalance) + "}";
  client.publish(TOPIC_STATUS, statusMsg.c_str());
  Serial.println("Card Tapped. Status Emitted: " + statusMsg);
  
  mfrc522.PICC_HaltA();
  
  // Small debounce
  delay(1000);
}
