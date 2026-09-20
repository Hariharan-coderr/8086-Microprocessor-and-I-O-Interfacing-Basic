"""
Interactive CLI Runner for 8086 Port-Mapped I/O Learning Tool
Subject: EC2201 - Microprocessor and I/O Interfacing (Unit V)
Student: HARIHARAN MUTHU M (Section A)
"""

import sys
from simulator.io_engine import IOEngine
from simulator.tests import TestCaseRunner
from simulator.ai_assistant import EducationalAIAssistant

def print_banner():
    print("=" * 75)
    print("      INTEL 8086 PORT-MAPPED I/O LEARNING TOOL — CLI RUNNER")
    print("      EC2201 Microprocessor and I/O Interfacing (Unit V)")
    print("      Student: HARIHARAN MUTHU M | Section A | Reg Date: 08 Sept 2026")
    print("=" * 75)

def print_ports(engine):
    print("\n--- ACTIVE 8086 PORT MAP (00H-07H) ---")
    print(f"{'Port':<8} {'Device Name':<20} {'Dir':<8} {'Value':<8} {'Status'}")
    print("-" * 75)
    for dev in engine.port_map.to_list():
        print(f"{dev['hex_port']:<8} {dev['name']:<20} {dev['direction']:<8} {dev['hex_value']:<8} {dev['status']}")
    print("-" * 75)

def print_cpu(engine):
    state = engine.cpu.get_state_dict()
    print("\n--- 8086 CPU REGISTERS & BUS SIGNALS ---")
    print(f"AX: {state['ax']['hex']} (AH={state['ah']['hex']}, AL={state['al']['hex']})  IP: {state['ip']['hex']}  I/O Ops: {state['io_op_counter']}")
    print(f"Flags: {state['flags']['formatted']}")
    sig = state['bus_signals']
    print(f"Bus: M/~IO={sig['m_io']}  ~RD={sig['rd_bar']}  ~WR={sig['wr_bar']}  ALE={sig['ale']}  ~DEN={sig['den_bar']}  DT/~R={sig['dt_r']}")
    print("-" * 75)

def run_tests():
    print("\n[Executing 16 Automated Test Scenarios...]")
    runner = TestCaseRunner()
    results = runner.run_all_tests()
    s = results["summary"]
    print("\n=== VERIFICATION SUMMARY ===")
    print(f"Total Tests:   {s['total_tests']}")
    print(f"Normal Tests:  {s['normal_count']}")
    print(f"Fault Tests:   {s['fault_count']}")
    print(f"Passed:        {s['passed']}")
    print(f"Failed:        {s['failed']}")
    print(f"Success Rate:  {s['success_rate']}%")
    print("\nNormal Test Cases:")
    for t in results["normal_tests"]:
        st = "PASS" if t["passed"] else "FAIL"
        print(f"  [{st}] {t['id']}: {t['name']} -> {t['actual']}")
    print("\nEdge / Fault Test Cases:")
    for t in results["fault_tests"]:
        st = "PASS" if t["passed"] else "FAIL"
        print(f"  [{st}] {t['id']}: {t['name']} -> {t['actual']}")
    print("-" * 75)

def run_sample_program_cli():
    engine = IOEngine()
    print("\n[Executing Sample Program 1: Read Sensor -> Display on LED]")
    prog = "IN AL, 03H\nOUT 01H, AL"
    print(f"Assembly Code:\n{prog}\n")
    print("Initial State:")
    print_cpu(engine)
    
    results = engine.run_program(prog)
    print("\nExecution Step Traces:")
    for r in results:
        print(f"  Step {r['step']}: {r['instruction']} | Op: {r['operation']} | Data: {r['data']} | Status: {r['status']}")
        print(f"    Explanation: {r['explanation']}")

    print("\nFinal State:")
    print_cpu(engine)
    print_ports(engine)

def main():
    print_banner()
    run_tests()
    run_sample_program_cli()
    print("\nCLI verification run complete. Launch web UI via: python app.py")

if __name__ == "__main__":
    main()
