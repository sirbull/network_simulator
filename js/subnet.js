// === SUBNET MATH ===
// Pure bitwise functions — no DOM dependencies.

function ipToInt(ip) {
  const parts = ip.split('.');
  return (
    ((parseInt(parts[0], 10) & 0xff) << 24 |
     (parseInt(parts[1], 10) & 0xff) << 16 |
     (parseInt(parts[2], 10) & 0xff) << 8  |
     (parseInt(parts[3], 10) & 0xff)) >>> 0
  );
}

function intToIp(n) {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff
  ].join('.');
}

function prefixToMask(prefix) {
  if (prefix === 0) return '0.0.0.0';
  return intToIp((0xffffffff << (32 - prefix)) >>> 0);
}

function maskToPrefix(mask) {
  let n = ipToInt(mask);
  let count = 0;
  while (n & 0x80000000) { count++; n = (n << 1) >>> 0; }
  return count;
}

function getNetworkAddress(ip, mask) {
  return intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0);
}

function getBroadcastAddress(ip, mask) {
  const wildcard = (~ipToInt(mask)) >>> 0;
  return intToIp((ipToInt(ip) | wildcard) >>> 0);
}

function sameSubnet(ip1, mask1, ip2, mask2) {
  // Use the more restrictive (longer) mask for comparison
  const m = (ipToInt(mask1) & ipToInt(mask2)) >>> 0;
  const mStr = intToIp(m);
  return getNetworkAddress(ip1, mStr) === getNetworkAddress(ip2, mStr);
}

function sameSubnetMask(ip1, ip2, mask) {
  return getNetworkAddress(ip1, mask) === getNetworkAddress(ip2, mask);
}

function isValidIp(str) {
  if (!str || typeof str !== 'string') return false;
  const parts = str.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

function isValidMask(str) {
  if (!isValidIp(str)) return false;
  const n = ipToInt(str);
  // A valid mask has all 1s before all 0s: (n | (n-1)) must equal 0xffffffff or n === 0
  if (n === 0) return true;
  // Flip: ~n should be a power-of-two minus 1 (all trailing 1s)
  const inv = (~n) >>> 0;
  return (inv & (inv + 1)) === 0;
}

function ipInNetwork(ip, networkAddr, mask) {
  return getNetworkAddress(ip, mask) === networkAddr;
}
