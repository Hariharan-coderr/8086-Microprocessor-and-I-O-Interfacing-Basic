"""
Generates Matplotlib Charts and Diagrams for College Report and Screenshots
Subject: EC2201 - Microprocessor and I/O Interfacing (Unit V)
Student: HARIHARAN MUTHU M (Section A)
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_test_results_chart():
    """Generates Test Results summary visualization."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5), dpi=150)
    fig.patch.set_facecolor("#0f172a")

    # Chart 1: Pass/Fail Breakdown
    categories = ["Normal Tests (10)", "Fault / Edge Tests (6)"]
    passed_vals = [10, 6]
    failed_vals = [0, 0]

    x = np.arange(len(categories))
    width = 0.35

    ax1.set_facecolor("#1e293b")
    rects1 = ax1.bar(x - width/2, passed_vals, width, label="Passed", color="#10b981")
    rects2 = ax1.bar(x + width/2, failed_vals, width, label="Failed", color="#ef4444")

    ax1.set_ylabel("Test Cases Count", color="#e2e8f0", fontsize=11, fontweight="bold")
    ax1.set_title("8086 I/O Simulator Verification (100% Pass Rate)", color="#38bdf8", fontsize=12, fontweight="bold", pad=12)
    ax1.set_xticks(x)
    ax1.set_xticklabels(categories, color="#cbd5e1", fontsize=10, fontweight="bold")
    ax1.tick_params(colors="#94a3b8")
    ax1.legend(facecolor="#334155", edgecolor="#64748b", labelcolor="#f8fafc")
    ax1.grid(axis="y", linestyle="--", alpha=0.3, color="#64748b")
    ax1.set_ylim(0, 12)

    for rect in rects1:
        h = rect.get_height()
        ax1.annotate(f"{h} Pass", xy=(rect.get_x() + rect.get_width()/2, h),
                     xytext=(0, 3), textcoords="offset points", ha="center", va="bottom",
                     color="#10b981", fontweight="bold")

    # Chart 2: Operation Frequency Distribution
    labels = ["IN (Read)", "OUT (Write)", "Internal MOV", "Fault Injections"]
    sizes = [10, 8, 5, 6]
    colors = ["#38bdf8", "#818cf8", "#fbbf24", "#f43f5e"]
    explode = (0.05, 0.05, 0, 0.05)

    ax2.set_facecolor("#1e293b")
    wedges, texts, autotexts = ax2.pie(
        sizes, explode=explode, labels=labels, autopct="%1.1f%%",
        shadow=True, startangle=140, colors=colors,
        textprops=dict(color="#f1f5f9", fontweight="bold")
    )
    for at in autotexts:
        at.set_color("#0f172a")
    ax2.set_title("Instruction / Operation Distribution", color="#38bdf8", fontsize=12, fontweight="bold", pad=12)

    plt.suptitle("EC2201 Project: 8086 Port-Mapped I/O Test Metrics\nStudent: HARIHARAN MUTHU M | Section A",
                 color="#f8fafc", fontsize=13, fontweight="bold", y=0.98)
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "test_results_summary.png")
    plt.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close()
    print(f"Generated: {out_path}")


def generate_bus_timing_diagram():
    """Generates 8086 I/O Read and Write Bus Timing Diagrams (T1-T4)."""
    fig, (ax_rd, ax_wr) = plt.subplots(2, 1, figsize=(12, 8), dpi=150)
    fig.patch.set_facecolor("#0f172a")

    t_steps = ["T1", "T2", "T3", "T4"]
    x = np.linspace(0, 4, 400)

    # Plot Read Cycle
    ax_rd.set_facecolor("#1e293b")
    ax_rd.set_title("8086 I/O READ Bus Cycle (IN AL, port) — M/~IO=0, ~RD=0", color="#38bdf8", fontsize=11, fontweight="bold")
    ax_rd.plot(x, np.sin(x * np.pi * 2) * 0.4 + 4.5, color="#94a3b8", label="CLK")
    
    # ALE
    ale_y = np.where(x < 1.0, 3.8, 3.2)
    ax_rd.plot(x, ale_y, color="#fbbf24", label="ALE (Address Latch Enable)", lw=2)

    # M/~IO
    m_io = np.full_like(x, 2.2)  # Low for I/O
    ax_rd.plot(x, m_io, color="#f43f5e", label="M/~IO (= 0 for Isolated I/O)", lw=2)

    # ~RD
    rd_bar = np.where((x >= 1.5) & (x <= 3.5), 1.2, 1.8)
    ax_rd.plot(x, rd_bar, color="#10b981", label="~RD (Active LOW Read Strobe)", lw=2.5)

    # AD7-AD0 (Address in T1, Data in T3-T4)
    ax_rd.fill_between([0, 1], [0.2, 0.2], [0.8, 0.8], color="#38bdf8", alpha=0.5)
    ax_rd.text(0.5, 0.5, "Port Address (A7-A0)", color="#ffffff", ha="center", va="center", fontweight="bold", fontsize=9)
    ax_rd.fill_between([1, 2], [0.45, 0.45], [0.55, 0.55], color="#64748b", alpha=0.3)
    ax_rd.text(1.5, 0.5, "Float (High-Z)", color="#cbd5e1", ha="center", va="center", fontsize=8)
    ax_rd.fill_between([2, 4], [0.2, 0.2], [0.8, 0.8], color="#10b981", alpha=0.5)
    ax_rd.text(3.0, 0.5, "Valid Input Data (D7-D0)", color="#ffffff", ha="center", va="center", fontweight="bold", fontsize=9)

    ax_rd.set_yticks([])
    ax_rd.set_xticks([0.5, 1.5, 2.5, 3.5])
    ax_rd.set_xticklabels(["T1", "T2", "T3", "T4"], color="#e2e8f0", fontsize=10, fontweight="bold")
    ax_rd.legend(loc="upper right", facecolor="#334155", edgecolor="#64748b", labelcolor="#f8fafc", fontsize=8)
    ax_rd.grid(axis="x", linestyle=":", color="#475569")

    # Plot Write Cycle
    ax_wr.set_facecolor("#1e293b")
    ax_wr.set_title("8086 I/O WRITE Bus Cycle (OUT port, AL) — M/~IO=0, ~WR=0", color="#a855f7", fontsize=11, fontweight="bold")
    ax_wr.plot(x, np.sin(x * np.pi * 2) * 0.4 + 4.5, color="#94a3b8", label="CLK")

    # ALE
    ax_wr.plot(x, ale_y, color="#fbbf24", label="ALE", lw=2)

    # M/~IO
    ax_wr.plot(x, m_io, color="#f43f5e", label="M/~IO (= 0)", lw=2)

    # ~WR
    wr_bar = np.where((x >= 1.5) & (x <= 3.5), 1.2, 1.8)
    ax_wr.plot(x, wr_bar, color="#ec4899", label="~WR (Active LOW Write Strobe)", lw=2.5)

    # AD7-AD0 (Address in T1, Data driven from T2 to T4)
    ax_wr.fill_between([0, 1], [0.2, 0.2], [0.8, 0.8], color="#38bdf8", alpha=0.5)
    ax_wr.text(0.5, 0.5, "Port Address (A7-A0)", color="#ffffff", ha="center", va="center", fontweight="bold", fontsize=9)
    ax_wr.fill_between([1, 4], [0.2, 0.2], [0.8, 0.8], color="#ec4899", alpha=0.5)
    ax_wr.text(2.5, 0.5, "Valid Output Data from AL (D7-D0)", color="#ffffff", ha="center", va="center", fontweight="bold", fontsize=9)

    ax_wr.set_yticks([])
    ax_wr.set_xticks([0.5, 1.5, 2.5, 3.5])
    ax_wr.set_xticklabels(["T1", "T2", "T3", "T4"], color="#e2e8f0", fontsize=10, fontweight="bold")
    ax_wr.legend(loc="upper right", facecolor="#334155", edgecolor="#64748b", labelcolor="#f8fafc", fontsize=8)
    ax_wr.grid(axis="x", linestyle=":", color="#475569")

    plt.suptitle("Intel 8086 Microprocessor: Port-Mapped I/O Bus Timing Analysis (T1 to T4 States)\nStudent: HARIHARAN MUTHU M | EC2201 Unit V",
                 color="#f8fafc", fontsize=12, fontweight="bold", y=0.98)
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "bus_timing_diagram.png")
    plt.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close()
    print(f"Generated: {out_path}")


def generate_architecture_diagram():
    """Generates System Architecture block diagram."""
    fig, ax = plt.subplots(figsize=(11, 6), dpi=150)
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#0f172a")

    # Draw boxes
    boxes = [
        {"x": 0.05, "y": 0.4, "w": 0.22, "h": 0.45, "title": "8086 CPU MODEL\nAL, AH, AX, IP\nBus Controller\n(M/~IO, ~RD, ~WR)", "color": "#38bdf8"},
        {"x": 0.38, "y": 0.65, "w": 0.24, "h": 0.25, "title": "ADDRESS DECODER\n74LS138 (3-to-8)\nA2, A1, A0 -> CS0-CS7", "color": "#818cf8"},
        {"x": 0.38, "y": 0.25, "w": 0.24, "h": 0.25, "title": "BUS TRANSCEIVER\n74LS245 / 74LS374\nDirection & Latching", "color": "#fbbf24"},
        {"x": 0.72, "y": 0.1, "w": 0.25, "h": 0.8, "title": "8 VIRTUAL PERIPHERALS\n00H: Input Switch (IN)\n01H: LED Output (OUT)\n02H: 7-Seg Display (OUT)\n03H: Digital Sensor (IN)\n04H: Matrix Keypad (IN)\n05H: Piezo Buzzer (OUT)\n06H: Motor Drive (OUT)\n07H: Status Register (IN)", "color": "#10b981"},
    ]

    for b in boxes:
        rect = plt.Rectangle((b["x"], b["y"]), b["w"], b["h"], facecolor="#1e293b", edgecolor=b["color"], lw=2.5)
        ax.add_patch(rect)
        ax.text(b["x"] + b["w"]/2, b["y"] + b["h"]/2, b["title"],
                color="#f8fafc", ha="center", va="center", fontweight="bold", fontsize=9, linespacing=1.4)

    # Draw arrows
    arrow_props = dict(facecolor="#38bdf8", edgecolor="#38bdf8", arrowstyle="->", lw=2)
    # CPU to Decoder (Address)
    ax.annotate("", xy=(0.38, 0.77), xytext=(0.27, 0.77), arrowprops=arrow_props)
    ax.text(0.325, 0.80, "A7-A0\nM/~IO=0", color="#38bdf8", fontsize=8, ha="center", fontweight="bold")

    # CPU to Bus Transceiver (Data)
    arrow_bidir = dict(facecolor="#fbbf24", edgecolor="#fbbf24", arrowstyle="<->", lw=2)
    ax.annotate("", xy=(0.38, 0.37), xytext=(0.27, 0.37), arrowprops=arrow_bidir)
    ax.text(0.325, 0.40, "D7-D0\n~RD/~WR", color="#fbbf24", fontsize=8, ha="center", fontweight="bold")

    # Decoder to Peripherals (Chip Selects)
    ax.annotate("", xy=(0.72, 0.77), xytext=(0.62, 0.77), arrowprops=dict(facecolor="#818cf8", edgecolor="#818cf8", arrowstyle="->", lw=2))
    ax.text(0.67, 0.80, "~CS0-~CS7", color="#818cf8", fontsize=8, ha="center", fontweight="bold")

    # Transceiver to Peripherals (Data)
    ax.annotate("", xy=(0.72, 0.37), xytext=(0.62, 0.37), arrowprops=arrow_bidir)
    ax.text(0.67, 0.40, "Peripheral Bus", color="#fbbf24", fontsize=8, ha="center", fontweight="bold")

    ax.set_xlim(0, 1.0)
    ax.set_ylim(0, 1.0)
    ax.axis("off")

    plt.suptitle("8086 Port-Mapped I/O Hardware Interfacing Architecture\nStudent: HARIHARAN MUTHU M | EC2201 Microprocessor & I/O Interfacing",
                 color="#f8fafc", fontsize=12, fontweight="bold", y=0.96)
    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "system_architecture.png")
    plt.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close()
    print(f"Generated: {out_path}")


if __name__ == "__main__":
    generate_test_results_chart()
    generate_bus_timing_diagram()
    generate_architecture_diagram()
    print("All diagnostic screenshot assets successfully generated.")
