// test-helpers.js

describe('Time Conversion Helpers (ui.js)', () => {

  it('toMenitStr: Mengubah format HH:MM ke total menit', () => {
    assert.equal(toMenitStr('08:00'), 480, '08:00 adalah 480 menit');
    assert.equal(toMenitStr('14:30'), 870, '14:30 adalah 870 menit');
    assert.equal(toMenitStr('00:00'), 0, '00:00 adalah 0 menit');
  });

  it('toMenitStr: Menangani format tidak valid dengan anggun', () => {
    assert.equal(toMenitStr('invalid'), null, 'Harus null jika string berantakan');
    assert.equal(toMenitStr(null), null, 'Harus null jika null diberikan');
    assert.equal(toMenitStr(''), null, 'Harus null jika kosong');
  });

  it('menitToStr: Mengubah total menit ke format HH:MM', () => {
    assert.equal(menitToStr(480), '08:00', '480 menit adalah 08:00');
    assert.equal(menitToStr(870), '14:30', '870 menit adalah 14:30');
    assert.equal(menitToStr(9), '00:09', 'Format padding dua digit wajib jalan');
  });

  it('normToISO: Mengonversi berbagai format tanggal menjadi YYYY-MM-DD valid', () => {
    if (typeof normToISO === 'function') {
      assert.equal(normToISO('15/08/2026'), '2026-08-15', 'DD/MM/YYYY jalan');
      assert.equal(normToISO('15-08-2026'), '2026-08-15', 'DD-MM-YYYY jalan');
      assert.equal(normToISO('2026-08-15T09:00:00Z'), '2026-08-15', 'ISO lengkap terpotong');
      assert.equal(normToISO('2026-08-15'), '2026-08-15', 'ISO standar tetap');
      assert.equal(normToISO(''), '', 'Kosong return kosong');
    } else {
      console.warn('normToISO tidak ditemukan di global scope');
    }
  });

});
