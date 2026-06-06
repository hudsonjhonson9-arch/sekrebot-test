// test-geo.js

describe('Geo & Distance Math', () => {

  // Implementasi referensi Haversine (seperti di absen.js)
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  it('Harus menghitung jarak 0 meter untuk koordinat yang persis sama', () => {
    const dist = getDistance(-9.6548, 119.4122, -9.6548, 119.4122);
    assert.equal(dist, 0);
  });

  it('Harus menghitung jarak antara 2 titik (Sumba Barat - Sumba Timur approx)', () => {
    // Sumba Barat
    const lat1 = -9.636615;
    const lon1 = 119.415039;
    // Waingapu (Timur)
    const lat2 = -9.653457;
    const lon2 = 120.264669;

    const dist = getDistance(lat1, lon1, lat2, lon2);
    // Waingapu is approx 90-100 km from Waikabubak
    assert.isTrue(dist > 90000 && dist < 100000, `Dist is ${dist} meters`);
  });

  it('Akurasi presisi pendek (<10 meter)', () => {
    // Geser sedikit lintang (approx 11 meter)
    const dist = getDistance(-9.636615, 119.415039, -9.636515, 119.415039);
    assert.isWithin(dist, 11.1, 0.5, 'Jarak harus sekitar 11 meter');
  });

});
