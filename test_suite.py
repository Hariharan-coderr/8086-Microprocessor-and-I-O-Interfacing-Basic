"""
Automated Pytest Suite for 8086 Port-Mapped I/O Learning Tool
Subject: EC2201 - Microprocessor and I/O Interfacing (Unit V)
Student: HARIHARAN MUTHU M (Section A)
"""

import pytest
from simulator.tests import TestCaseRunner
from simulator.io_engine import IOEngine
from simulator.parser import InstructionParser

@pytest.fixture
def test_runner():
    return TestCaseRunner()

@pytest.fixture
def engine():
    return IOEngine()

def test_tc01_read_sensor(engine):
    engine.port_map.get_device(0x03).set_sensor_value(0x5A)
    res = engine.execute_line("IN AL, 03H")
    assert res["status"] == "SUCCESS"
    assert engine.cpu.al == 0x5A
    assert res["data"] == "5AH"

def test_tc02_write_led(engine):
    engine.execute_line("MOV AL, 0AAH")
    res = engine.execute_line("OUT 01H, AL")
    assert res["status"] == "SUCCESS"
    assert engine.port_map.get_device(0x01).current_value == 0xAA

def test_tc03_read_switch(engine):
    engine.port_map.get_device(0x00).set_value(0x0F)
    res = engine.execute_line("IN AL, 00H")
    assert res["status"] == "SUCCESS"
    assert engine.cpu.al == 0x0F

def test_tc04_write_buzzer(engine):
    engine.execute_line("MOV AL, 01H")
    res = engine.execute_line("OUT 05H, AL")
    assert res["status"] == "SUCCESS"
    assert engine.port_map.get_device(0x05).is_sounding is True

def test_tc05_read_keypad(engine):
    engine.port_map.get_device(0x04).press_key(0x07)
    res = engine.execute_line("IN AL, 04H")
    assert res["status"] == "SUCCESS"
    assert engine.cpu.al == 0x07

def test_tc06_write_seven_segment(engine):
    engine.execute_line("MOV AL, 09H")
    res = engine.execute_line("OUT 02H, AL")
    assert res["status"] == "SUCCESS"
    assert engine.port_map.get_device(0x02).display_char == "9"

def test_tc07_read_status_register(engine):
    engine.port_map.get_device(0x07).set_value(0x05)
    res = engine.execute_line("IN AL, 07H")
    assert res["status"] == "SUCCESS"
    assert engine.cpu.al == 0x05

def test_tc08_write_motor_controller(engine):
    engine.execute_line("MOV AL, 080H")
    res = engine.execute_line("OUT 06H, AL")
    assert res["status"] == "SUCCESS"
    assert engine.port_map.get_device(0x06).rpm > 1400

def test_tc09_transfer_sensor_to_led(engine):
    engine.port_map.get_device(0x03).set_sensor_value(0x7E)
    engine.execute_line("IN AL, 03H")
    res = engine.execute_line("OUT 01H, AL")
    assert res["status"] == "SUCCESS"
    assert engine.port_map.get_device(0x01).current_value == 0x7E

def test_tc10_multiple_io(engine):
    engine.port_map.get_device(0x00).set_value(0x01)
    engine.port_map.get_device(0x03).set_sensor_value(0x3C)
    prog = "IN AL, 00H\nOUT 05H, AL\nIN AL, 03H\nOUT 01H, AL"
    res = engine.run_program(prog)
    assert all(r["status"] == "SUCCESS" for r in res)
    assert engine.port_map.get_device(0x05).current_value == 0x01
    assert engine.port_map.get_device(0x01).current_value == 0x3C

def test_fc01_unmapped_port(engine):
    res = engine.execute_line("IN AL, 0FFH")
    assert res["status"] == "ERROR"
    assert "not mapped" in res["error"].lower()

def test_fc02_out_to_input_device(engine):
    engine.execute_line("MOV AL, 55H")
    res = engine.execute_line("OUT 03H, AL")
    assert res["status"] == "ERROR"
    assert "input-only" in res["error"].lower()

def test_fc03_in_from_output_device(engine):
    res = engine.execute_line("IN AL, 01H")
    assert res["status"] == "ERROR"
    assert "output-only" in res["error"].lower()

def test_fc04_invalid_mnemonic(engine):
    res = engine.execute_line("ABC AL, 03H")
    assert res["status"] == "ERROR"
    assert "invalid/unsupported" in res["error"].lower()

def test_fc05_out_of_range_data(engine):
    res = engine.execute_line("MOV AL, 1FFH")
    assert res["status"] == "ERROR"
    assert "8-bit" in res["error"].lower()

def test_fc06_inverted_operands(engine):
    res = engine.execute_line("IN 03H, AL")
    assert res["status"] == "ERROR"
    assert "syntax error" in res["error"].lower()

def test_entire_suite_runner(test_runner):
    results = test_runner.run_all_tests()
    assert results["summary"]["total_tests"] == 16
    assert results["summary"]["passed"] == 16
    assert results["summary"]["failed"] == 0
    assert results["summary"]["success_rate"] == 100.0

if __name__ == "__main__":
    runner = TestCaseRunner()
    res = runner.run_all_tests()
    print("Pytest verification complete:")
    print(res["summary"])
