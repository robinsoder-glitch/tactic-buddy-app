import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./match-import.functions";

describe("isPrivateAddress", () => {
  it("stoppar IPv4-adresser i privata nät", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("192.168.0.5")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  it("stoppar IPv6-loopback i alla skrivsätt", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateAddress("[::1]")).toBe(true);
    expect(isPrivateAddress("::")).toBe(true);
  });

  it("stoppar IPv4-mappade IPv6-adresser, även i hexform", () => {
    expect(isPrivateAddress("::ffff:7f00:1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("0:0:0:0:0:ffff:c0a8:1")).toBe(true);
    expect(isPrivateAddress("::ffff:a9fe:a9fe")).toBe(true);
  });

  it("stoppar lokala och länklokala IPv6-nät", () => {
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("febf::1")).toBe(true);
  });

  it("släpper igenom publika adresser", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateAddress("inte-en-adress")).toBe(false);
  });
});
