/* ════ PROFESSIONAL PDF REKAP ════ */
    /* ════ PROFESSIONAL PDF REKAP ════ */
    async function generateRekapPDF() {
      // 1. Validasi Awal
      if (!lastRekapPegawai || lastRekapPegawai.length === 0) {
        showRekapToast('fail', '⚠️ Muat rekap terlebih dahulu');
        return;
      }

      const btn = $('btnDownloadPDF');
      const originalHtml = btn.innerHTML;

      try {
        // UI: Loading State
        btn.disabled = true;
        btn.innerHTML = '<span class="spin-sm"></span> Mengirim...';

        const { jsPDF } = window.jspdf;
        if (!jsPDF) throw new Error('Library jsPDF tidak ditemukan');

        const doc = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [215, 330]
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const dari = $('rekapDari').value;
        const sampai = $('rekapSampai').value;
        const isHarian = dari === sampai;
        const tanggalLabel = isHarian
          ? new Date(dari + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : `${dari} s.d. ${sampai}`;

        const rawLogoUrl = "https://raw.githubusercontent.com/hudsonjhonson9-arch/sekrebot/main/Lambang_Kabupaten_Sumba_Barat.png";

        let sigMap = {};
        try {
          const { ok: sigListOk, data: sigRaw } = await apiGet(P.signatureList);
          const sigData = sigListOk ? (parseApiResponse(sigRaw) || []) : [];
          if (Array.isArray(sigData)) {
            sigData.forEach(s => {
              if (s.signature && s.signature.length > 100) {
                sigMap[String(s.telegram_id)] = s.signature;
              }
            });
          }
        } catch (e) {
          console.warn("Gagal load paraf, lanjut tanpa paraf.");
        }

        const filteredPegawai = lastRekapPegawai.filter(p => p.nama && p.nama.trim() !== "");

        // Statistik untuk ringkasan di bawah
        const stats = { hadir: 0, sakit: 0, izin: 0, tugas: 0, tubel: 0, cuti: 0, tanpaBerita: 0, terlambat: 0 };

        // 3. Update Table Body: Tambahkan Jabatan & Keterangan
        const tableBody = filteredPegawai.map((p, i) => {
          const row = p.dataExcelRow || {};
          const jamM = row['Jam Masuk'] || p.jamMasuk || '—';
          const jamP = row['Jam Pulang'] || p.jamPulang || '—';

          // Logika Status & Keterangan
          let ketStatus = '';
          if (p.tubel > 0) { ketStatus = 'TUBEL'; stats.tubel++; }
          else if (p.cuti > 0) { ketStatus = 'CUTI'; stats.cuti++; }
          else if (p.sakit > 0) { ketStatus = 'SAKIT'; stats.sakit++; }
          else if (p.izin > 0) { ketStatus = 'IZIN'; stats.izin++; }
          else if (p.tugas > 0) { ketStatus = 'TUGAS/DL'; stats.tugas++; }
          else if (jamM !== '—' && jamM !== '-') { stats.hadir++; }
          else { ketStatus = 'TB'; stats.tanpaBerita++; }

          if (p.lambat > 0) stats.terlambat++;

          const logKet = p.logKet || '';
          const finalKet = [ketStatus, logKet].filter(Boolean).join(': ');

          return [
            i + 1,
            `${p.nama}\nNIP. ${p.nip || '—'}`,
            (p.jabatan || '—') + (p.pangkat ? `\n(${p.pangkat})` : ''),
            jamM,
            '',
            jamP,
            '',
            finalKet || '—'
          ];
        });

        // 4. Proses Tabel & Hitung Kop Dinamis
        const instId = (typeof getScopedInstansiId === 'function' ? getScopedInstansiId() : null) || (window.userProfile?.instansi_id) || 'bapperida';
        const instData = typeof getInstansiData === 'function' ? getInstansiData(instId) : null;
        const fullHeader = instData?.header || instData?.nama_instansi || 'BADAN PERENCANAAN PEMBANGUNAN RISET DAN INOVASI DAERAH';
        const instAlamat = instData?.alamat || 'Jl. Weekarou, Waikabubak, Sumba Barat, Nusa Tenggara Timur';
        const instKontak = instData?.kontak || '';

        doc.setFont('times', 'bold');
        doc.setFontSize(15);
        const headerLines = doc.splitTextToSize(fullHeader.toUpperCase(), pageWidth - 55);
        
        let currentHeaderY = 21;
        headerLines.forEach(() => {
          currentHeaderY += 5.5;
        });

        doc.setFont('times', 'normal');
        doc.setFontSize(9.5);
        const addressLines = doc.splitTextToSize(instAlamat, pageWidth - 55);
        let currentAddressY = currentHeaderY;
        addressLines.forEach(() => {
          currentAddressY += 4.5;
        });

        // Account for contact lines in height calculation
        if (instKontak) {
          doc.setFont('times', 'bold');
          doc.setFontSize(8.5);
          const contactLines = doc.splitTextToSize(instKontak, pageWidth - 55);
          contactLines.forEach(() => {
            currentAddressY += 4;
          });
        }

        const finalDividerY = Math.max(currentAddressY + 1.5, 37);
        const docTitleY = finalDividerY + 9;
        const docPeriodeY = docTitleY + 5.5;
        const calculatedStartY = docPeriodeY + 6;

        doc.autoTable({
          startY: calculatedStartY,
          margin: { top: 20, left: 10, right: 10, bottom: 20 },
          head: [['No', 'Nama / NIP', 'Jabatan / Pangkat', 'Jam\nMasuk', 'Paraf\nMasuk', 'Jam\nPulang', 'Paraf\nPulang', 'Ket']],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.1 },
          styles: { font: 'times', fontSize: 7.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 7 },
            1: { cellWidth: 45 },
            2: { cellWidth: 40 },
            3: { halign: 'center', cellWidth: 16 },
            4: { cellWidth: 22, minCellHeight: 14 },
            5: { halign: 'center', cellWidth: 16 },
            6: { cellWidth: 22, minCellHeight: 14 },
            7: { cellWidth: 27 }
          },
          didDrawCell: (data) => {
            if (data.cell.section === 'body' && (data.column.index === 4 || data.column.index === 6)) {
              const rowIdx = data.row.index;
              const peg = filteredPegawai[rowIdx];
              if (!peg) return;

              const uid = String(peg.id || peg.ID || peg.telegram_id || '');
              const sig = sigMap[uid];

              if (sig) {
                const isParafMasuk = (data.column.index === 4);
                const jamVal = isParafMasuk ?
                  (peg.dataExcelRow?.['Jam Masuk'] || peg.jamMasuk) :
                  (peg.dataExcelRow?.['Jam Pulang'] || peg.jamPulang);

                if (jamVal && !['—', '-', 'Alpa', 'Alpha', 'Tanpa Berita', 'TB', 'Belum'].includes(jamVal.trim())) {
                  try {
                    doc.addImage(sig, 'PNG', data.cell.x + 2, data.cell.y + 2, 18, 10, undefined, 'FAST');
                  } catch (err) { }
                }
              }
            }
          },
          didDrawPage: (data) => {
            if (data.pageNumber === 1) {
              // Dynamic logo loading
              let logoSrc = rawLogoUrl;
              if (instData && instData.logo_url) {
                logoSrc = instData.logo_url;
              }

              try {
                doc.addImage(logoSrc, 'PNG', 15, 10, 22, 25, undefined, 'FAST');
              } catch (e) {
                try {
                  doc.addImage(rawLogoUrl, 'PNG', 15, 10, 22, 25, undefined, 'FAST');
                } catch (err) { }
              }

              doc.setFont('times', 'bold');
              doc.setFontSize(13);
              doc.text('PEMERINTAH KABUPATEN SUMBA BARAT', pageWidth / 2 + 10, 15, { align: 'center' });
              
              // Draw Dynamic Kop Header lines
              doc.setFontSize(15);
              let drawHeaderY = 21;
              headerLines.forEach((line) => {
                doc.text(line, pageWidth / 2 + 10, drawHeaderY, { align: 'center' });
                drawHeaderY += 5.5;
              });

              // Draw Dynamic Address lines
              doc.setFont('times', 'normal');
              doc.setFontSize(9.5);
              let drawAddressY = drawHeaderY;
              addressLines.forEach((line) => {
                doc.text(line, pageWidth / 2 + 10, drawAddressY, { align: 'center' });
                drawAddressY += 4.5;
              });

              // Draw Dynamic Contact lines
              if (instKontak) {
                doc.setFont('times', 'bold');
                doc.setFontSize(8.5);
                const contactLines = doc.splitTextToSize(instKontak, pageWidth - 55);
                contactLines.forEach((line) => {
                  doc.text(line, pageWidth / 2 + 10, drawAddressY, { align: 'center' });
                  drawAddressY += 4;
                });
              }

              // Draw Divider lines
              doc.setLineWidth(0.7);
              doc.line(15, finalDividerY, pageWidth - 15, finalDividerY);
              doc.setLineWidth(0.2);
              doc.line(15, finalDividerY + 0.8, pageWidth - 15, finalDividerY + 0.8);

              // Draw Document Title and Periode
              doc.setFontSize(11);
              doc.setFont('times', 'bold');
              doc.text('DAFTAR HADIR PEGAWAI', pageWidth / 2, docTitleY, { align: 'center' });
              doc.setFont('times', 'normal');
              doc.text(`Periode: ${tanggalLabel}`, pageWidth / 2, docPeriodeY, { align: 'center' });
            }
          }
        });

        // 5. Statistik Kehadiran & Footer
        let currentY = doc.lastAutoTable.finalY + 10;
        if (currentY + 60 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }

        // Box Statistik
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text('Ringkasan Kehadiran:', 15, currentY);
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        const statText = `Hadir: ${stats.hadir} | Sakit: ${stats.sakit} | Izin: ${stats.izin} | Tugas/DL: ${stats.tugas} | Tubel: ${stats.tubel} | Cuti: ${stats.cuti} | TB: ${stats.tanpaBerita} | Terlambat: ${stats.terlambat}`;
        doc.text(statText, 15, currentY + 6);

        let footerY = currentY + 20;
        if (footerY + 45 > pageHeight) {
          doc.addPage();
          footerY = 25;
        }

        doc.setFontSize(10);
        const signatureX = pageWidth - 60; // Posisi di sisi kanan
        doc.text(`Waikabubak, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, signatureX, footerY, { align: 'center' });
        doc.text('Mengetahui,', signatureX, footerY + 6, { align: 'center' });

        // Dynamic Signature Title: Inspektur, Kepala Dinas, Kepala Badan, Camat, etc.
        let leaderTitle = 'Kepala Badan';
        const instNameLower = (instData?.nama_instansi || '').toLowerCase();
        const headerLower = fullHeader.toLowerCase();
        
        if (instNameLower.includes('inspektorat') || headerLower.includes('inspektorat')) {
          leaderTitle = 'Inspektur';
        } else if (instNameLower.includes('dinas') || headerLower.includes('dinas')) {
          leaderTitle = 'Kepala Dinas';
        } else if (instNameLower.includes('sekretariat daerah') || headerLower.includes('sekretariat daerah')) {
          leaderTitle = 'Sekretaris Daerah';
        } else if (instNameLower.includes('sekretariat') || headerLower.includes('sekretariat')) {
          leaderTitle = 'Sekretaris';
        } else if (instNameLower.includes('kecamatan') || headerLower.includes('kecamatan')) {
          leaderTitle = 'Camat';
        }
        
        doc.text(leaderTitle, signatureX, footerY + 11, { align: 'center' });

        const kaban = filteredPegawai[0];
        const kabanSig = sigMap[String(kaban?.id)];
        if (kabanSig) {
          try { doc.addImage(kabanSig, 'PNG', signatureX - 15, footerY + 14, 30, 15, undefined, 'FAST'); } catch (e) { }
        }

        doc.setFont('times', 'bold');
        doc.text(kaban?.nama || '__________________________', signatureX, footerY + 38, { align: 'center' });
        doc.setFont('times', 'normal');
        
        // Pangkat & NIP (Jika ada pangkat, taruh di bawah jabatan, lalu NIP)
        if (kaban?.pangkat) {
          doc.text(kaban.pangkat, signatureX, footerY + 48, { align: 'center' });
          doc.text(`NIP. ${kaban?.nip || '..........................................'}`, signatureX, footerY + 53, { align: 'center' });
        } else {
          doc.text(`NIP. ${kaban?.nip || '..........................................'}`, signatureX, footerY + 48, { align: 'center' });
        }

        // 6. Simpan & Kirim
        const fileName = `Rekap_Absensi_${dari}_${sampai}.pdf`;
        doc.save(fileName);

        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const pdfMsg = `📄 *REKAP ABSENSI PDF*\n📅 Periode: ${tanggalLabel}\n👤 Peminta: ${userProfile?.nama || MY_ID}\n🪪 NIP: ${localStorage.getItem('MY_NIP') || '-'}\n\nLaporan telah siap.`;
        
        const instName = instData?.nama_instansi || (typeof getInstansiName === 'function' ? getInstansiName(instId) : instId.toUpperCase());

        await apiPost(P.kirimRekap, { 
          chat_id: REKAP_CHAT_ID, 
          pesan: pdfMsg,
          nip: localStorage.getItem('MY_NIP') || '',
          file_base64: pdfBase64,
          file_name: fileName,
          instansi_id: instId,
          instansi_name: instName
        });
        showRekapToast('success', '✅ Rekap PDF berhasil dikirim!');

      } catch (e) {
        console.error('PDF Generation Error:', e);
        showRekapToast('fail', '❌ Gagal membuat PDF: ' + (e.message || 'Error tidak diketahui'));
      } finally {
        // Reset Button
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }

