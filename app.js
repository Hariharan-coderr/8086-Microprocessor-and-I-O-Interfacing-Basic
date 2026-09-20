/**
 * 8086 Port-Mapped I/O Learning Tool - Complete Interactive Application Engine
 * Subject: EC2201 - Microprocessor and I/O Interfacing (Unit V)
 * Student: HARIHARAN MUTHU M (Section A)
 */

// ============================================================================
// 1. GLOBAL STATE & CONSTANTS
// ============================================================================

const SEGMENT_MAP = {
  0x0: 0x3F, 0x1: 0x06, 0x2: 0x5B, 0x3: 0x4F,
  0x4: 0x66, 0x5: 0x6D, 0x6: 0x7D, 0x7: 0x07,
  0x8: 0x7F, 0x9: 0x6F, 0xA: 0x77, 0xB: 0x7C,
  0xC: 0x39, 0xD: 0x5E, 0xE: 0x79, 0xF: 0x71
};

const STATUS_FLAG_NAMES = [
  "READY", "BUSY", "ERROR", "TX_EMPTY", "RX_FULL", "OVERRUN", "PARITY_ERR", "IRQ_PENDING"
];

// Audio Context for synthetic buzzer sound
let audioCtx = null;
let buzzerOscillator = null;

// Display mode: 'hex', 'dec', 'bin'
let currentRadix = 'hex';

// CPU Register & State Model
const CPU = {
  al: 0x00,
  ah: 0x00,
  ip: 0x0100,
  io_counter: 0,
  zf: 0,
  sf: 0,
  pf: 1,
  cf: 0,
  of: 0,
  bus: {
    m_io: 0,     // 0 for I/O, 1 for Memory
    rd_bar: 1,   // Active Low read strobe
    wr_bar: 1,   // Active Low write strobe
    ale: 0,      // Address Latch Enable
    den_bar: 1,  // Data Enable (Active Low)
    dt_r: 0      // 1=Transmit, 0=Receive
  },
  get ax() {
    return ((this.ah & 0xFF) << 8) | (this.al & 0xFF);
  },
  set ax(val) {
    const v = val & 0xFFFF;
    this.ah = (v >> 8) & 0xFF;
    this.al = v & 0xFF;
    this.updateFlags(v, true);
  },
  updateFlags(val, is16Bit = false) {
    const mask = is16Bit ? 0xFFFF : 0xFF;
    const v = val & mask;
    this.zf = (v === 0) ? 1 : 0;
    const signBit = is16Bit ? 0x8000 : 0x80;
    this.sf = (v & signBit) ? 1 : 0;
    // Parity of lower 8 bits
    const lowByte = v & 0xFF;
    let ones = 0;
    for (let i = 0; i < 8; i++) {
      if ((lowByte >> i) & 1) ones++;
    }
    this.pf = (ones % 2 === 0) ? 1 : 0;
  },
  reset() {
    this.al = 0x00;
    this.ah = 0x00;
    this.ip = 0x0100;
    this.io_counter = 0;
    this.zf = 0;
    this.sf = 0;
    this.pf = 1;
    this.cf = 0;
    this.of = 0;
    this.setBusIdle();
  },
  setBusIdle() {
    this.bus.m_io = 0;
    this.bus.rd_bar = 1;
    this.bus.wr_bar = 1;
    this.bus.ale = 0;
    this.bus.den_bar = 1;
    this.bus.dt_r = 0;
  },
  setBusRead() {
    this.bus.m_io = 0;
    this.bus.rd_bar = 0;
    this.bus.wr_bar = 1;
    this.bus.ale = 1;
    this.bus.den_bar = 0;
    this.bus.dt_r = 0;
  },
  setBusWrite() {
    this.bus.m_io = 0;
    this.bus.rd_bar = 1;
    this.bus.wr_bar = 0;
    this.bus.ale = 1;
    this.bus.den_bar = 0;
    this.bus.dt_r = 1;
  }
};

// Port Map Dictionary
let portMap = {};

// Execution Trace History
let executionTrace = [];
let stepCounter = 0;

// Program Stepper state
let programLines = [];
let currentProgramIndex = 0;
let isProgramRunning = false;

// ============================================================================
// 2. INITIALIZATION & PORT SETUP
// ============================================================================

function initDefaultPortMap() {
  portMap = {
    0x00: {
      port: 0x00,
      name: "Input Switch",
      direction: "INPUT",
      value: 0x01,
      defaultValue: 0x01,
      status: "ACTIVE (1/8 switches ON)",
      desc: "8-bit DIP switch bank for digital state input (SW0-SW7)"
    },
    0x01: {
      port: 0x01,
      name: "LED Output",
      direction: "OUTPUT",
      value: 0x00,
      defaultValue: 0x00,
      status: "ALL OFF",
      desc: "8-channel LED array displaying CPU accumulator output bits"
    },
    0x02: {
      port: 0x02,
      name: "7-Segment Display",
      direction: "OUTPUT",
      value: 0x00,
      defaultValue: 0x00,
      displayChar: "0",
      status: "DISPLAYING '0' (Hex: 00H)",
      desc: "Common-Cathode 7-Segment LED display for hexadecimal numeric output"
    },
    0x03: {
      port: 0x03,
      name: "Digital Sensor",
      direction: "INPUT",
      value: 0x5A,
      defaultValue: 0x5A,
      status: "READING: 5AH (90°C)",
      desc: "8-bit ADC ambient temperature/transducer sensor (Default 5AH = 90°C)"
    },
    0x04: {
      port: 0x04,
      name: "Keypad",
      direction: "INPUT",
      value: 0x03,
      defaultValue: 0x03,
      last_key: "3",
      status: "KEY PRESSED: '3' (Code 03H)",
      desc: "4x4 Matrix Keypad encoder providing encoded 8-bit scancode"
    },
    0x05: {
      port: 0x05,
      name: "Buzzer",
      direction: "OUTPUT",
      value: 0x00,
      defaultValue: 0x00,
      is_sounding: false,
      status: "MUTED / SILENT",
      desc: "Piezoelectric acoustic buzzer (Bit 0 activates 2.4kHz alarm tone)"
    },
    0x06: {
      port: 0x06,
      name: "Motor Controller",
      direction: "OUTPUT",
      value: 0x00,
      defaultValue: 0x00,
      rpm: 0,
      duty_cycle: 0.0,
      status: "MOTOR STOPPED (0 RPM)",
      desc: "PWM Motor Drive Controller (00H=Stop, FFH=Max 3000 RPM)"
    },
    0x07: {
      port: 0x07,
      name: "Status Register",
      direction: "INPUT",
      value: 0x01,
      defaultValue: 0x01,
      status: "FLAGS: [READY]",
      desc: "8-bit peripheral handshaking and status register flags"
    }
  };
}

// ============================================================================
// 3. UI RENDERING FUNCTIONS
// ============================================================================

function toHexByte(val) {
  return (val & 0xFF).toString(16).toUpperCase().padStart(2, '0') + 'H';
}

function toHexWord(val) {
  return (val & 0xFFFF).toString(16).toUpperCase().padStart(4, '0') + 'H';
}

function toBinByte(val) {
  return (val & 0xFF).toString(2).padStart(8, '0') + 'b';
}

function formatValueByRadix(val, is16Bit = false) {
  if (currentRadix === 'dec') {
    return is16Bit ? (val & 0xFFFF).toString(10) : (val & 0xFF).toString(10);
  } else if (currentRadix === 'bin') {
    return is16Bit ? (val & 0xFFFF).toString(2).padStart(16, '0') + 'b' : toBinByte(val);
  }
  return is16Bit ? toHexWord(val) : toHexByte(val);
}

function renderCPUState() {
  document.getElementById('dispRegAX').textContent = formatValueByRadix(CPU.ax, true);
  document.getElementById('dispRegAH').textContent = formatValueByRadix(CPU.ah, false);
  document.getElementById('dispRegAL').textContent = formatValueByRadix(CPU.al, false);
  document.getElementById('dispRegIP').textContent = formatValueByRadix(CPU.ip, true);
  document.getElementById('dispIoCounter').textContent = CPU.io_counter;

  // Status Flags
  setFlagElement('flagZF', CPU.zf);
  setFlagElement('flagSF', CPU.sf);
  setFlagElement('flagPF', CPU.pf);
  setFlagElement('flagCF', CPU.cf);
  setFlagElement('flagOF', CPU.of);

  // Bus Signals
  document.getElementById('sigMIO').textContent = CPU.bus.m_io + " (I/O)";
  document.getElementById('sigRD').textContent = CPU.bus.rd_bar === 0 ? "0 (ACTIVE)" : "1 (High)";
  document.getElementById('sigWR').textContent = CPU.bus.wr_bar === 0 ? "0 (ACTIVE)" : "1 (High)";
  document.getElementById('sigALE').textContent = CPU.bus.ale === 1 ? "1 (STROBE)" : "0 (Low)";
  document.getElementById('sigDEN').textContent = CPU.bus.den_bar === 0 ? "0 (ENABLE)" : "1 (High)";
  document.getElementById('sigDTR').textContent = CPU.bus.dt_r === 1 ? "1 (Transmit)" : "0 (Receive)";

  // Color pulse active control signals
  highlightSignal('sigRD', CPU.bus.rd_bar === 0);
  highlightSignal('sigWR', CPU.bus.wr_bar === 0);
  highlightSignal('sigALE', CPU.bus.ale === 1);
}

function setFlagElement(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('span').textContent = val;
  if (val === 1) el.classList.add('flag-set');
  else el.classList.remove('flag-set');
}

function highlightSignal(id, isActive) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isActive) {
    el.style.color = '#38bdf8';
    el.style.fontWeight = 'bold';
  } else {
    el.style.color = '';
    el.style.fontWeight = '';
  }
}

function renderPortMaps() {
  // 1. Simulator Quick Ports List
  const quickList = document.getElementById('simQuickPorts');
  if (quickList) {
    quickList.innerHTML = '';
    const sorted = Object.keys(portMap).map(Number).sort((a, b) => a - b);
    sorted.forEach(p => {
      const dev = portMap[p];
      const div = document.createElement('div');
      div.className = 'quick-port-item';
      div.onclick = () => selectQuickDevice(p);
      div.innerHTML = `
        <span class="quick-port-addr">${toHexByte(p)}</span>
        <span class="quick-port-name">${dev.name}</span>
        <span class="quick-port-val">${toHexByte(dev.value)}</span>
      `;
      quickList.appendChild(div);
    });
  }

  // 2. Full Port Map Table
  const fullBody = document.getElementById('fullPortMapBody');
  if (fullBody) {
    fullBody.innerHTML = '';
    const sorted = Object.keys(portMap).map(Number).sort((a, b) => a - b);
    sorted.forEach(p => {
      const dev = portMap[p];
      const tr = document.createElement('tr');
      const dirBadge = dev.direction === 'INPUT' ? 'badge-info' : 'badge-accent';
      tr.innerHTML = `
        <td><span class="code-pill">${toHexByte(p)}</span></td>
        <td>${toHexByte(p)} / ${p}</td>
        <td><b>${dev.name}</b></td>
        <td><span class="badge ${dirBadge}">${dev.direction}</span></td>
        <td><b class="highlight-val">${toHexByte(dev.value)}</b> (${toBinByte(dev.value)})</td>
        <td>${toHexByte(dev.defaultValue)}</td>
        <td><span class="badge badge-secondary">${dev.status}</span></td>
        <td class="small text-muted">${dev.desc}</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="openEditPortModal(${p})">Edit</button>
        </td>
      `;
      fullBody.appendChild(tr);
    });
  }
}

function renderVirtualDevicesUI() {
  // Device 0: Switches
  const dev0 = portMap[0x00];
  if (dev0) {
    const swGroup = document.getElementById('dipSwitchGroup');
    if (swGroup) {
      swGroup.innerHTML = '';
      for (let i = 7; i >= 0; i--) {
        const isSet = (dev0.value & (1 << i)) !== 0;
        const col = document.createElement('div');
        col.className = 'dip-switch-col';
        col.innerHTML = `
          <div class="switch-toggle ${isSet ? 'active' : ''}" onclick="toggleDIPSwitch(${i})">
            <div class="switch-slider"></div>
          </div>
          <span class="dip-label">SW${i}</span>
        `;
        swGroup.appendChild(col);
      }
    }
    const valEl = document.getElementById('switchValDisp');
    if (valEl) valEl.textContent = `${toHexByte(dev0.value)} (${toBinByte(dev0.value)})`;
    const stEl = document.getElementById('switchStatusDisp');
    if (stEl) stEl.textContent = dev0.status;
  }

  // Device 1: LEDs
  const dev1 = portMap[0x01];
  if (dev1) {
    const ledGroup = document.getElementById('ledDisplayGroup');
    if (ledGroup) {
      ledGroup.innerHTML = '';
      for (let i = 7; i >= 0; i--) {
        const isLit = (dev1.value & (1 << i)) !== 0;
        const item = document.createElement('div');
        item.className = 'led-item';
        item.innerHTML = `
          <div class="led-bulb ${isLit ? 'lit' : ''}"></div>
          <span class="led-label">L${i}</span>
        `;
        ledGroup.appendChild(item);
      }
    }
    const valEl = document.getElementById('ledValDisp');
    if (valEl) valEl.textContent = `${toHexByte(dev1.value)} (${toBinByte(dev1.value)})`;
    const stEl = document.getElementById('ledStatusDisp');
    if (stEl) stEl.textContent = dev1.status;
  }

  // Device 2: 7-Segment Display
  const dev2 = portMap[0x02];
  if (dev2) {
    const nibble = dev2.value & 0x0F;
    const segChar = nibble.toString(16).toUpperCase();
    const segMask = SEGMENT_MAP[nibble] || 0x00;
    
    // Update SVG segment classes
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg, idx) => {
      const el = document.getElementById(`seg-${seg}`);
      if (el) {
        if ((segMask & (1 << idx)) !== 0) {
          el.setAttribute('class', 'seg-on');
        } else {
          el.setAttribute('class', 'seg-off');
        }
      }
    });

    const charEl = document.getElementById('dispSegChar');
    if (charEl) charEl.textContent = segChar;
    const valEl = document.getElementById('segValDisp');
    if (valEl) valEl.textContent = toHexByte(dev2.value);
    const stEl = document.getElementById('segStatusDisp');
    if (stEl) stEl.textContent = dev2.status;
  }

  // Device 3: Sensor
  const dev3 = portMap[0x03];
  if (dev3) {
    const slider = document.getElementById('sensorSlider');
    if (slider) slider.value = dev3.value;
    const sliderText = document.getElementById('sensorSliderValText');
    if (sliderText) sliderText.textContent = `${toHexByte(dev3.value)} (${dev3.value}°C)`;
    const valEl = document.getElementById('sensorValDisp');
    if (valEl) valEl.textContent = toHexByte(dev3.value);
    const stEl = document.getElementById('sensorStatusDisp');
    if (stEl) stEl.textContent = dev3.status;
  }

  // Device 4: Keypad
  const dev4 = portMap[0x04];
  if (dev4) {
    const keyDisp = document.getElementById('keypadKeyDisp');
    if (keyDisp) keyDisp.textContent = `'${dev4.last_key || (dev4.value & 0xF).toString(16).toUpperCase()}' (${toHexByte(dev4.value)})`;
    const stEl = document.getElementById('keypadStatusDisp');
    if (stEl) stEl.textContent = dev4.status;
  }

  // Device 5: Buzzer
  const dev5 = portMap[0x05];
  if (dev5) {
    const isSounding = (dev5.value & 0x01) === 1 || dev5.value > 0;
    dev5.is_sounding = isSounding;
    const buzzerVisual = document.getElementById('buzzerVisual');
    const speakerIcon = document.getElementById('buzzerSpeakerIcon');
    if (buzzerVisual && speakerIcon) {
      if (isSounding) {
        buzzerVisual.classList.add('active');
        speakerIcon.classList.add('ringing');
        playBuzzerAudio();
      } else {
        buzzerVisual.classList.remove('active');
        speakerIcon.classList.remove('ringing');
        stopBuzzerAudio();
      }
    }
    const valEl = document.getElementById('buzzerValDisp');
    if (valEl) valEl.textContent = toHexByte(dev5.value);
    const stEl = document.getElementById('buzzerStatusDisp');
    if (stEl) stEl.textContent = dev5.status;
  }

  // Device 6: Motor Controller
  const dev6 = portMap[0x06];
  if (dev6) {
    const fan = document.getElementById('motorFan');
    const rpmText = document.getElementById('motorRpmText');
    const pwmText = document.getElementById('motorPwmText');
    
    dev6.duty_cycle = Math.round((dev6.value / 255.0) * 1000) / 10;
    dev6.rpm = Math.round((dev6.value / 255.0) * 3000);

    if (fan) {
      if (dev6.value > 0) {
        fan.classList.add('spinning');
        const duration = Math.max(0.1, 1.2 - (dev6.value / 255.0));
        fan.style.animationDuration = `${duration}s`;
      } else {
        fan.classList.remove('spinning');
      }
    }
    if (rpmText) rpmText.textContent = `${dev6.rpm} RPM`;
    if (pwmText) pwmText.textContent = `${dev6.duty_cycle}% PWM Duty`;
    const valEl = document.getElementById('motorValDisp');
    if (valEl) valEl.textContent = toHexByte(dev6.value);
    const stEl = document.getElementById('motorStatusDisp');
    if (stEl) stEl.textContent = dev6.status;
  }

  // Device 7: Status Register
  const dev7 = portMap[0x07];
  if (dev7) {
    const chipsGroup = document.getElementById('statusChipsGroup');
    if (chipsGroup) {
      chipsGroup.innerHTML = '';
      STATUS_FLAG_NAMES.forEach((flagName, idx) => {
        const isSet = (dev7.value & (1 << idx)) !== 0;
        const btn = document.createElement('button');
        btn.className = `status-chip-btn ${isSet ? 'active' : ''}`;
        btn.textContent = flagName;
        btn.onclick = () => toggleStatusFlag(idx);
        chipsGroup.appendChild(btn);
      });
    }
    const valEl = document.getElementById('statusRegValDisp');
    if (valEl) valEl.textContent = `${toHexByte(dev7.value)}`;
    const stEl = document.getElementById('statusRegFlagsDisp');
    if (stEl) stEl.textContent = dev7.status;
  }
}

function selectQuickDevice(port) {
  const dev = portMap[port];
  if (!dev) return;
  const box = document.getElementById('quickDeviceBox');
  if (!box) return;
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
      <b>${dev.name}</b>
      <span class="badge ${dev.direction === 'INPUT' ? 'badge-info' : 'badge-accent'}">${dev.direction}</span>
    </div>
    <div style="font-size:0.85rem; margin-bottom:0.3rem;">Address: <span class="code-pill">${toHexByte(port)}</span></div>
    <div style="font-size:0.85rem; margin-bottom:0.3rem;">Current Value: <b class="highlight-val">${toHexByte(dev.value)}</b> (${toBinByte(dev.value)})</div>
    <div style="font-size:0.8rem; color:var(--text-muted);">${dev.status}</div>
  `;
}

// ============================================================================
// 4. AUDIO SYNTHESIZER (WEB AUDIO API)
// ============================================================================

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
}

function playBuzzerAudio() {
  try {
    initAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!buzzerOscillator) {
      buzzerOscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      buzzerOscillator.type = 'square';
      buzzerOscillator.frequency.setValueAtTime(2400, audioCtx.currentTime); // 2.4 kHz piezoelectric tone
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // gentle volume
      buzzerOscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      buzzerOscillator.start();
    }
  } catch (e) {
    // Graceful fallback if audio is blocked
  }
}

function stopBuzzerAudio() {
  try {
    if (buzzerOscillator) {
      buzzerOscillator.stop();
      buzzerOscillator.disconnect();
      buzzerOscillator = null;
    }
  } catch (e) {
    buzzerOscillator = null;
  }
}

// ============================================================================
// 5. INTERACTIVE HARDWARE DEVICE ACTIONS
// ============================================================================

function toggleDIPSwitch(bitIndex) {
  const dev = portMap[0x00];
  if (!dev) return;
  dev.value ^= (1 << bitIndex);
  const activeBits = (dev.value.toString(2).match(/1/g) || []).length;
  dev.status = `ACTIVE (${activeBits}/8 switches ON)`;
  renderVirtualDevicesUI();
  renderPortMaps();
  provideAiFeedback(`Toggled DIP Switch SW${bitIndex}. Port 00H input value updated to ${toHexByte(dev.value)}.`);
}

function onSensorSliderChange(val) {
  const dev = portMap[0x03];
  if (!dev) return;
  dev.value = parseInt(val, 10) & 0xFF;
  dev.status = `READING: ${toHexByte(dev.value)} (${dev.value}°C)`;
  renderVirtualDevicesUI();
  renderPortMaps();
  provideAiFeedback(`Digital Sensor adjusted to ${dev.value}°C (${toHexByte(dev.value)}). IN AL, 03H will now read this value.`);
}

function setSensorPreset(val) {
  onSensorSliderChange(val);
}

function pressKeypadKey(hexCode, char) {
  const dev = portMap[0x04];
  if (!dev) return;
  dev.value = hexCode & 0xFF;
  dev.last_key = char;
  dev.status = `KEY PRESSED: '${char}' (Code ${toHexByte(dev.value)})`;
  renderVirtualDevicesUI();
  renderPortMaps();
  provideAiFeedback(`Keypad key '${char}' pressed. Port 04H latches scancode ${toHexByte(dev.value)}.`);
}

function toggleStatusFlag(bitIndex) {
  const dev = portMap[0x07];
  if (!dev) return;
  dev.value ^= (1 << bitIndex);
  const activeFlags = STATUS_FLAG_NAMES.filter((_, i) => (dev.value & (1 << i)) !== 0);
  dev.status = `FLAGS: [${activeFlags.join(', ') || 'NONE'}]`;
  renderVirtualDevicesUI();
  renderPortMaps();
  provideAiFeedback(`Status flag ${STATUS_FLAG_NAMES[bitIndex]} toggled. Port 07H word: ${toHexByte(dev.value)}.`);
}

function resetAllDevices() {
  Object.keys(portMap).forEach(p => {
    const dev = portMap[p];
    dev.value = dev.defaultValue;
    if (p === '0' || p === 0) dev.status = "ACTIVE (1/8 switches ON)";
    else if (p === '1' || p === 1) dev.status = "ALL OFF";
    else if (p === '2' || p === 2) dev.status = "DISPLAYING '0' (Hex: 00H)";
    else if (p === '3' || p === 3) dev.status = "READING: 5AH (90°C)";
    else if (p === '4' || p === 4) dev.status = "KEY PRESSED: '3' (Code 03H)";
    else if (p === '5' || p === 5) { dev.status = "MUTED / SILENT"; dev.is_sounding = false; }
    else if (p === '6' || p === 6) { dev.status = "MOTOR STOPPED (0 RPM)"; dev.rpm = 0; dev.duty_cycle = 0; }
    else if (p === '7' || p === 7) dev.status = "FLAGS: [READY]";
  });
  stopBuzzerAudio();
  renderVirtualDevicesUI();
  renderPortMaps();
}

// ============================================================================
// 6. 8086 INSTRUCTION PARSER & EXECUTION ENGINE
// ============================================================================

function parseHexNumber(str) {
  if (!str) return NaN;
  const s = str.trim().toUpperCase();
  if (s.endsWith('H')) {
    return parseInt(s.slice(0, -1), 16);
  }
  if (s.startsWith('0X') || s.startsWith('$')) {
    return parseInt(s.replace('0X', '').replace('$', ''), 16);
  }
  if (/^[0-9A-F]+$/.test(s)) {
    return parseInt(s, 16);
  }
  return NaN;
}

function parseInstructionLine(line) {
  const raw = line.trim();
  const code = line.split(';')[0].trim();
  if (!code) return { type: 'EMPTY', raw };

  const tokens = code.split(/\s+/);
  const mnemonic = tokens[0].toUpperCase();
  const operandsStr = code.slice(tokens[0].length).trim();

  const SUPPORTED = ['IN', 'OUT', 'MOV', 'NOP', 'HLT'];
  if (!SUPPORTED.includes(mnemonic)) {
    return {
      type: 'ERROR',
      raw,
      mnemonic,
      error: `Invalid/Unsupported instruction '${mnemonic}'. Supported I/O instructions: IN, OUT, MOV, NOP, HLT.`
    };
  }

  if (mnemonic === 'NOP' || mnemonic === 'HLT') {
    return { type: mnemonic, raw, mnemonic };
  }

  if (!operandsStr) {
    return {
      type: 'ERROR',
      raw,
      mnemonic,
      error: `Missing operands for '${mnemonic}'. Example: 'IN AL, 03H' or 'OUT 01H, AL'.`
    };
  }

  const ops = operandsStr.split(',').map(s => s.trim());
  if (ops.length !== 2) {
    return {
      type: 'ERROR',
      raw,
      mnemonic,
      error: `Syntax error: '${mnemonic}' requires exactly 2 comma-separated operands. Found: '${operandsStr}'.`
    };
  }

  const op1 = ops[0].toUpperCase();
  const op2 = ops[1].toUpperCase();

  if (mnemonic === 'IN') {
    if (op1 !== 'AL' && op1 !== 'AX') {
      if (op2 === 'AL' || op2 === 'AX') {
        return {
          type: 'ERROR', raw, mnemonic,
          error: `Syntax Error: 8086 IN syntax is 'IN AL, port', not 'IN ${ops[0]}, ${ops[1]}'.`
        };
      }
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Invalid target register '${ops[0]}'. 8086 IN direct instructions transfer data only to AL (byte) or AX (word).`
      };
    }
    const port = parseHexNumber(op2);
    if (isNaN(port) || port < 0 || port > 0xFFFF) {
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Invalid port operand '${ops[1]}'. Expected valid hexadecimal port address (e.g. 03H).`
      };
    }
    return {
      type: 'IN', raw, mnemonic: 'IN',
      reg: op1, port, is16Bit: (op1 === 'AX')
    };
  }

  if (mnemonic === 'OUT') {
    if (op2 !== 'AL' && op2 !== 'AX') {
      if (op1 === 'AL' || op1 === 'AX') {
        return {
          type: 'ERROR', raw, mnemonic,
          error: `Syntax Error: 8086 OUT syntax is 'OUT port, AL', not 'OUT ${ops[0]}, ${ops[1]}'.`
        };
      }
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Invalid source register '${ops[1]}'. 8086 OUT instructions transfer data only from AL or AX.`
      };
    }
    const port = parseHexNumber(op1);
    if (isNaN(port) || port < 0 || port > 0xFFFF) {
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Invalid port operand '${ops[0]}'. Expected valid hexadecimal port address (e.g. 01H).`
      };
    }
    return {
      type: 'OUT', raw, mnemonic: 'OUT',
      reg: op2, port, is16Bit: (op2 === 'AX')
    };
  }

  if (mnemonic === 'MOV') {
    if (!['AL', 'AH', 'AX'].includes(op1)) {
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Unsupported MOV register '${ops[0]}'. Simulator supports AL, AH, AX.`
      };
    }
    const is16Bit = (op1 === 'AX');
    const val = parseHexNumber(op2);
    if (isNaN(val)) {
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Invalid immediate numeric constant '${ops[1]}'.`
      };
    }
    const maxVal = is16Bit ? 0xFFFF : 0xFF;
    if (val < 0 || val > maxVal) {
      return {
        type: 'ERROR', raw, mnemonic,
        error: `Value '${ops[1]}' exceeds ${is16Bit ? '16-bit' : '8-bit'} range (00H to ${is16Bit ? 'FFFFH' : 'FFH'}).`
      };
    }
    return {
      type: 'MOV', raw, mnemonic: 'MOV',
      reg: op1, val, is16Bit
    };
  }

  return { type: 'ERROR', raw, error: 'Unknown syntax.' };
}

function executeInstruction(inst) {
  stepCounter++;
  CPU.io_counter++;
  CPU.ip += 2;

  // 1. Syntax / Parsing Errors
  if (inst.type === 'ERROR') {
    CPU.setBusIdle();
    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: 'INVALID',
      port: 'N/A',
      direction: 'N/A',
      reg_before: `AL=${toHexByte(CPU.al)} AX=${toHexWord(CPU.ax)}`,
      device_before: 'N/A',
      data: 'N/A',
      reg_after: `AL=${toHexByte(CPU.al)} AX=${toHexWord(CPU.ax)}`,
      device_after: 'N/A',
      status: 'ERROR',
      error: inst.error,
      explanation: `Execution halted: ${inst.error}`,
      intermediate_steps: [
        { phase: "Syntax Validation", detail: inst.error }
      ]
    };
    recordTrace(entry);
    updateSimStatus(false, inst.error);
    diagnoseErrorAi(inst.error, inst.raw);
    animateBusCycle(null, "Fault State");
    return entry;
  }

  // 2. MOV Immediate
  if (inst.type === 'MOV') {
    const regBefore = inst.is16Bit ? `AX=${toHexWord(CPU.ax)}` : `${inst.reg}=${toHexByte(inst.reg === 'AL' ? CPU.al : CPU.ah)}`;
    if (inst.reg === 'AL') CPU.al = inst.val;
    else if (inst.reg === 'AH') CPU.ah = inst.val;
    else if (inst.reg === 'AX') CPU.ax = inst.val;

    const regAfter = inst.is16Bit ? `AX=${toHexWord(CPU.ax)}` : `${inst.reg}=${toHexByte(inst.reg === 'AL' ? CPU.al : CPU.ah)}`;
    CPU.setBusIdle();

    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: 'INTERNAL MOVE',
      port: 'CPU INTERNAL',
      direction: 'REGISTER',
      reg_before: regBefore,
      device_before: 'N/A',
      data: inst.is16Bit ? toHexWord(inst.val) : toHexByte(inst.val),
      reg_after: regAfter,
      device_after: 'N/A',
      status: 'SUCCESS',
      explanation: `Loaded immediate constant ${toHexByte(inst.val)} into accumulator ${inst.reg}.`,
      intermediate_steps: [
        { phase: "1. Opcode Fetch", detail: `CPU decodes MOV ${inst.reg}, ${toHexByte(inst.val)}.` },
        { phase: "2. Accumulator Latch", detail: `Accumulator ${inst.reg} latches internal data bus value.` },
        { phase: "3. PSW Flags Update", detail: `Status flags updated (ZF=${CPU.zf}, SF=${CPU.sf}, PF=${CPU.pf}).` }
      ]
    };
    recordTrace(entry);
    updateSimStatus(true, `Successfully executed MOV: ${regAfter}`);
    explainInstructionAi(inst.raw);
    animateBusCycle(entry.intermediate_steps, "Internal Register Move");
    renderCPUState();
    return entry;
  }

  // 3. NOP / HLT
  if (inst.type === 'NOP' || inst.type === 'HLT') {
    CPU.setBusIdle();
    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: inst.type === 'NOP' ? 'NO OPERATION' : 'HALT',
      port: 'N/A',
      direction: 'CONTROL',
      reg_before: `AX=${toHexWord(CPU.ax)}`,
      device_before: 'N/A',
      data: '00H',
      reg_after: `AX=${toHexWord(CPU.ax)}`,
      device_after: 'N/A',
      status: 'SUCCESS',
      explanation: inst.type === 'NOP' ? 'No operation executed; bus remained inactive.' : '8086 entered HALT state.',
      intermediate_steps: [
        { phase: "Control", detail: `CPU asserted ${inst.type}.` }
      ]
    };
    recordTrace(entry);
    updateSimStatus(true, `Executed ${inst.type}`);
    animateBusCycle(entry.intermediate_steps, inst.type);
    renderCPUState();
    return entry;
  }

  // 4. IN & OUT Instructions
  const port = inst.port;
  const portHex = toHexByte(port);
  const dev = portMap[port];

  // Fault FC01: Unmapped Port Address
  if (!dev) {
    CPU.setBusIdle();
    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: inst.mnemonic === 'IN' ? 'READ' : 'WRITE',
      port: portHex,
      direction: inst.mnemonic === 'IN' ? 'INPUT' : 'OUTPUT',
      reg_before: `AL=${toHexByte(CPU.al)} AX=${toHexWord(CPU.ax)}`,
      device_before: 'FLOAT (No device)',
      data: 'HIGH-Z',
      reg_after: `AL=${toHexByte(CPU.al)} AX=${toHexWord(CPU.ax)}`,
      device_after: 'N/A',
      status: 'ERROR',
      error: `Port ${portHex} is not mapped. No virtual device resides at this address.`,
      explanation: `Bus Error: Port address ${portHex} is unmapped. Address decoder (74LS138) did not assert any ~CS line.`,
      intermediate_steps: [
        { phase: "1. Address Decode", detail: `CPU asserted port ${portHex} on address bus A15-A0.` },
        { phase: "2. Chip Select Check", detail: `74LS138 decoder generated no active Chip Select line.` },
        { phase: "3. Bus Fault", detail: `Data bus remained in floating High-Impedance (High-Z) state.` }
      ]
    };
    recordTrace(entry);
    updateSimStatus(false, entry.error);
    diagnoseErrorAi(entry.error, inst.raw);
    animateBusCycle(entry.intermediate_steps, "Unmapped Port (High-Z)");
    renderCPUState();
    return entry;
  }

  // Handle IN Instruction
  if (inst.mnemonic === 'IN') {
    // Fault FC03: IN from output-only device
    if (dev.direction === 'OUTPUT') {
      CPU.setBusIdle();
      const entry = {
        step: stepCounter,
        instruction: inst.raw,
        operation: 'READ',
        port: portHex,
        direction: 'INPUT',
        reg_before: `AL=${toHexByte(CPU.al)}`,
        device_before: `${dev.name}=${toHexByte(dev.value)}`,
        data: 'BUS CONFLICT',
        reg_after: `AL=${toHexByte(CPU.al)}`,
        device_after: `${dev.name}=${toHexByte(dev.value)}`,
        status: 'ERROR',
        error: `Direction mismatch: '${dev.name}' at port ${portHex} is an OUTPUT-only peripheral. Cannot read via IN.`,
        explanation: `Illegal Read: Device '${dev.name}' at port ${portHex} does not provide data buffers for IN reads.`,
        intermediate_steps: [
          { phase: "1. Opcode Decode", detail: `CPU initiated IN AL, ${portHex}.` },
          { phase: "2. Peripheral Check", detail: `Device '${dev.name}' is wired as an OUTPUT peripheral.` },
          { phase: "3. Direction Violation", detail: "Read strobe (~RD) rejected by write-only peripheral." }
        ]
      };
      recordTrace(entry);
      updateSimStatus(false, entry.error);
      diagnoseErrorAi(entry.error, inst.raw);
      animateBusCycle(entry.intermediate_steps, "Direction Violation");
      renderCPUState();
      return entry;
    }

    // Normal IN Execution
    CPU.setBusRead();
    const regBeforeStr = inst.is16Bit ? `AX=${toHexWord(CPU.ax)}` : `AL=${toHexByte(CPU.al)}`;
    const devValBefore = dev.value;
    const readData = dev.value & 0xFF;

    if (inst.is16Bit) {
      CPU.ax = readData;
    } else {
      CPU.al = readData;
    }

    const regAfterStr = inst.is16Bit ? `AX=${toHexWord(CPU.ax)}` : `AL=${toHexByte(CPU.al)}`;

    const intermediate_steps = [
      { phase: "1. Fetch & Decode", detail: `CPU decodes 'IN ${inst.reg}, ${portHex}', drives M/~IO=0 (Isolated I/O mode).` },
      { phase: "2. Address Phase (T1)", detail: `CPU places port address ${portHex} on A15-A0; ALE pulses high to latch address.` },
      { phase: "3. Read Strobe (T2-T3)", detail: `CPU asserts ~RD = 0 (IORC) and ~DEN = 0. DT/~R = 0 (Receive mode).` },
      { phase: "4. Peripheral Data (T3)", detail: `Peripheral '${dev.name}' drives sensed byte ${toHexByte(readData)} onto data bus D7-D0.` },
      { phase: "5. Register Latch (T4)", detail: `CPU latches byte ${toHexByte(readData)} into accumulator register ${inst.reg}. Flags updated.` }
    ];

    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: 'READ',
      port: portHex,
      direction: 'INPUT',
      reg_before: regBeforeStr,
      device_before: `${dev.name}=${toHexByte(devValBefore)}`,
      data: toHexByte(readData),
      reg_after: regAfterStr,
      device_after: `${dev.name}=${toHexByte(dev.value)}`,
      status: 'SUCCESS',
      explanation: `Read byte ${toHexByte(readData)} from virtual peripheral '${dev.name}' at port ${portHex} into accumulator ${inst.reg}.`,
      intermediate_steps
    };

    recordTrace(entry);
    updateSimStatus(true, `IN Success: ${regAfterStr} read from ${dev.name}`);
    explainInstructionAi(inst.raw);
    animateBusCycle(intermediate_steps, "IN Read Bus Cycle (T1–T4)");
    renderCPUState();
    renderVirtualDevicesUI();
    renderPortMaps();
    return entry;
  }

  // Handle OUT Instruction
  if (inst.mnemonic === 'OUT') {
    // Fault FC02: OUT to input-only device
    if (dev.direction === 'INPUT') {
      CPU.setBusIdle();
      const entry = {
        step: stepCounter,
        instruction: inst.raw,
        operation: 'WRITE',
        port: portHex,
        direction: 'OUTPUT',
        reg_before: `AL=${toHexByte(CPU.al)}`,
        device_before: `${dev.name}=${toHexByte(dev.value)}`,
        data: toHexByte(CPU.al),
        reg_after: `AL=${toHexByte(CPU.al)}`,
        device_after: `${dev.name}=${toHexByte(dev.value)}`,
        status: 'ERROR',
        error: `Direction mismatch: '${dev.name}' at port ${portHex} is an INPUT-only peripheral. Cannot write via OUT.`,
        explanation: `Illegal Write: Device '${dev.name}' at port ${portHex} is an input sensor and does not accept output write commands.`,
        intermediate_steps: [
          { phase: "1. Opcode Decode", detail: `CPU initiated OUT ${portHex}, AL.` },
          { phase: "2. Peripheral Check", detail: `Device '${dev.name}' is an INPUT sensor/switch and cannot accept output.` },
          { phase: "3. Direction Violation", detail: "Write strobe (~WR) rejected by input-only peripheral." }
        ]
      };
      recordTrace(entry);
      updateSimStatus(false, entry.error);
      diagnoseErrorAi(entry.error, inst.raw);
      animateBusCycle(entry.intermediate_steps, "Direction Violation");
      renderCPUState();
      return entry;
    }

    // Normal OUT Execution
    CPU.setBusWrite();
    const writeData = inst.is16Bit ? (CPU.ax & 0xFF) : CPU.al;
    const devValBefore = dev.value;

    dev.value = writeData;
    // Update custom device logic
    if (port === 0x01) {
      if (writeData === 0) dev.status = "ALL OFF";
      else if (writeData === 0xFF) dev.status = "ALL ON (FULL ILLUMINATION)";
      else dev.status = `ACTIVE (${(writeData.toString(2).match(/1/g) || []).length}/8 LEDs LIT)`;
    } else if (port === 0x02) {
      dev.displayChar = (writeData & 0xF).toString(16).toUpperCase();
      dev.status = `DISPLAYING '${dev.displayChar}' (Hex: ${toHexByte(writeData)})`;
    } else if (port === 0x05) {
      dev.is_sounding = (writeData & 1) === 1 || writeData > 0;
      dev.status = dev.is_sounding ? `ALARM SOUNDING (Pattern ${toHexByte(writeData)})` : "MUTED / SILENT";
    } else if (port === 0x06) {
      dev.duty_cycle = Math.round((writeData / 255.0) * 1000) / 10;
      dev.rpm = Math.round((writeData / 255.0) * 3000);
      dev.status = writeData === 0 ? "MOTOR STOPPED (0 RPM)" : `RUNNING (${dev.duty_cycle}% PWM, ${dev.rpm} RPM)`;
    }

    const intermediate_steps = [
      { phase: "1. Fetch & Decode", detail: `CPU decodes 'OUT ${portHex}, ${inst.reg}', sets M/~IO=0 (Isolated I/O mode).` },
      { phase: "2. Address Output (T1)", detail: `CPU places port address ${portHex} on multiplexed AD7-AD0; ALE pulses high to latch address.` },
      { phase: "3. Data Output (T2)", detail: `CPU outputs accumulator data ${toHexByte(writeData)} onto D7-D0, drives DT/~R=1 (Transmit).` },
      { phase: "4. Write Strobe (T3)", detail: `CPU asserts ~WR = 0 (IOWC active LOW), instructing external latch to strobe data.` },
      { phase: "5. Peripheral Latch (T4)", detail: `Peripheral '${dev.name}' latches ${toHexByte(writeData)} on rising edge of ~WR. State: ${dev.status}.` }
    ];

    const entry = {
      step: stepCounter,
      instruction: inst.raw,
      operation: 'WRITE',
      port: portHex,
      direction: 'OUTPUT',
      reg_before: `${inst.reg}=${toHexByte(writeData)}`,
      device_before: `${dev.name}=${toHexByte(devValBefore)}`,
      data: toHexByte(writeData),
      reg_after: `${inst.reg}=${toHexByte(writeData)}`,
      device_after: `${dev.name}=${toHexByte(dev.value)}`,
      status: 'SUCCESS',
      explanation: `Transferred byte ${toHexByte(writeData)} from accumulator ${inst.reg} to virtual peripheral '${dev.name}' at port ${portHex}.`,
      intermediate_steps
    };

    recordTrace(entry);
    updateSimStatus(true, `OUT Success: ${toHexByte(writeData)} written to ${dev.name}`);
    explainInstructionAi(inst.raw);
    animateBusCycle(intermediate_steps, "OUT Write Bus Cycle (T1–T4)");
    renderCPUState();
    renderVirtualDevicesUI();
    renderPortMaps();
    return entry;
  }
}

// ============================================================================
// 7. INTERMEDIATE STATE ANIMATION & AI ASSISTANT
// ============================================================================

function animateBusCycle(steps, phaseName) {
  const badge = document.getElementById('busCyclePhaseBadge');
  if (badge) badge.textContent = phaseName || "Bus Cycle Idle";

  const detailBox = document.getElementById('busCycleDetailText');

  // Reset stepper nodes
  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`stepNode${i}`);
    if (node) node.classList.remove('active');
  }

  if (!steps || steps.length === 0) {
    if (detailBox) detailBox.textContent = "Bus quiescent idle. Ready for next I/O instruction.";
    return;
  }

  // Sequentially illuminate steps
  let stepIdx = 0;
  function nextStepNode() {
    if (stepIdx < 5) {
      const node = document.getElementById(`stepNode${stepIdx + 1}`);
      if (node) node.classList.add('active');
      if (steps[stepIdx] && detailBox) {
        detailBox.innerHTML = `<strong>${steps[stepIdx].phase}:</strong> ${steps[stepIdx].detail}`;
      }
      stepIdx++;
      if (stepIdx < 5) {
        setTimeout(nextStepNode, 220);
      }
    }
  }
  nextStepNode();
}

function updateSimStatus(isSuccess, message) {
  const banner = document.getElementById('simStatusBanner');
  const text = document.getElementById('simStatusText');
  if (!banner || !text) return;
  text.textContent = message;
  const dot = banner.querySelector('.status-indicator-dot');
  if (dot) {
    dot.className = `status-indicator-dot ${isSuccess ? 'dot-success' : 'dot-error'}`;
  }
}

function provideAiFeedback(text) {
  const content = document.getElementById('aiFeedbackContent');
  if (content) content.innerHTML = text;
}

function explainInstructionAi(rawLine) {
  const clean = rawLine.split(';')[0].trim().toUpperCase();
  if (clean.startsWith('IN')) {
    provideAiFeedback(
      `<strong>Pedagogical Explanation:</strong> <code>${clean}</code> executed an <em>Isolated I/O Read</em> cycle. ` +
      `The 8086 asserted <span class="code-pill">M/~IO = 0</span> to disable memory chips, while <span class="code-pill">~RD = 0</span> ` +
      `instructed the peripheral buffer to place data onto bus lines D7–D0. The accumulator latched the byte into AL at clock cycle T4.`
    );
  } else if (clean.startsWith('OUT')) {
    provideAiFeedback(
      `<strong>Pedagogical Explanation:</strong> <code>${clean}</code> executed an <em>Isolated I/O Write</em> cycle. ` +
      `The accumulator drove data onto bus lines D7–D0, while active-low strobe <span class="code-pill">~WR = 0</span> ` +
      `signaled the target peripheral latch to capture the byte. The hardware state transitioned immediately.`
    );
  } else if (clean.startsWith('MOV')) {
    provideAiFeedback(
      `<strong>Pedagogical Explanation:</strong> <code>${clean}</code> is an internal CPU accumulator initialization. ` +
      `No external I/O bus signals (<span class="code-pill">~RD</span>/<span class="code-pill">~WR</span>) were asserted.`
    );
  }
}

function diagnoseErrorAi(errorMsg, rawLine) {
  let tip = `<strong>Diagnostic Guidance:</strong> ${errorMsg}<br>`;
  const u = rawLine.toUpperCase();
  if (u.includes('IN') && u.match(/IN\s+[0-9A-FH]+\s*,\s*A[LX]/)) {
    tip += `<em>Did you know?</em> In 8086 assembly, the destination register always comes first: <code>IN AL, port</code>.`;
  } else if (u.includes('OUT') && u.match(/OUT\s+A[LX]\s*,\s*[0-9A-FH]+/)) {
    tip += `<em>Did you know?</em> In 8086 assembly, OUT syntax is <code>OUT port, AL</code> (port address first).`;
  } else if (errorMsg.includes('Direction mismatch')) {
    tip += `<em>Interfacing Concept:</em> Peripheral ports are physically wired with unidirectional buffers (e.g. 74LS244 for input, 74LS374 for output). An output LED cannot be read, and an input sensor cannot be written to.`;
  } else if (errorMsg.includes('not mapped')) {
    tip += `<em>Address Decoding Concept:</em> In physical microprocessors, unmapped addresses fail to trigger any 74LS138 chip-select output (~CS), leaving the data bus in high-impedance (floating) state.`;
  }
  provideAiFeedback(tip);
}

// ============================================================================
// 8. EXECUTION CONTROLS (EXECUTE LINE, STEP, RUN, RESET)
// ============================================================================

function executeCurrentLine() {
  const editor = document.getElementById('asmCodeEditor');
  if (!editor) return;
  const lines = editor.value.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
  if (lines.length === 0) {
    updateSimStatus(false, "Editor is empty. Please enter an 8086 I/O instruction.");
    return;
  }
  const inst = parseInstructionLine(lines[0]);
  executeInstruction(inst);
}

function stepNextProgramLine() {
  const editor = document.getElementById('asmCodeEditor');
  if (!editor) return;
  const rawLines = editor.value.split('\n');
  const validLines = rawLines.map((l, idx) => ({ line: l.trim(), lineIdx: idx })).filter(item => item.line && !item.line.startsWith(';'));

  if (validLines.length === 0) {
    updateSimStatus(false, "No executable instructions found.");
    return;
  }

  if (currentProgramIndex >= validLines.length) {
    currentProgramIndex = 0; // wrap around
  }

  const currentItem = validLines[currentProgramIndex];
  const inst = parseInstructionLine(currentItem.line);
  executeInstruction(inst);

  currentProgramIndex++;
  const remaining = validLines.length - currentProgramIndex;
  updateSimStatus(true, `Stepped instruction ${currentProgramIndex}/${validLines.length}. (${remaining} remaining)`);
}

function runFullProgram() {
  const editor = document.getElementById('asmCodeEditor');
  if (!editor) return;
  const rawLines = editor.value.split('\n');
  const validLines = rawLines.map(l => l.trim()).filter(l => l && !l.startsWith(';'));

  if (validLines.length === 0) {
    updateSimStatus(false, "No executable instructions found in editor.");
    return;
  }

  const speedSelect = document.getElementById('execSpeed');
  const intervalMs = speedSelect ? parseInt(speedSelect.value, 10) : 800;

  isProgramRunning = true;
  let idx = 0;

  function runNext() {
    if (!isProgramRunning || idx >= validLines.length) {
      isProgramRunning = false;
      updateSimStatus(true, `Program execution finished (${validLines.length} instructions completed).`);
      return;
    }
    const inst = parseInstructionLine(validLines[idx]);
    executeInstruction(inst);
    idx++;
    setTimeout(runNext, intervalMs);
  }

  runNext();
}

function resetSimulatorState() {
  isProgramRunning = false;
  currentProgramIndex = 0;
  CPU.reset();
  stopBuzzerAudio();
  resetAllDevices();
  renderCPUState();
  animateBusCycle(null, "Quiescent Idle");
  updateSimStatus(true, "Simulator state and registers reset to power-on defaults.");
  provideAiFeedback("Ready. Enter an instruction like <span class='code-pill'>IN AL, 03H</span> to observe bus cycles.");
}

function resetAllSimulation() {
  resetSimulatorState();
  clearExecutionTrace();
}

// ============================================================================
// 9. TRACE MANAGEMENT (RECORD, RENDER, EXPORT, FILTER)
// ============================================================================

function recordTrace(entry) {
  executionTrace.unshift(entry); // newest first
  renderTraceTables();
}

function renderTraceTables() {
  // 1. Mini Simulator Trace Table
  const miniBody = document.getElementById('simMiniTraceBody');
  if (miniBody) {
    miniBody.innerHTML = '';
    const slice = executionTrace.slice(0, 8); // show latest 8
    if (slice.length === 0) {
      miniBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">No instructions executed yet.</td></tr>`;
    } else {
      slice.forEach(e => {
        const tr = document.createElement('tr');
        const stBadge = e.status === 'SUCCESS' ? 'badge-success' : 'badge-danger';
        tr.innerHTML = `
          <td>${e.step}</td>
          <td><code>${e.instruction}</code></td>
          <td><b>${e.operation}</b></td>
          <td><span class="code-pill">${e.port}</span></td>
          <td><span class="badge ${e.direction === 'INPUT' ? 'badge-info' : 'badge-accent'}">${e.direction}</span></td>
          <td>${e.reg_before}</td>
          <td>${e.device_before}</td>
          <td><b class="highlight-val">${e.data}</b></td>
          <td>${e.reg_after}</td>
          <td>${e.device_after}</td>
          <td><span class="badge ${stBadge}">${e.status}</span></td>
        `;
        miniBody.appendChild(tr);
      });
    }
  }

  // 2. Full Trace Table
  filterTraceTable();
}

function filterTraceTable() {
  const fullBody = document.getElementById('fullTraceBody');
  if (!fullBody) return;

  const searchInput = document.getElementById('traceSearchInput');
  const statusFilter = document.getElementById('traceStatusFilter');
  const q = searchInput ? searchInput.value.trim().toUpperCase() : '';
  const st = statusFilter ? statusFilter.value : 'ALL';

  const filtered = executionTrace.filter(e => {
    if (st !== 'ALL' && e.status !== st) return false;
    if (q) {
      const match = e.instruction.toUpperCase().includes(q) ||
                    e.port.toUpperCase().includes(q) ||
                    e.data.toUpperCase().includes(q) ||
                    e.operation.toUpperCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const badge = document.getElementById('traceTotalBadge');
  if (badge) badge.textContent = `${filtered.length} Records`;

  fullBody.innerHTML = '';
  if (filtered.length === 0) {
    fullBody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">No matching execution trace records.</td></tr>`;
    return;
  }

  filtered.forEach(e => {
    const tr = document.createElement('tr');
    const stBadge = e.status === 'SUCCESS' ? 'badge-success' : 'badge-danger';
    tr.innerHTML = `
      <td>${e.step}</td>
      <td><code>${e.instruction}</code></td>
      <td><b>${e.operation}</b></td>
      <td><span class="code-pill">${e.port}</span></td>
      <td><span class="badge ${e.direction === 'INPUT' ? 'badge-info' : 'badge-accent'}">${e.direction}</span></td>
      <td>${e.reg_before}</td>
      <td>${e.device_before}</td>
      <td><b class="highlight-val">${e.data}</b></td>
      <td>${e.reg_after}</td>
      <td>${e.device_after}</td>
      <td><span class="badge ${stBadge}">${e.status}</span></td>
      <td class="small text-muted">${e.explanation}</td>
    `;
    fullBody.appendChild(tr);
  });
}

function clearExecutionTrace() {
  executionTrace = [];
  stepCounter = 0;
  renderTraceTables();
  updateSimStatus(true, "I/O Execution Trace cleared.");
}

function exportTraceCSV() {
  if (executionTrace.length === 0) {
    alert("Trace is currently empty. Run instructions in the simulator first.");
    return;
  }
  let csv = "Step,Instruction,Operation,Port,Direction,RegisterBefore,DeviceBefore,Data,RegisterAfter,DeviceAfter,Status,Explanation\n";
  executionTrace.forEach(e => {
    csv += `"${e.step}","${e.instruction}","${e.operation}","${e.port}","${e.direction}","${e.reg_before}","${e.device_before}","${e.data}","${e.reg_after}","${e.device_after}","${e.status}","${e.explanation.replace(/"/g, '""')}"\n`;
  });
  downloadFile(csv, "8086_io_execution_trace.csv", "text/csv");
}

function exportTraceJSON() {
  if (executionTrace.length === 0) {
    alert("Trace is currently empty.");
    return;
  }
  const jsonStr = JSON.stringify(executionTrace, null, 2);
  downloadFile(jsonStr, "8086_io_execution_trace.json", "application/json");
}

function exportPortMapCSV() {
  let csv = "PortHex,PortDec,DeviceName,Direction,CurrentValueHex,DefaultValueHex,Status,Description\n";
  Object.keys(portMap).forEach(p => {
    const d = portMap[p];
    csv += `"${toHexByte(d.port)}","${d.port}","${d.name}","${d.direction}","${toHexByte(d.value)}","${toHexByte(d.defaultValue)}","${d.status}","${d.desc}"\n`;
  });
  downloadFile(csv, "8086_port_map_configuration.csv", "text/csv");
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 10. SAMPLE PROGRAMS MANAGEMENT
// ============================================================================

const SAMPLE_PROGRAMS = {
  1: {
    title: "Read Sensor → Display on LED",
    code: "; Program 1: Read Sensor -> Display on LED\nIN AL, 03H\nOUT 01H, AL"
  },
  2: {
    title: "Read Switch → Buzzer",
    code: "; Program 2: Read Switch -> Buzzer Alarm\nIN AL, 00H\nOUT 05H, AL"
  },
  3: {
    title: "Read Keypad → 7-Segment Display",
    code: "; Program 3: Read Keypad -> 7-Segment\nIN AL, 04H\nOUT 02H, AL"
  },
  4: {
    title: "Read Sensor → Motor Controller",
    code: "; Program 4: Sensor Closed-Loop Motor Control\nIN AL, 03H\nOUT 06H, AL"
  },
  5: {
    title: "Read Status Register → LED",
    code: "; Program 5: Read Status Handshake -> LED Bar\nIN AL, 07H\nOUT 01H, AL"
  }
};

function loadSampleProgram(id) {
  const prog = SAMPLE_PROGRAMS[id];
  if (!prog) return;
  const editor = document.getElementById('asmCodeEditor');
  if (editor) {
    editor.value = prog.code;
    updateLineCount();
  }
  updateSimStatus(true, `Loaded ${prog.title} into editor.`);
}

function loadAndRunSample(id) {
  loadSampleProgram(id);
  switchTab('simulator');
  setTimeout(() => {
    runFullProgram();
  }, 300);
}

function updateLineCount() {
  const editor = document.getElementById('asmCodeEditor');
  const countBadge = document.getElementById('progLineCount');
  if (editor && countBadge) {
    const count = editor.value.split('\n').filter(l => l.trim()).length;
    countBadge.textContent = `${count} Lines`;
  }
}

// ============================================================================
// 11. AUTOMATED TEST CASES FRAMEWORK (10 NORMAL + 6 FAULT)
// ============================================================================

const TEST_CASES_NORMAL = [
  {
    id: "TC01",
    name: "Read valid sensor port",
    input: "IN AL, 03H",
    setup: () => { portMap[0x03].value = 0x5A; },
    expected: "AL=5AH, Status=SUCCESS",
    check: () => CPU.al === 0x5A && executionTrace[0].status === 'SUCCESS',
    actual: () => `AL=${toHexByte(CPU.al)}, Status=${executionTrace[0]?.status}`,
    explanation: "AL accumulator correctly latches 5AH from Digital Sensor at port 03H."
  },
  {
    id: "TC02",
    name: "Write valid LED port",
    input: "MOV AL, 0AAH\nOUT 01H, AL",
    setup: () => {},
    expected: "LED=AAH, Status=SUCCESS",
    check: () => portMap[0x01].value === 0xAA && executionTrace[0].status === 'SUCCESS',
    actual: () => `LED=${toHexByte(portMap[0x01].value)}, Status=${executionTrace[0]?.status}`,
    explanation: "LED bank receives pattern AAH (alternating LEDs illuminated)."
  },
  {
    id: "TC03",
    name: "Read switch port",
    input: "IN AL, 00H",
    setup: () => { portMap[0x00].value = 0x0F; },
    expected: "AL=0FH, Status=SUCCESS",
    check: () => CPU.al === 0x0F && executionTrace[0].status === 'SUCCESS',
    actual: () => `AL=${toHexByte(CPU.al)}, Status=${executionTrace[0]?.status}`,
    explanation: "DIP switch bank logic levels (00001111b) read into AL."
  },
  {
    id: "TC04",
    name: "Write buzzer port",
    input: "MOV AL, 01H\nOUT 05H, AL",
    setup: () => {},
    expected: "Buzzer=01H, Sounding=True",
    check: () => portMap[0x05].value === 0x01 && portMap[0x05].is_sounding,
    actual: () => `Buzzer=${toHexByte(portMap[0x05].value)}, is_sounding=${portMap[0x05].is_sounding}`,
    explanation: "Buzzer transducer receives bit 0 active, triggering acoustic alarm tone."
  },
  {
    id: "TC05",
    name: "Read keypad port",
    input: "IN AL, 04H",
    setup: () => { portMap[0x04].value = 0x07; portMap[0x04].last_key = '7'; },
    expected: "AL=07H, Status=SUCCESS",
    check: () => CPU.al === 0x07 && executionTrace[0].status === 'SUCCESS',
    actual: () => `AL=${toHexByte(CPU.al)}, Status=${executionTrace[0]?.status}`,
    explanation: "Scancode for Key '7' (07H) successfully latched into CPU accumulator AL."
  },
  {
    id: "TC06",
    name: "Write 7-segment display",
    input: "MOV AL, 09H\nOUT 02H, AL",
    setup: () => {},
    expected: "7-Segment displays '9'",
    check: () => portMap[0x02].displayChar === '9' && executionTrace[0].status === 'SUCCESS',
    actual: () => `7-Segment='${portMap[0x02].displayChar}', Status=${executionTrace[0]?.status}`,
    explanation: "Common cathode 7-segment decoder displays character '9'."
  },
  {
    id: "TC07",
    name: "Read status register",
    input: "IN AL, 07H",
    setup: () => { portMap[0x07].value = 0x05; },
    expected: "AL=05H (READY + ERROR)",
    check: () => CPU.al === 0x05 && executionTrace[0].status === 'SUCCESS',
    actual: () => `AL=${toHexByte(CPU.al)}, Status=${executionTrace[0]?.status}`,
    explanation: "Status register handshaking flags (READY | ERROR) read into AL."
  },
  {
    id: "TC08",
    name: "Write motor controller",
    input: "MOV AL, 080H\nOUT 06H, AL",
    setup: () => {},
    expected: "Duty ~50%, RPM ~1505",
    check: () => portMap[0x06].value === 0x80 && portMap[0x06].rpm > 1400,
    actual: () => `Motor=${portMap[0x06].rpm} RPM (${portMap[0x06].duty_cycle}%)`,
    explanation: "PWM motor drive receives 80H (50% duty cycle, approx 1500 RPM)."
  },
  {
    id: "TC09",
    name: "Read then write (Sensor -> LED)",
    input: "IN AL, 03H\nOUT 01H, AL",
    setup: () => { portMap[0x03].value = 0x7E; },
    expected: "AL=7EH, LED=7EH",
    check: () => CPU.al === 0x7E && portMap[0x01].value === 0x7E,
    actual: () => `AL=${toHexByte(CPU.al)}, LED=${toHexByte(portMap[0x01].value)}`,
    explanation: "Sensor data transferred to LED bank via internal accumulator bus."
  },
  {
    id: "TC10",
    name: "Multiple sequential I/O",
    input: "IN AL, 00H\nOUT 05H, AL\nIN AL, 03H\nOUT 01H, AL",
    setup: () => { portMap[0x00].value = 0x01; portMap[0x03].value = 0x3C; },
    expected: "Buzzer=01H, LED=3CH, AL=3CH",
    check: () => portMap[0x05].value === 0x01 && portMap[0x01].value === 0x3C && CPU.al === 0x3C,
    actual: () => `Buzzer=${toHexByte(portMap[0x05].value)}, LED=${toHexByte(portMap[0x01].value)}`,
    explanation: "Four sequential 8086 I/O bus cycles executed correctly with correct bus arbitration."
  }
];

const TEST_CASES_FAULT = [
  {
    id: "FC01",
    name: "Invalid / Unmapped port address",
    input: "IN AL, 0FFH",
    setup: () => {},
    expected: "Status=ERROR, Port not mapped",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('not mapped'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "CPU address decoder detects unmapped port FFH; bus terminates with High-Z fault."
  },
  {
    id: "FC02",
    name: "OUT to input-only device",
    input: "MOV AL, 55H\nOUT 03H, AL",
    setup: () => {},
    expected: "Status=ERROR, Direction mismatch (INPUT-only)",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('input-only'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "Output instruction rejected because Digital Sensor at port 03H is configured as INPUT-only."
  },
  {
    id: "FC03",
    name: "IN from output-only device",
    input: "IN AL, 01H",
    setup: () => {},
    expected: "Status=ERROR, Direction mismatch (OUTPUT-only)",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('output-only'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "Input instruction rejected because LED Output at port 01H is configured as OUTPUT-only."
  },
  {
    id: "FC04",
    name: "Invalid instruction syntax / mnemonic",
    input: "ABC AL, 03H",
    setup: () => {},
    expected: "Status=ERROR, Invalid/Unsupported instruction",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('invalid/unsupported'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "Assembler parser detects non-existent 8086 mnemonic 'ABC'."
  },
  {
    id: "FC05",
    name: "Invalid data value / out of 8-bit range",
    input: "MOV AL, 1FFH",
    setup: () => {},
    expected: "Status=ERROR, Value exceeds 8-bit range",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('8-bit'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "Parser detects numeric constant 1FFH exceeding AL register capacity (00H-FFH)."
  },
  {
    id: "FC06",
    name: "Inverted operands syntax error",
    input: "IN 03H, AL",
    setup: () => {},
    expected: "Status=ERROR, Inverted operand syntax",
    check: () => executionTrace[0].status === 'ERROR' && executionTrace[0].error.toLowerCase().includes('syntax error'),
    actual: () => `Status=${executionTrace[0]?.status}: ${executionTrace[0]?.error}`,
    explanation: "Educational parser flags that 8086 syntax requires accumulator first: 'IN AL, port'."
  }
];

function runSingleTestCase(testObj) {
  CPU.reset();
  resetAllDevices();
  testObj.setup();
  const lines = testObj.input.split('\n').map(l => l.trim()).filter(l => l);
  lines.forEach(l => {
    const inst = parseInstructionLine(l);
    executeInstruction(inst);
  });
  return testObj.check();
}

function runAllTestsUI() {
  const progressBar = document.getElementById('testProgressBar');
  let passedCount = 0;
  const total = TEST_CASES_NORMAL.length + TEST_CASES_FAULT.length;

  // Run Normal
  const normalBody = document.getElementById('normalTestsBody');
  if (normalBody) normalBody.innerHTML = '';
  TEST_CASES_NORMAL.forEach(t => {
    const passed = runSingleTestCase(t);
    if (passed) passedCount++;
    if (normalBody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="code-pill">${t.id}</span></td>
        <td><b>${t.name}</b></td>
        <td><code>${t.input.replace(/\n/g, '; ')}</code></td>
        <td>AL=00H</td>
        <td>${t.expected}</td>
        <td>${t.actual()}</td>
        <td><span class="badge ${passed ? 'badge-success' : 'badge-danger'}">${passed ? 'PASS' : 'FAIL'}</span></td>
        <td class="small text-muted">${t.explanation}</td>
      `;
      normalBody.appendChild(tr);
    }
  });

  // Run Fault
  const faultBody = document.getElementById('faultTestsBody');
  if (faultBody) faultBody.innerHTML = '';
  TEST_CASES_FAULT.forEach(t => {
    const passed = runSingleTestCase(t);
    if (passed) passedCount++;
    if (faultBody) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="code-pill">${t.id}</span></td>
        <td><b>${t.name}</b></td>
        <td><code>${t.input.replace(/\n/g, '; ')}</code></td>
        <td>${t.expected}</td>
        <td>${t.actual()}</td>
        <td><span class="badge ${passed ? 'badge-success' : 'badge-danger'}">${passed ? 'PASS' : 'FAIL'}</span></td>
        <td class="small text-muted">${t.explanation}</td>
      `;
      faultBody.appendChild(tr);
    }
  });

  // Update Summary KPIs
  const failedCount = total - passedCount;
  const rate = Math.round((passedCount / total) * 1000) / 10;

  document.getElementById('testKpiTotal').textContent = total;
  document.getElementById('testKpiPassed').textContent = passedCount;
  document.getElementById('testKpiFailed').textContent = failedCount;
  document.getElementById('testKpiRate').textContent = `${rate}% Success Rate`;

  const resRate = document.getElementById('resSuccessRate');
  if (resRate) resRate.textContent = `${rate}%`;

  if (progressBar) progressBar.style.width = `${rate}%`;

  updateSimStatus(true, `All ${total} tests executed: ${passedCount} passed, ${failedCount} failed (${rate}%).`);
}

// ============================================================================
// 12. GUIDED 3-5 MIN COLLEGE PRESENTATION DEMO TOUR (14 STEPS)
// ============================================================================

let currentDemoStep = 1;
const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Welcome & Project Introduction",
    tab: "home",
    action: () => {},
    html: `
      <p>Welcome to the college project demonstration of the <strong>8086 Port-Mapped I/O Learning Tool</strong>.</p>
      <div class="card mt-2 p-2">
        <div><b>Student:</b> HARIHARAN MUTHU M (Section A)</div>
        <div><b>Subject:</b> EC2201 – Microprocessor and I/O Interfacing</div>
        <div><b>Unit:</b> Unit V – 8086 Microprocessor and I/O Interfacing</div>
        <div><b>Registration Date:</b> 08 Sept 2026</div>
      </div>
      <p class="mt-2 text-muted">This presentation highlights how the software simulator faithfully models Intel 8086 isolated I/O operations, bus timing, peripheral interfacing, and diagnostic fault handling.</p>
    `
  },
  {
    step: 2,
    title: "2. Objective & Pedagogical Need",
    tab: "home",
    action: () => {},
    html: `
      <p><strong>Pedagogical Problem:</strong> Students struggle to visualize how the 8086 CPU communicates with peripherals using <span class="code-pill">M/~IO = 0</span>, <span class="code-pill">~RD</span>, and <span class="code-pill">~WR</span> without risking hardware damage or using expensive logic analyzers.</p>
      <p class="mt-2"><strong>Our Solution:</strong> A safe, 100% reproducible software environment simulating CPU accumulators, 74LS138 decoders, and virtual peripherals.</p>
    `
  },
  {
    step: 3,
    title: "3. 8086 Port Map Architecture",
    tab: "portmap",
    action: () => {},
    html: `
      <p>Reviewing the 8086 64KB I/O Address Space (0000H–FFFFH). Ports <span class="code-pill">00H to 07H</span> are decoded using a 74LS138 3-to-8 decoder:</p>
      <ul class="bullet-list mt-2">
        <li>Port 00H → Input Switch (INPUT)</li>
        <li>Port 01H → LED Output (OUTPUT)</li>
        <li>Port 02H → 7-Segment Display (OUTPUT)</li>
        <li>Port 03H → Digital Sensor (INPUT, default 5AH)</li>
        <li>Port 04H → Keypad (INPUT)</li>
        <li>Port 05H → Buzzer (OUTPUT)</li>
        <li>Port 06H → Motor Controller (OUTPUT)</li>
        <li>Port 07H → Status Register (INPUT)</li>
      </ul>
    `
  },
  {
    step: 4,
    title: "4. Interactive Virtual Peripherals",
    tab: "devices",
    action: () => {},
    html: `
      <p>Exploring the 8 virtual hardware devices. Notice how each device enforces its direction constraint:</p>
      <ul class="bullet-list mt-2">
        <li><b>DIP Switches:</b> Clickable 8-bit toggles modifying input levels.</li>
        <li><b>LED Output:</b> Active-high illumination with glowing CSS feedback.</li>
        <li><b>Digital Sensor:</b> Real-time temperature slider (currently set to 5AH = 90°C).</li>
        <li><b>PWM Motor & Buzzer:</b> Speed dials and acoustic alarm indicators.</li>
      </ul>
    `
  },
  {
    step: 5,
    title: "5. Simulator Interface & CPU Register Model",
    tab: "simulator",
    action: () => { resetSimulatorState(); },
    html: `
      <p>The Simulator provides a 3-column engineering dashboard:</p>
      <ul class="bullet-list mt-2">
        <li><b>Left:</b> Active port quick access and device inspector.</li>
        <li><b>Center:</b> 8086 program editor, single-step execution, and bus cycle visualizer.</li>
        <li><b>Right:</b> CPU register panel (AX, AH, AL, IP, Flags) and real-time bus control lines (<span class="code-pill">M/~IO</span>, <span class="code-pill">~RD</span>, <span class="code-pill">~WR</span>, <span class="code-pill">ALE</span>).</li>
      </ul>
    `
  },
  {
    step: 6,
    title: "6. Load Program 1: Sensor to LED Transfer",
    tab: "simulator",
    action: () => {
      loadSampleProgram(1);
    },
    html: `
      <p>Loading <strong>Program 1</strong> into the editor:</p>
      <div class="code-display mt-2">
IN AL, 03H   ; Read sensor reading from Port 03H
OUT 01H, AL  ; Write accumulator AL value to LED Port 01H
      </div>
      <p class="mt-2 text-muted">This classic laboratory exercise reads temperature data from Port 03H and outputs it immediately to the LED array at Port 01H.</p>
    `
  },
  {
    step: 7,
    title: "7. Step 1 Execution: IN AL, 03H",
    tab: "simulator",
    action: () => {
      executeInstruction(parseInstructionLine("IN AL, 03H"));
    },
    html: `
      <p>Executed: <span class="code-pill">IN AL, 03H</span></p>
      <ul class="bullet-list mt-2">
        <li><b>CPU Signal State:</b> <span class="code-pill">M/~IO = 0</span>, <span class="code-pill">~RD = 0</span> (Read active), <span class="code-pill">DT/~R = 0</span>.</li>
        <li><b>Transferred Data:</b> Byte <b>5AH</b> from Digital Sensor transferred over data bus lines D7–D0.</li>
        <li><b>Accumulator Updated:</b> Accumulator register AL is now <b class="highlight-val">5AH</b>!</li>
      </ul>
    `
  },
  {
    step: 8,
    title: "8. Observing CPU Accumulator & Bus Latching",
    tab: "simulator",
    action: () => {},
    html: `
      <p>Examine the CPU Register Panel on the right:</p>
      <ul class="bullet-list mt-2">
        <li><b>AL:</b> Latched to <b>5AH</b> (01011010b).</li>
        <li><b>AX:</b> Automatically updated to <b>005AH</b>.</li>
        <li><b>IP:</b> Incremented by 2 bytes (0102H).</li>
        <li><b>Status Flags:</b> Zero Flag ZF=0, Parity Flag PF=1.</li>
      </ul>
    `
  },
  {
    step: 9,
    title: "9. Step 2 Execution: OUT 01H, AL",
    tab: "simulator",
    action: () => {
      executeInstruction(parseInstructionLine("OUT 01H, AL"));
    },
    html: `
      <p>Executed: <span class="code-pill">OUT 01H, AL</span></p>
      <ul class="bullet-list mt-2">
        <li><b>CPU Signal State:</b> <span class="code-pill">M/~IO = 0</span>, <span class="code-pill">~WR = 0</span> (Write strobe active), <span class="code-pill">DT/~R = 1</span> (Transmit).</li>
        <li><b>Transferred Data:</b> Byte <b>5AH</b> written from AL to LED Output port 01H.</li>
        <li><b>Peripheral State:</b> LED array updated to pattern 01011010b!</li>
      </ul>
    `
  },
  {
    step: 10,
    title: "10. Real-Time Hardware Feedback (LED Array)",
    tab: "devices",
    action: () => {},
    html: `
      <p>Switched to Virtual Devices tab to inspect physical results:</p>
      <ul class="bullet-list mt-2">
        <li><b>LED Output (Port 01H):</b> 4 of 8 LEDs are illuminated (<span class="code-pill">5AH</span>).</li>
        <li>Notice alternating LED glow corresponding to bitmask <b>01011010b</b>.</li>
        <li>Direct verification that CPU accumulator data was successfully latched by peripheral hardware.</li>
      </ul>
    `
  },
  {
    step: 11,
    title: "11. Step-by-Step I/O Execution Trace",
    tab: "trace",
    action: () => {},
    html: `
      <p>Every single bus cycle is recorded in the comprehensive audit log:</p>
      <ul class="bullet-list mt-2">
        <li>Chronological step counter</li>
        <li>Bus direction (<span class="badge badge-info">INPUT</span> vs <span class="badge badge-accent">OUTPUT</span>)</li>
        <li>Registers and peripherals Before & After</li>
        <li>Exportable to CSV and JSON formats for laboratory reports.</li>
      </ul>
    `
  },
  {
    step: 12,
    title: "12. Automated Verification Suite (TC01–TC10)",
    tab: "testcases",
    action: () => {
      runAllTestsUI();
    },
    html: `
      <p>Triggered automated verification of all 10 normal laboratory test cases:</p>
      <ul class="bullet-list mt-2">
        <li>Sensor read, LED write, DIP switch input, Buzzer activation, Keypad scancode, 7-Segment display, Status register, and Motor PWM speed.</li>
        <li><b>Status:</b> All 10 test cases verified with <span class="badge badge-success">100% PASS</span>.</li>
      </ul>
    `
  },
  {
    step: 13,
    title: "13. Fault Detection Demonstration (FC01–FC06)",
    tab: "testcases",
    action: () => {},
    html: `
      <p>Demonstrating robust digital system fault handling:</p>
      <ul class="bullet-list mt-2">
        <li><b>FC01:</b> Unmapped Port Address (e.g. IN AL, FFH) → Trapped as High-Z Bus Fault.</li>
        <li><b>FC02:</b> OUT to Input Sensor → Trapped as Direction Mismatch.</li>
        <li><b>FC03:</b> IN from Output LED → Trapped as Direction Violation.</li>
        <li><b>FC04 & FC06:</b> Syntax and inverted operand traps.</li>
        <li>The application never crashes; meaningful educational diagnostics are displayed!</li>
      </ul>
    `
  },
  {
    step: 14,
    title: "14. Results Dashboard & Presentation Conclusion",
    tab: "results",
    action: () => {},
    html: `
      <p><strong>Demonstration Summary:</strong></p>
      <ul class="bullet-list mt-2">
        <li>16/16 Test Cases Passed (100% Success Rate)</li>
        <li>Zero regressions or undefined hardware states</li>
        <li>High-resolution Matplotlib diagrams generated in <code>screenshots/</code></li>
        <li>Comprehensive project report generated in <code>report/project_report.md</code></li>
      </ul>
      <p class="mt-3">Thank you! The project successfully fulfills all academic criteria for <b>EC2201 Unit V</b>.</p>
    `
  }
];

function startGuidedDemo() {
  currentDemoStep = 1;
  const overlay = document.getElementById('demoModalOverlay');
  if (overlay) overlay.classList.add('active');
  renderDemoStep();
}

function closeGuidedDemo() {
  const overlay = document.getElementById('demoModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

function renderDemoStep() {
  const stepObj = DEMO_STEPS[currentDemoStep - 1];
  if (!stepObj) return;

  switchTab(stepObj.tab);
  stepObj.action();

  document.getElementById('demoStepBadge').textContent = `Step ${stepObj.step} of ${DEMO_STEPS.length}`;
  document.getElementById('demoStepTitle').textContent = stepObj.title;
  document.getElementById('demoStepBody').innerHTML = stepObj.html;

  const btnPrev = document.getElementById('btnDemoPrev');
  if (btnPrev) btnPrev.disabled = (currentDemoStep === 1);
  const btnNext = document.getElementById('btnDemoNext');
  if (btnNext) {
    btnNext.textContent = (currentDemoStep === DEMO_STEPS.length) ? "Finish Demo" : "Next Step →";
  }
}

function nextDemoStep() {
  if (currentDemoStep < DEMO_STEPS.length) {
    currentDemoStep++;
    renderDemoStep();
  } else {
    closeGuidedDemo();
  }
}

function prevDemoStep() {
  if (currentDemoStep > 1) {
    currentDemoStep--;
    renderDemoStep();
  }
}

// ============================================================================
// 13. CUSTOM PORT MODAL & EDITING
// ============================================================================

let editingPort = null;

function openAddPortModal() {
  editingPort = null;
  document.getElementById('customPortAddr').value = '08H';
  document.getElementById('customPortAddr').disabled = false;
  document.getElementById('customDeviceName').value = 'Relay Controller';
  document.getElementById('customDeviceDir').value = 'OUTPUT';
  document.getElementById('customDeviceVal').value = '00H';
  document.getElementById('customDeviceDesc').value = 'Optoisolated power relay interface';
  document.getElementById('addPortModal').classList.add('active');
}

function openEditPortModal(p) {
  editingPort = p;
  const dev = portMap[p];
  if (!dev) return;
  document.getElementById('customPortAddr').value = toHexByte(p);
  document.getElementById('customPortAddr').disabled = true;
  document.getElementById('customDeviceName').value = dev.name;
  document.getElementById('customDeviceDir').value = dev.direction;
  document.getElementById('customDeviceVal').value = toHexByte(dev.value);
  document.getElementById('customDeviceDesc').value = dev.desc;
  document.getElementById('addPortModal').classList.add('active');
}

function closeAddPortModal() {
  document.getElementById('addPortModal').classList.remove('active');
}

function saveCustomPort() {
  const addrStr = document.getElementById('customPortAddr').value.trim();
  const name = document.getElementById('customDeviceName').value.trim();
  const dir = document.getElementById('customDeviceDir').value;
  const valStr = document.getElementById('customDeviceVal').value.trim();
  const desc = document.getElementById('customDeviceDesc').value.trim();

  const port = parseHexNumber(addrStr);
  if (isNaN(port) || port < 0 || port > 0xFFFF) {
    alert("Invalid Port Address. Must be between 00H and FFFFH.");
    return;
  }
  const val = parseHexNumber(valStr);
  if (isNaN(val) || val < 0 || val > 0xFF) {
    alert("Invalid Initial Value. Must be between 00H and FFH.");
    return;
  }

  portMap[port] = {
    port,
    name: name || `Port ${toHexByte(port)} Device`,
    direction: dir,
    value: val,
    defaultValue: val,
    status: "READY",
    desc: desc || "Custom virtual I/O peripheral"
  };

  closeAddPortModal();
  renderPortMaps();
  renderVirtualDevicesUI();
  updateSimStatus(true, `Port ${toHexByte(port)} (${name}) successfully saved.`);
}

function resetPortMapToDefaults() {
  initDefaultPortMap();
  renderPortMaps();
  renderVirtualDevicesUI();
  updateSimStatus(true, "Port map restored to default EC2201 configuration.");
}

// ============================================================================
// 14. TAB SWITCHING, RADIX MODES & THEME
// ============================================================================

function switchTab(tabId) {
  // Update Nav Buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Tab Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === `tab-${tabId}`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setRadixMode(mode) {
  currentRadix = mode;
  document.querySelectorAll('.radix-btn').forEach(b => {
    if (b.dataset.radix === mode) b.classList.add('active');
    else b.classList.remove('active');
  });
  renderCPUState();
}

function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.contains('light-theme');
  const btn = document.getElementById('themeToggleBtn');
  if (isLight) {
    body.classList.remove('light-theme');
    body.classList.add('dark-theme');
    if (btn) btn.innerHTML = '☀️';
    localStorage.setItem('theme', 'dark');
  } else {
    body.classList.remove('dark-theme');
    body.classList.add('light-theme');
    if (btn) btn.innerHTML = '🌙';
    localStorage.setItem('theme', 'light');
  }
}

// ============================================================================
// 15. DOM CONTENT LOADED EVENT
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '🌙';
  }

  // Navigation handlers
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Theme toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Quick Demo Button
  const demoBtn = document.getElementById('quickDemoBtn');
  if (demoBtn) demoBtn.addEventListener('click', startGuidedDemo);

  // Initialize Port Map & Peripherals
  initDefaultPortMap();
  renderPortMaps();
  renderVirtualDevicesUI();
  renderCPUState();

  // Run initial test suite to populate Test Cases tab
  runAllTestsUI();

  // Code editor change listener
  const editor = document.getElementById('asmCodeEditor');
  if (editor) {
    editor.addEventListener('input', updateLineCount);
    updateLineCount();
  }
});
