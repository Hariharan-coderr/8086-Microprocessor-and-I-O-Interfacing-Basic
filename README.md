# 8086 Port-Mapped I/O Learning Tool
### Interactive Software Simulation for 8086 Port-Mapped (Isolated) I/O Interfacing

> **College Laboratory Assignment / Capstone Project Deliverable**  
> **Student Name:** HARIHARAN MUTHU M  
> **Section:** A  
> **Subject / Course Code:** EC2201 – Microprocessor and I/O Interfacing  
> **Syllabus Unit:** Unit V – 8086 Microprocessor and I/O Interfacing  
> **Project Type:** 8086 Port-Mapped I/O Learning Tool  
> **Registration Date:** 08 Sept 2026  
> **Academic Year:** 2026 – 2027  

---

## 1. Problem Statement
In undergraduate digital systems and microprocessor courses, students learn 8086 input/output interfacing theoretically through block diagrams and timing charts. However, physical trainer kits and breadboards present major obstacles:
- Bus control signals ($M/\overline{IO}$, $\overline{RD}$, $\overline{WR}$) operate in the nanosecond range and are invisible without multi-channel digital storage oscilloscopes or logic analyzers.
- Incorrect wiring or bus contention causes physical chip burnout (e.g. 74LS138, 8255 PPI).
- Students struggle to visualize accumulator data latching and the distinction between 64KB isolated port space and 1MB memory space.

This tool solves this challenge by providing a **deterministic, safe, interactive software simulation environment** that faithfully models 8086 Port-Mapped I/O bus cycles, CPU registers, address decoding, virtual peripherals, and fault conditions.

---

## 2. Project Objective
> *“To provide an interactive and reproducible software simulation for understanding 8086 port-mapped I/O operations using virtual devices, IN/OUT instructions, port mapping and execution tracing.”*

The tool enables students and educators to:
1. Map peripherals to 8086 I/O ports ($00H$ to $FFH$).
2. Execute single assembly lines or complete multiline programs.
3. Observe real-time changes in CPU accumulators (`AX`, `AH`, `AL`), `IP`, and Status Flags (`ZF`, `SF`, `PF`).
4. Inspect intermediate bus cycle stages ($T_1$ to $T_4$) with active control lines ($M/\overline{IO} = 0$, $\overline{RD} = 0$, $\overline{WR} = 0$).
5. Run an automated test suite containing 10 normal and 6 fault injection test cases with 100% reproducible results.

---

## 3. Key Features
- **Configurable Port Mapping:** Default 8-port mapping ($00H$ to $07H$) with customizable port addition and direction enforcement.
- **8 Virtual Peripherals:**
  1. **Input Switch Bank (Port 00H):** 8 interactive DIP switches (SW0–SW7).
  2. **LED Output Bar (Port 01H):** 8 discrete glowing LEDs with active-high CSS animation.
  3. **7-Segment Display (Port 02H):** SVG common-cathode display decoding characters `0`–`F`.
  4. **Digital Sensor (Port 03H):** 8-bit ADC ambient temperature transducer ($0^\circ\text{C}$ to $255^\circ\text{C}$).
  5. **Matrix Keypad (Port 04H):** 4x4 keypad encoder with scancode latching.
  6. **Piezoelectric Buzzer (Port 05H):** Acoustic alarm synthesizer utilizing the Web Audio API (2.4 kHz square wave).
  7. **PWM Motor Controller (Port 06H):** DC motor drive with animated spinning fan and RPM gauge (0–3000 RPM).
  8. **Status Register (Port 07H):** Handshake flags (`READY`, `BUSY`, `ERROR`, `TX_EMPTY`, etc.).
- **Interactive Bus Cycle Visualizer:** 5-stage stepper tracing $T_1$ Address output, $T_2$ Bus direction, $T_3$ Control strobe, $T_4$ Data latch.
- **Pedagogical AI / Diagnostic Assistant:** Explains instructions in simple language, detects inverted operand syntax, and provides hardware tips.
- **Guided 3–5 Minute Presentation Demo Tour:** 14-step walkthrough designed for college viva / presentation demonstrations.
- **Comprehensive Audit Trace:** Detailed table recording instruction, operation, port, direction, registers before/after, data, status, and explanations with CSV/JSON export.

---

## 4. System Architecture
```
USER / BROWSER / CLI
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  Presentation Layer: index.html + styles.css + app.js  │
│  (SVG 7-Seg, LED Glow, Web Audio, Charts, Demo Mode)   │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  FastAPI / Uvicorn Server & REST API (app.py)          │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  Simulator Core (simulator/):                          │
│  ├── cpu.py         (AX, AH, AL, IP, Flags, Bus Lines) │
│  ├── io_engine.py   (5-Stage Bus Cycle & Trace Engine) │
│  ├── port_map.py    (Port Mapping & 74LS138 Decoding)  │
│  ├── devices.py     (8 Virtual Hardware Peripherals)   │
│  ├── parser.py      (8086 Assembly Syntax & Diagnostics)│
│  ├── tests.py       (16-Test Verification Suite)       │
│  └── ai_assistant.py(Educational Pedagogical Advisor)  │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  Verification & Assets:                                │
│  ├── data/test_data.csv                                │
│  ├── screenshots/ (Matplotlib Engineering Charts)      │
│  └── report/project_report.md                          │
└────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack
- **Web Frontend:** HTML5, Modern CSS3 (Grid/Flexbox, Custom Properties, Dark/Light Themes), Vanilla ES6 JavaScript (Zero third-party library dependencies, 100% offline).
- **Audio Synthesizer:** HTML5 Web Audio API (real-time 2.4 kHz acoustic alarm).
- **Backend / API:** Python 3.10+, FastAPI, Uvicorn.
- **Data & Charts:** Matplotlib (high-resolution engineering diagrams), Pandas.
- **Testing:** Pytest (17 automated unit tests).

---

## 6. Project Directory Structure
```
hari.ece/
├── app.py                     # FastAPI server and REST endpoints
├── app.js                     # Complete client-side 8086 simulation engine
├── index.html                 # Main responsive engineering dashboard (11 tabs)
├── styles.css                 # Complete modern stylesheet
├── run_cli.py                 # Interactive command-line simulation runner
├── generate_assets.py         # Matplotlib diagram generator for screenshots
├── test_suite.py              # Pytest automated test suite
├── requirements.txt           # Python dependencies
├── README.md                  # Complete project documentation
├── data/
│   ├── test_data.csv          # Reproducible test dataset (16 cases)
│   └── port_map_default.csv   # Default port map dataset
├── screenshots/
│   ├── bus_timing_diagram.png # 8086 T1-T4 bus cycle timing diagram
│   ├── system_architecture.png# Interfacing block diagram
│   └── test_results_summary.png# Verification pass/fail charts
├── simulator/
│   ├── __init__.py
│   ├── cpu.py                 # 8086 CPU registers & bus control lines
│   ├── devices.py             # 8 Virtual peripherals
│   ├── port_map.py            # 8086 I/O space & decoder logic
│   ├── parser.py              # Assembly instruction parser
│   ├── io_engine.py           # Execution engine & intermediate states
│   ├── tests.py               # Test runner (10 normal + 6 fault)
│   └── ai_assistant.py        # Pedagogical feedback & mistake diagnostics
└── report/
    └── project_report.md      # 21-section academic project report
```

---

## 7. Installation & Quick Start

### Option A: Open Directly in Browser (Zero Installation)
Simply double-click or open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari). The entire simulation engine, audio synthesizer, and test runner execute client-side.

### Option B: Launch via Python Web Server
1. Clone or navigate to the project directory:
   ```bash
   cd "c:\Users\Asus\Downloads\new dev\hari.ece"
   ```
2. Install dependencies (if not already installed):
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   python app.py
   ```
4. Open your browser to: [http://localhost:8000](http://localhost:8000)

### Option C: Run Interactive CLI Runner
```bash
python run_cli.py
```

### Option D: Run Pytest Test Suite
```bash
python -m pytest test_suite.py -v
```

---

## 8. Default Port Map

| Port Address | Connected Peripheral | Direction | Initial Value | Hardware Description |
| :---: | :--- | :---: | :---: | :--- |
| **00H** | Input Switch Bank | INPUT | `01H` | 8-bit DIP switch bank (SW0–SW7) |
| **01H** | LED Output Array | OUTPUT | `00H` | 8-channel active-high LED indicators |
| **02H** | 7-Segment Display | OUTPUT | `00H` | Common-cathode hexadecimal numeric display |
| **03H** | Digital Sensor | INPUT | `5AH` | 8-bit ADC ambient temperature sensor ($90^\circ\text{C}$) |
| **04H** | Matrix Keypad | INPUT | `03H` | 4x4 matrix keypad encoder |
| **05H** | Piezoelectric Buzzer | OUTPUT | `00H` | 2.4 kHz acoustic alarm annunciator |
| **06H** | PWM Motor Controller | OUTPUT | `00H` | DC motor drive (0 to 3000 RPM) |
| **07H** | Status Register | INPUT | `01H` | Handshake status register (`READY`, etc.) |

---

## 9. Sample 8086 Programs

### Program 1: Read Sensor → Display on LED
```assembly
; Read ambient sensor at Port 03H and latch to LEDs at Port 01H
IN AL, 03H
OUT 01H, AL
```

### Program 2: Read Switch → Trigger Buzzer Alarm
```assembly
; Read DIP switch bank. If SW0 is on, sound piezo alarm
IN AL, 00H
OUT 05H, AL
```

### Program 3: Read Keypad → 7-Segment Display
```assembly
; Read pressed keypad scancode and show digit on 7-segment display
IN AL, 04H
OUT 02H, AL
```

### Program 4: Sensor Closed-Loop Motor Speed Control
```assembly
; Sample temperature sensor and drive proportional DC motor PWM
IN AL, 03H
OUT 06H, AL
```

### Program 5: Read Status Register → LED Bar
```assembly
; Sample peripheral handshaking flags (READY, BUSY, etc.) and display
IN AL, 07H
OUT 01H, AL
```

---

## 10. Automated Test Cases

### Normal Suite (10 Cases — 100% Pass)
- **TC01:** Read valid sensor port (`IN AL, 03H`) $\rightarrow$ `AL=5AH`, PASS
- **TC02:** Write valid LED port (`OUT 01H, AL`) $\rightarrow$ `LED=AAH`, PASS
- **TC03:** Read switch port (`IN AL, 00H`) $\rightarrow$ `AL=0FH`, PASS
- **TC04:** Write buzzer port (`OUT 05H, AL`) $\rightarrow$ `Buzzer=01H`, PASS
- **TC05:** Read keypad port (`IN AL, 04H`) $\rightarrow$ `AL=07H`, PASS
- **TC06:** Write 7-segment display (`OUT 02H, AL`) $\rightarrow$ Display '9', PASS
- **TC07:** Read status register (`IN AL, 07H`) $\rightarrow$ `AL=05H`, PASS
- **TC08:** Write motor controller (`OUT 06H, AL`) $\rightarrow$ RPM ~1505, PASS
- **TC09:** Sensor to LED transfer (`IN AL, 03H; OUT 01H, AL`) $\rightarrow$ `LED=7EH`, PASS
- **TC10:** Multiple sequential operations $\rightarrow$ Sequential bus arbitration verified, PASS

### Edge & Fault Suite (6 Cases — 100% Pass)
- **FC01:** Unmapped port address (`IN AL, 0FFH`) $\rightarrow$ Trapped as High-Z unmapped port fault, PASS
- **FC02:** Write to input-only sensor (`OUT 03H, AL`) $\rightarrow$ Trapped as direction mismatch, PASS
- **FC03:** Read from output-only LED (`IN AL, 01H`) $\rightarrow$ Trapped as direction mismatch, PASS
- **FC04:** Invalid mnemonic syntax (`ABC AL, 03H`) $\rightarrow$ Trapped as invalid instruction, PASS
- **FC05:** Numeric constant overflow (`MOV AL, 1FFH`) $\rightarrow$ Trapped as 8-bit overflow, PASS
- **FC06:** Inverted operands syntax (`IN 03H, AL`) $\rightarrow$ Trapped with educational correction, PASS

---

## 11. Guided 3–5 Minute Presentation Sequence
Click the **"Demo Mode"** button in the navigation bar to launch the 14-step presentation sequence:
1. Welcome & Project Introduction
2. Objective & Pedagogical Need
3. 8086 Port Map Architecture
4. Interactive Virtual Peripherals
5. Simulator Interface & CPU Register Model
6. Load Program 1 (Sensor to LED)
7. Step 1: `IN AL, 03H` Execution
8. Observe CPU Accumulator & Bus Latching
9. Step 2: `OUT 01H, AL` Execution
10. Observe Real-Time LED Feedback
11. Step-by-Step I/O Execution Trace
12. Run Automated Verification Suite (TC01–TC10)
13. Fault Detection Demonstration (FC01–FC06)
14. Results Dashboard & Presentation Conclusion

---

## 12. Academic References
1. **Intel Corporation.** (1979). *The 8086 Family User's Manual*. Santa Clara, CA: Intel Literature Department.
2. **Hall, Douglas V.** (2005). *Microprocessors and Interfacing: Programming and Hardware* (2nd ed.). Tata McGraw-Hill Education.
3. **Ray, A. K., & Bhurchandi, K. M.** (2012). *Advanced Microprocessors and Peripherals: Architecture, Programming and Interfacing* (3rd ed.). McGraw Hill India.
4. **Gaonkar, Ramesh S.** (2007). *Microprocessor Architecture, Programming, and Applications with the 8085/8086*. Penram International Publishing.
5. **Liu, Yu-Cheng, & Gibson, Glenn A.** (1986). *Microcomputer Systems: The 8086/8088 Family: Architecture, Programming and Design* (2nd ed.). Prentice-Hall.
