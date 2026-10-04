// Zoomies handheld controller — Arduino UNO R4 WiFi + Grove Base Shield.
// Serial protocol (docs/plans/00-shared.md §3.7, app/src/shared/serial.ts):
//   115200 baud, newline-terminated ASCII lines. Nothing else is ever printed.
//   Arduino -> app:  HELLO:zoomies:1   J:<x>,<y> (0..1023)   B:<0|1>   T:<0|1>
//   App -> Arduino:  Z:<freqHz>,<ms>   S:squeak   S:chirp
//
// Wiring (Grove Base Shield):
//   Joystick X -> A0, Y -> A1   (Grove thumb joystick on the A0 port)
//   Button     -> D2
//   Touch      -> D3
//   Buzzer     -> D4
//
// The loop never blocks: input is polled and the buzzer is a small timed queue.

// ---- Pins -----------------------------------------------------------------
const uint8_t PIN_JOY_X = A0;
const uint8_t PIN_JOY_Y = A1;
const uint8_t PIN_BUTTON = 2;
const uint8_t PIN_TOUCH = 3;
const uint8_t PIN_BUZZER = 4;

// Grove button and touch modules read HIGH when pressed/touched. If you swap in a
// bare breadboard button wired to GND with INPUT_PULLUP, set BUTTON_ACTIVE_HIGH to
// false (and change the pinMode below to INPUT_PULLUP).
const bool BUTTON_ACTIVE_HIGH = true;
const bool TOUCH_ACTIVE_HIGH = true;

// ---- Timing and thresholds --------------------------------------------------
const unsigned long BAUD = 115200;
const unsigned long JOY_INTERVAL_MS = 33;     // ~30 Hz
const int JOY_DEADBAND = 4;                   // ignore ADC noise (0..1023 scale)
const unsigned long DEBOUNCE_MS = 20;
const unsigned long SERIAL_WAIT_MS = 1500;    // don't hang if no computer is attached
const unsigned long HELLO_REPEAT_MS = 2000;   // repeat HELLO this often until the app talks to us
// The R4's USB serial doesn't reset the board when the app opens the port, and there is
// no reliable "host connected" signal, so a boot-only HELLO would be missed. We repeat it
// instead. true = stop after the first valid command from the app; false = repeat forever.
// We repeat forever (false): the app only sends commands on a catch/bounce, so stopping
// would leave the board undetectable after an app restart without a replug. The app's
// serial reader MUST treat repeated HELLO lines as a no-op once it is connected.
const bool STOP_HELLO_AFTER_COMMAND = false;
const unsigned long TONE_MAX_MS = 5000;       // cap Z: so a bad line can't hold the buzzer
const unsigned int TONE_MIN_HZ = 31;          // lowest frequency tone() supports
const unsigned int TONE_MAX_HZ = 20000;

// ---- Joystick ---------------------------------------------------------------
int lastJoyX = -1000;
int lastJoyY = -1000;
unsigned long lastJoyAt = 0;

// ---- Button / touch (debounced) ---------------------------------------------
struct DebouncedInput {
  uint8_t pin;
  bool activeHigh;
  char tag;                 // 'B' or 'T'
  bool stable;              // last reported state (true = pressed)
  bool raw;                 // last raw reading
  unsigned long changedAt;  // when raw last changed
};

DebouncedInput button = {PIN_BUTTON, BUTTON_ACTIVE_HIGH, 'B', false, false, 0};
DebouncedInput touch = {PIN_TOUCH, TOUCH_ACTIVE_HIGH, 'T', false, false, 0};

// ---- Buzzer: a small queue of timed notes -----------------------------------
struct Note {
  unsigned int freq;  // Hz, 0 = rest
  unsigned int ms;
};

const uint8_t MAX_NOTES = 6;
Note queue[MAX_NOTES];
uint8_t queueLen = 0;
uint8_t queuePos = 0;
bool notePlaying = false;
unsigned long noteEndsAt = 0;

// Presets. Short and bright; the squeak glides up, the chirp is two quick pips.
const Note SQUEAK[] = {{1900, 40}, {2400, 40}, {3000, 60}};
const Note CHIRP[] = {{2600, 35}, {0, 25}, {3200, 35}};

// ---- Serial input -------------------------------------------------------------
char lineBuf[32];
uint8_t lineLen = 0;
bool lineOverflow = false;

// ---- HELLO announcements ------------------------------------------------------
bool hostSpoke = false;       // true once the app has sent a valid command line
unsigned long lastHelloAt = 0;

// ---- Output helpers ---------------------------------------------------------
void sendHello() { Serial.println(F("HELLO:zoomies:1")); }

void sendFlag(char tag, bool on) {
  Serial.print(tag);
  Serial.print(':');
  Serial.println(on ? 1 : 0);
}

void sendJoystick(int x, int y) {
  Serial.print(F("J:"));
  Serial.print(x);
  Serial.print(',');
  Serial.println(y);
}

// ---- Buzzer ------------------------------------------------------------------
void stopBuzzer() {
  noTone(PIN_BUZZER);
  notePlaying = false;
  queueLen = 0;
  queuePos = 0;
}

void playNotes(const Note* notes, uint8_t count) {
  if (count > MAX_NOTES) count = MAX_NOTES;
  stopBuzzer();  // a new sound replaces the old one
  for (uint8_t i = 0; i < count; i++) queue[i] = notes[i];
  queueLen = count;
}

void updateBuzzer(unsigned long now) {
  if (notePlaying && (long)(now - noteEndsAt) < 0) return;  // still playing
  notePlaying = false;
  if (queuePos >= queueLen) {
    queueLen = 0;
    queuePos = 0;
    return;
  }
  Note n = queue[queuePos++];
  if (n.freq > 0) tone(PIN_BUZZER, n.freq, n.ms);
  else noTone(PIN_BUZZER);
  noteEndsAt = now + n.ms;
  notePlaying = true;
}

// ---- Input handling -----------------------------------------------------------
void pollDebounced(DebouncedInput& in, unsigned long now) {
  bool pressed = (digitalRead(in.pin) == HIGH) == in.activeHigh;
  if (pressed != in.raw) {
    in.raw = pressed;
    in.changedAt = now;
  }
  if (in.raw != in.stable && now - in.changedAt >= DEBOUNCE_MS) {
    in.stable = in.raw;
    sendFlag(in.tag, in.stable);
  }
}

void pollJoystick(unsigned long now) {
  if (now - lastJoyAt < JOY_INTERVAL_MS) return;
  lastJoyAt = now;
  int x = constrain(analogRead(PIN_JOY_X), 0, 1023);
  int y = constrain(analogRead(PIN_JOY_Y), 0, 1023);
  if (abs(x - lastJoyX) < JOY_DEADBAND && abs(y - lastJoyY) < JOY_DEADBAND) return;
  lastJoyX = x;
  lastJoyY = y;
  sendJoystick(x, y);
}

// ---- Commands from the app ------------------------------------------------------
// Strict parse of an unsigned integer; returns false on anything else.
bool parseUInt(const char* s, unsigned long& out) {
  if (*s == '\0') return false;
  unsigned long v = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return false;
    v = v * 10 + (*s - '0');
    if (v > 1000000UL) return false;
  }
  out = v;
  return true;
}

void handleLine(char* line) {
  if (line[0] == 'S' && line[1] == ':') {
    if (strcmp(line + 2, "squeak") == 0) {
      hostSpoke = true;
      playNotes(SQUEAK, sizeof(SQUEAK) / sizeof(Note));
    } else if (strcmp(line + 2, "chirp") == 0) {
      hostSpoke = true;
      playNotes(CHIRP, sizeof(CHIRP) / sizeof(Note));
    }
    return;  // unknown preset: ignore (and it doesn't count as the app talking)
  }
  if (line[0] == 'Z' && line[1] == ':') {
    char* comma = strchr(line + 2, ',');
    if (!comma) return;
    *comma = '\0';
    unsigned long freq, ms;
    if (!parseUInt(line + 2, freq) || !parseUInt(comma + 1, ms)) return;
    hostSpoke = true;  // well-formed Z: line
    if (ms == 0) return;
    if (ms > TONE_MAX_MS) ms = TONE_MAX_MS;
    if (freq != 0) freq = constrain(freq, TONE_MIN_HZ, TONE_MAX_HZ);
    Note n = {(unsigned int)freq, (unsigned int)ms};
    playNotes(&n, 1);
    return;
  }
  // anything else is ignored silently (the protocol says unparseable lines are dropped)
}

void readSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (!lineOverflow && lineLen > 0) {
        lineBuf[lineLen] = '\0';
        handleLine(lineBuf);
      }
      lineLen = 0;
      lineOverflow = false;
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    } else {
      lineOverflow = true;  // too long to be valid: drop the whole line
    }
  }
}

// ---- Arduino entry points ---------------------------------------------------------
void setup() {
  pinMode(PIN_BUTTON, INPUT);
  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(10);  // R4 defaults to 10-bit, but be explicit: the protocol is 0..1023

  Serial.begin(BAUD);
  unsigned long start = millis();
  while (!Serial && millis() - start < SERIAL_WAIT_MS) {
  }

  sendHello();
  lastHelloAt = millis();

  // Report the starting state so the app doesn't have to guess.
  unsigned long now = millis();
  button.raw = button.stable = (digitalRead(PIN_BUTTON) == HIGH) == BUTTON_ACTIVE_HIGH;
  touch.raw = touch.stable = (digitalRead(PIN_TOUCH) == HIGH) == TOUCH_ACTIVE_HIGH;
  button.changedAt = touch.changedAt = now;
  sendFlag('B', button.stable);
  sendFlag('T', touch.stable);
}

void loop() {
  unsigned long now = millis();

  readSerial();

  // Keep announcing ourselves so the app can find the board whenever it opens the port.
  if (!(STOP_HELLO_AFTER_COMMAND && hostSpoke) && now - lastHelloAt >= HELLO_REPEAT_MS) {
    sendHello();
    lastHelloAt = now;
  }

  pollDebounced(button, now);
  pollDebounced(touch, now);
  pollJoystick(now);
  updateBuzzer(now);
}
