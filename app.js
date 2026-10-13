// Controller Utama Aplikasi Puzzle Kita
// Dilengkapi: Auto-save LocalStorage, Cloud Snapshot (Dpaste), Asynchronous Room Join, & Auto-reconnect

document.addEventListener('DOMContentLoaded', () => {
  // Elemen DOM utama
  const canvas = document.getElementById('puzzleCanvas');
  const lobbyModal = document.getElementById('lobbyModal');
  const setupModal = document.getElementById('setupModal');
  const victoryModal = document.getElementById('victoryModal');

  const playerNameInput = document.getElementById('playerNameInput');
  const customRoomInput = document.getElementById('customRoomInput');
  const joinRoomInput = document.getElementById('joinRoomInput');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const playSoloBtn = document.getElementById('playSoloBtn');

  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const connectionDot = document.getElementById('connectionDot');
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const player1Tag = document.getElementById('player1Tag');
  const player2Tag = document.getElementById('player2Tag');

  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const timerDisplay = document.getElementById('timerDisplay');

  const toggleEdgeFilterBtn = document.getElementById('toggleEdgeFilterBtn');
  const organizePiecesBtn = document.getElementById('organizePiecesBtn');
  const toggleGhostBtn = document.getElementById('toggleGhostBtn');
  const ghostBtnLabel = document.getElementById('ghostBtnLabel');
  const openSetupBtn = document.getElementById('openSetupBtn');
  const openLobbyBtn = document.getElementById('openLobbyBtn');
  const closeSetupModalBtn = document.getElementById('closeSetupModalBtn');
  const closeLobbyModalBtn = document.getElementById('closeLobbyModalBtn');

  // Theme elements
  const themeSelectorBtn = document.getElementById('themeSelectorBtn');
  const themeBtnLabel = document.getElementById('themeBtnLabel');
  const themeMenu = document.getElementById('themeMenu');
  const tableViewport = document.getElementById('tableViewport');

  // Setup Modal elements
  const uploadDropzone = document.getElementById('uploadDropzone');
  const photoFileInput = document.getElementById('photoFileInput');
  const setupPreviewImg = document.getElementById('setupPreviewImg');
  const mysteryModeCheckbox = document.getElementById('mysteryModeCheckbox');
  const pieceCountSlider = document.getElementById('pieceCountSlider');
  const sliderPieceReadout = document.getElementById('sliderPieceReadout');
  const surpriseTitleInput = document.getElementById('surpriseTitleInput');
  const surpriseMessageInput = document.getElementById('surpriseMessageInput');
  const surpriseVoucherInput = document.getElementById('surpriseVoucherInput');
  const applyPuzzleSetupBtn = document.getElementById('applyPuzzleSetupBtn');

  // Box Widget elements
  const puzzleBoxWidget = document.getElementById('puzzleBoxWidget');
  const minimizeBoxBtn = document.getElementById('minimizeBoxBtn');
  const boxPreviewImg = document.getElementById('boxPreviewImg');
  const mysteryCover = document.getElementById('mysteryCover');
  const boxPieceCountBadge = document.getElementById('boxPieceCountBadge');

  // Camera & Cursor elements
  const panModeToggleBtn = document.getElementById('panModeToggleBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetViewBtn = document.getElementById('resetViewBtn');
  const zoomLevelText = document.getElementById('zoomLevelText');
  const partnerCursor = document.getElementById('partnerCursor');
  const partnerCursorName = document.getElementById('partnerCursorName');

  // Victory Modal elements
  const victoryStatsText = document.getElementById('victoryStatsText');
  const victoryFinalImg = document.getElementById('victoryFinalImg');
  const envelopePrompt = document.getElementById('envelopePrompt');
  const openEnvelopeBtn = document.getElementById('openEnvelopeBtn');
  const loveLetterBox = document.getElementById('loveLetterBox');
  const letterTitleDisplay = document.getElementById('letterTitleDisplay');
  const letterBodyDisplay = document.getElementById('letterBodyDisplay');
  const voucherTicketDisplay = document.getElementById('voucherTicketDisplay');
  const voucherTextDisplay = document.getElementById('voucherTextDisplay');
  const closeVictoryBtn = document.getElementById('closeVictoryBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // State aplikasi saat ini
  let currentConfig = {
    imageDataUrl: '',
    targetPieces: 100,
    seed: Math.floor(Math.random() * 999999) + 1,
    mysteryMode: false,
    theme: 'cabin',
    cloudId: null,
    surprise: {
      title: surpriseTitleInput.value,
      message: surpriseMessageInput.value,
      voucher: surpriseVoucherInput.value,
    },
  };

  let currentImageObj = null;
  let startTime = Date.now();
  let elapsedSeconds = 0;
  let timerInterval = null;

  // 1. Inisialisasi Mesin Jigsaw
  const engine = new window.JigsawEngine(canvas, {
    onZoomChange: (z) => {
      zoomLevelText.textContent = `${Math.round(z * 100)}%`;
    },
    onProgress: ({ lockedCount, total, percent }) => {
      progressText.textContent = `${lockedCount} / ${total} keping (${percent}%)`;
      progressFill.style.width = `${percent}%`;
    },
    onCursorMove: (wx, wy) => {
      mp.sendCursor(wx, wy);
    },
    onPiecesDrag: (updates) => {
      mp.sendDrag(updates);
    },
    onPiecesDrop: (updates) => {
      mp.sendDrop(updates);
      debouncedSaveSession();
    },
    onComplete: () => {
      triggerVictoryModal();
      mp.send({
        type: 'VICTORY_REVEAL',
        elapsedSeconds,
      });
      debouncedSaveSession();
    },
  });

  // 2. Inisialisasi Multiplayer
  const mp = new window.PuzzleMultiplayer({
    onRoomReady: (code) => {
      roomCodeDisplay.textContent = code;
      connectionDot.className = 'status-dot waiting';
      showToast(`Room "${code}" siap! Bagikan link atau kodenya ke pacarmu ❤️`);
      debouncedSaveSession();
    },
    onPartnerJoined: (partnerName) => {
      player2Tag.textContent = `${partnerName} ❤️`;
      player2Tag.classList.remove('waiting');
      connectionDot.className = 'status-dot online';
      partnerCursorName.textContent = `${partnerName} ❤️`;
      showToast(`🎉 ${partnerName} bergabung ke meja puzzle!`);
      window.soundFX.playPop();
      debouncedSaveSession();
    },
    onStatusUpdate: (msg) => {
      connectionDot.className = 'status-dot waiting';
      player2Tag.textContent = 'Menunggu Pacar...';
      player2Tag.classList.add('waiting');
    },
    onHostNeedsToSendPuzzle: () => {
      sendFullPuzzleToPartner();
    },
    onReceivePuzzleInit: (data) => {
      showToast('📸 Menerima foto puzzle dari pasanganmu...');
      currentConfig = {
        imageDataUrl: data.imageDataUrl,
        targetPieces: data.targetPieces,
        seed: data.seed,
        mysteryMode: data.mysteryMode,
        theme: data.theme || currentConfig.theme,
        cloudId: data.cloudId || currentConfig.cloudId,
        surprise: data.surprise || currentConfig.surprise,
      };
      if (data.theme) {
        applyTheme(data.theme, false);
      }
      if (data.hostName) {
        player2Tag.textContent = `${data.hostName} ❤️`;
        player2Tag.classList.remove('waiting');
        connectionDot.className = 'status-dot online';
        partnerCursorName.textContent = `${data.hostName} ❤️`;
      }
      loadPuzzleFromConfig(currentConfig, data.puzzleState);
      debouncedSaveSession();
    },
    onPartnerChangeTheme: (theme) => {
      applyTheme(theme, false);
      showToast('🎨 Pasanganmu mengubah suasana background meja!');
      debouncedSaveSession();
    },
    onPartnerCursor: (wx, wy, name) => {
      partnerCursor.classList.remove('hidden');
      partnerCursorName.textContent = name;
      const screenPos = engine.worldToScreen(wx, wy);
      partnerCursor.style.transform = `translate(${screenPos.x}px, ${screenPos.y + 62}px)`;
    },
    onPartnerDragPieces: (updates) => {
      engine.applyRemotePiecesUpdate(updates, 'partner');
    },
    onPartnerDropPieces: (updates) => {
      engine.applyRemotePiecesUpdate(updates, null);
      debouncedSaveSession();
    },
    onPartnerOrganizePieces: (updates) => {
      engine.applyRemotePiecesUpdate(updates, null);
      showToast('✨ Pasanganmu merapikan kepingan di meja!');
      debouncedSaveSession();
    },
    onReceiveEmoji: (emoji, sender) => {
      spawnFloatingEmoji(emoji, sender);
      window.soundFX.playPop();
    },
    onReceiveVictory: () => {
      if (!engine.isCompleted) {
        engine.isCompleted = true;
        window.soundFX.playVictory();
        triggerVictoryModal();
        debouncedSaveSession();
      }
    },
    onDisconnected: () => {
      connectionDot.className = 'status-dot waiting';
      player2Tag.textContent = 'Terputus (Menunggu...)';
      player2Tag.classList.add('waiting');
      partnerCursor.classList.add('hidden');
      showToast('⚠️ Pasangan terputus sementara. Otomatis menghubungkan kembali...');
    },
    onError: (msg) => {
      showToast(`ℹ️ ${msg}`);
    },
  });

  const themeLabels = {
    cabin: '🌲 Kabin Pinus',
    picnic: '🧺 Piknik Rumput',
    beach: '🏖️ Pantai Tropis',
    galaxy: '🌌 Malam Berbintang',
  };

  function applyTheme(themeName, broadcast = false) {
    const validTheme = themeLabels[themeName] ? themeName : 'cabin';
    currentConfig.theme = validTheme;

    if (tableViewport) {
      tableViewport.className = `table-viewport theme-${validTheme}`;
    }
    document.body.className = validTheme === 'galaxy' ? 'theme-galaxy' : '';

    if (themeBtnLabel) {
      themeBtnLabel.textContent = `Tema: ${themeLabels[validTheme].split(' ')[1]}`;
    }

    document.querySelectorAll('.theme-menu-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.theme === validTheme);
    });

    document.querySelectorAll('.theme-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.theme === validTheme);
    });

    if (engine && engine.setTheme) {
      engine.setTheme(validTheme);
    }

    if (broadcast) {
      mp.sendTheme(validTheme);
      debouncedSaveSession();
    }
  }

  function sendFullPuzzleToPartner() {
    if (!currentConfig.imageDataUrl) return;
    mp.send({
      type: 'INIT_PUZZLE',
      imageDataUrl: currentConfig.imageDataUrl,
      targetPieces: currentConfig.targetPieces,
      seed: currentConfig.seed,
      mysteryMode: currentConfig.mysteryMode,
      theme: currentConfig.theme,
      cloudId: currentConfig.cloudId,
      surprise: currentConfig.surprise,
      puzzleState: engine.getSerializedState(),
      hostName: mp.myName,
    });
  }

  // 3. Generator Ilustrasi Romantis Bawaan (Agar bisa langsung dicoba tanpa upload)
  function generateSampleArtwork(type = 'sunset') {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 840;
    const ctx = c.getContext('2d');

    if (type === 'sunset') {
      const grad = ctx.createLinearGradient(0, 0, 0, c.height);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.35, '#9d174d');
      grad.addColorStop(0.68, '#f97316');
      grad.addColorStop(1, '#fde047');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.fillStyle = 'rgba(255, 247, 200, 0.92)';
      ctx.beginPath();
      ctx.arc(600, 490, 145, 0, Math.PI * 2);
      ctx.fill();

      const seaGrad = ctx.createLinearGradient(0, 540, 0, c.height);
      seaGrad.addColorStop(0, '#7c2d12');
      seaGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, 540, c.width, c.height - 540);

      ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
      for (let i = 0; i < 18; i++) {
        const y = 555 + i * 15;
        const w = 220 - i * 8 + Math.sin(i) * 25;
        ctx.fillRect(600 - w / 2, y, w, 6);
      }

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(600, 840, 500, 260, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.arc(580, 595, 17, 0, Math.PI * 2);
      ctx.arc(620, 600, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(566, 612);
      ctx.quadraticCurveTo(580, 610, 594, 612);
      ctx.lineTo(600, 670);
      ctx.lineTo(560, 670);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(606, 616);
      ctx.quadraticCurveTo(620, 614, 634, 616);
      ctx.lineTo(640, 670);
      ctx.lineTo(600, 670);
      ctx.closePath();
      ctx.fill();

      drawHeart(ctx, 600, 540, 36);
    } else if (type === 'picnic') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 420);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, c.width, 420);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let i = 0; i < 6; i++) {
        const cx = 150 + i * 190;
        const cy = 90 + Math.sin(i * 2) * 45;
        ctx.beginPath();
        ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        ctx.arc(cx + 35, cy - 10, 55, 0, Math.PI * 2);
        ctx.arc(cx + 70, cy, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      const hillGrad = ctx.createLinearGradient(0, 380, 0, c.height);
      hillGrad.addColorStop(0, '#4ade80');
      hillGrad.addColorStop(0.5, '#22c55e');
      hillGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = hillGrad;
      ctx.beginPath();
      ctx.moveTo(0, 410);
      ctx.bezierCurveTo(300, 320, 800, 470, 1200, 360);
      ctx.lineTo(1200, 840);
      ctx.lineTo(0, 840);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(440, 520, 320, 210);
      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 11; col++) {
          if ((r + col) % 2 === 0) {
            ctx.fillRect(440 + col * 29, 520 + r * 30, 29, 30);
          }
        }
      }

      ctx.fillStyle = '#b45309';
      ctx.fillRect(520, 560, 160, 110);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(510, 550, 180, 20);

      drawHeart(ctx, 600, 470, 42);
    } else {
      const spaceGrad = ctx.createLinearGradient(0, 0, c.width, c.height);
      spaceGrad.addColorStop(0, '#030712');
      spaceGrad.addColorStop(0.5, '#1e1b4b');
      spaceGrad.addColorStop(1, '#3b0764');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 280; i++) {
        const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * c.width;
        const sy = (Math.cos(i * 678.9) * 0.5 + 0.5) * c.height;
        const r = (i % 5 === 0) ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const nebulaGrad = ctx.createRadialGradient(600, 420, 60, 600, 420, 360);
      nebulaGrad.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
      nebulaGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.3)');
      nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebulaGrad;
      ctx.beginPath();
      ctx.arc(600, 420, 360, 0, Math.PI * 2);
      ctx.fill();

      drawHeart(ctx, 600, 420, 80);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Puzzle Kenangan Kita ❤️', c.width / 2, 78);

    return c.toDataURL('image/jpeg', 0.88);
  }

  function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = '#ff4d79';
    ctx.shadowColor = 'rgba(255, 77, 121, 0.6)';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.quadraticCurveTo(x, y, x + size / 4, y);
    ctx.quadraticCurveTo(x + size / 2, y, x + size / 2, y + size / 4);
    ctx.quadraticCurveTo(x + size / 2, y, x + (size * 3) / 4, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + size / 4);
    ctx.quadraticCurveTo(x + size, y + size / 2, x + (size * 3) / 4, y + (size * 3) / 4);
    ctx.lineTo(x + size / 2, y + size);
    ctx.lineTo(x + size / 4, y + (size * 3) / 4);
    ctx.quadraticCurveTo(x, y + size / 2, x, y + size / 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 4. Fungsi Memuat & Memotong Foto Menjadi Kepingan Jigsaw
  function loadPuzzleFromConfig(config, remoteState = null, initialElapsed = 0) {
    const img = new Image();
    img.onload = () => {
      currentImageObj = img;
      setupPreviewImg.src = config.imageDataUrl;
      boxPreviewImg.src = config.imageDataUrl;
      victoryFinalImg.src = config.imageDataUrl;

      updateSliderReadout(img.width, img.height, config.targetPieces);

      engine.buildPuzzle(img, config.targetPieces, config.seed);

      const actualTotal = engine.pieces.length;
      boxPieceCountBadge.textContent = `${actualTotal} PCS`;

      if (config.mysteryMode) {
        mysteryCover.classList.remove('hidden');
        engine.ghostOpacity = 0;
        ghostBtnLabel.textContent = 'Bayangan: OFF';
      } else {
        mysteryCover.classList.add('hidden');
      }

      if (config.theme) {
        applyTheme(config.theme, false);
      }

      if (remoteState && Array.isArray(remoteState)) {
        engine.applyRemotePiecesUpdate(remoteState, null);
        engine.notifyProgress();
      }

      resetTimer(initialElapsed);
    };
    img.src = config.imageDataUrl;
  }

  function updateSliderReadout(imgW, imgH, targetVal) {
    const w = imgW || (currentImageObj ? currentImageObj.width : 1200);
    const h = imgH || (currentImageObj ? currentImageObj.height : 840);
    const grid = window.JigsawEngine.computeGridDimensions(w, h, targetVal);
    sliderPieceReadout.textContent = `${grid.total} Keping (${grid.cols} × ${grid.rows})`;
  }

  // 5. Upload Foto Custom & Kompresi Cerdas
  function handleCustomImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('⚠️ Mohon pilih file gambar/foto (JPG/PNG/WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        const maxDim = 1200;
        let w = tempImg.width;
        let h = tempImg.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        off.getContext('2d').drawImage(tempImg, 0, 0, w, h);
        const compressedDataUrl = off.toDataURL('image/jpeg', 0.84);

        currentConfig.imageDataUrl = compressedDataUrl;
        currentConfig.cloudId = null; // Reset cloud id untuk foto baru
        setupPreviewImg.src = compressedDataUrl;
        document.querySelectorAll('.sample-btn').forEach((b) => b.classList.remove('active'));
        updateSliderReadout(w, h, parseInt(pieceCountSlider.value, 10));
        showToast('📸 Foto berhasil dimuat! Klik "Buat & Acak Kepingan Puzzle" untuk memulai.');
      };
      tempImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  uploadDropzone.addEventListener('click', () => photoFileInput.click());
  photoFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCustomImageFile(e.target.files[0]);
    }
  });

  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.style.borderColor = '#e84a7f';
  });
  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.style.borderColor = '#d8c7b8';
  });
  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.style.borderColor = '#d8c7b8';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCustomImageFile(e.dataTransfer.files[0]);
    }
  });

  // Tombol gambar contoh
  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sample-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const sampleType = btn.dataset.sample;
      currentConfig.imageDataUrl = generateSampleArtwork(sampleType);
      currentConfig.cloudId = null;
      setupPreviewImg.src = currentConfig.imageDataUrl;
      updateSliderReadout(1200, 840, parseInt(pieceCountSlider.value, 10));
    });
  });

  // Tombol preset tingkat kesulitan
  document.querySelectorAll('.diff-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.diff-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const count = parseInt(card.dataset.pieces, 10);
      pieceCountSlider.value = count;
      updateSliderReadout(null, null, count);
    });
  });

  pieceCountSlider.addEventListener('input', () => {
    const val = parseInt(pieceCountSlider.value, 10);
    document.querySelectorAll('.diff-card').forEach((c) => {
      c.classList.toggle('active', parseInt(c.dataset.pieces, 10) === val);
    });
    updateSliderReadout(null, null, val);
  });

  // Terapkan Pengaturan Puzzle & Simpan
  applyPuzzleSetupBtn.addEventListener('click', () => {
    currentConfig.targetPieces = parseInt(pieceCountSlider.value, 10);
    currentConfig.seed = Math.floor(Math.random() * 999999) + 1;
    currentConfig.mysteryMode = mysteryModeCheckbox.checked;
    currentConfig.surprise = {
      title: surpriseTitleInput.value.trim() || 'Yeay! Kita Berhasil Menyusunnya Bersama ❤️',
      message: surpriseMessageInput.value.trim(),
      voucher: surpriseVoucherInput.value.trim(),
    };

    loadPuzzleFromConfig(currentConfig);
    setupModal.classList.add('hidden');
    showToast(`🧩 Puzzle ${engine.pieces.length} keping siap dirangkai!`);
    debouncedSaveSession();

    // Unggah snapshot puzzle ke Cloud di background agar pasangan bisa buka kapan pun
    uploadPuzzleToCloud(currentConfig).then((cid) => {
      if (cid) {
        currentConfig.cloudId = cid;
        saveSessionToLocalStorage();
      }
    });

    // Kirim ke pasangan jika sedang terkoneksi di dalam room
    setTimeout(() => {
      sendFullPuzzleToPartner();
    }, 200);
  });

  // 6. Lobby & Room Events
  createRoomBtn.addEventListener('click', () => {
    const myName = playerNameInput.value.trim() || 'Sayang';
    const customCode = customRoomInput.value.trim();
    player1Tag.textContent = myName;
    mp.createRoom(customCode, myName);
    lobbyModal.classList.add('hidden');
    setupModal.classList.remove('hidden');
    debouncedSaveSession();
  });

  joinRoomBtn.addEventListener('click', () => {
    const code = joinRoomInput.value.trim();
    if (!code) {
      showToast('⚠️ Masukkan Kode Room dari pasanganmu dulu ya!');
      joinRoomInput.focus();
      return;
    }
    const myName = playerNameInput.value.trim() || 'Ayang';
    player1Tag.textContent = myName;
    roomCodeDisplay.textContent = code.toUpperCase();
    connectionDot.className = 'status-dot waiting';
    mp.joinRoom(code, myName);
    lobbyModal.classList.add('hidden');
    debouncedSaveSession();
    showToast(`🔍 Menghubungkan ke Room "${code.toUpperCase()}"...`);
  });

  playSoloBtn.addEventListener('click', () => {
    const myName = playerNameInput.value.trim() || 'Kamu';
    player1Tag.textContent = myName;
    lobbyModal.classList.add('hidden');
    setupModal.classList.remove('hidden');
    debouncedSaveSession();
  });

  // Salin Link Undangan Otomatis (?room=KODE&c=ID)
  copyInviteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!mp.roomCode) {
      lobbyModal.classList.remove('hidden');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('room', mp.roomCode);
    if (currentConfig.cloudId) {
      url.searchParams.set('c', currentConfig.cloudId);
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast(`📋 Link Room "${mp.roomCode}" berhasil disalin! Kirimkan ke WhatsApp pacarmu.`);
    } catch (err) {
      window.prompt('Salin link undangan ini untuk pacarmu:', url.toString());
    }
  });

  // Tombol Keluar / Ganti Room
  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const confirmLeave = window.confirm('Apakah kamu ingin keluar dari room ini dan membuat atau bergabung ke room lain?');
      if (confirmLeave) {
        localStorage.removeItem('couple_puzzle_save');
        mp.destroy();
        roomCodeDisplay.textContent = 'OFFLINE';
        connectionDot.className = 'status-dot';
        player2Tag.textContent = 'Menunggu Pacar...';
        player2Tag.classList.add('waiting');
        lobbyModal.classList.remove('hidden');
        showToast('🚪 Keluar dari room. Silakan buat atau gabung room baru.');
      }
    });
  }

  if (closeLobbyModalBtn) {
    closeLobbyModalBtn.addEventListener('click', () => {
      lobbyModal.classList.add('hidden');
    });
  }

  // 7. Tombol Bantuan di HUD Atas
  toggleEdgeFilterBtn.addEventListener('click', () => {
    engine.edgeOnlyFilter = !engine.edgeOnlyFilter;
    toggleEdgeFilterBtn.classList.toggle('active', engine.edgeOnlyFilter);
    showToast(
      engine.edgeOnlyFilter
        ? '🖼️ Menampilkan kepingan bagian pinggir/bingkai saja.'
        : '🧩 Menampilkan seluruh kepingan puzzle.'
    );
  });

  organizePiecesBtn.addEventListener('click', () => {
    const updates = engine.organizeLoosePieces(engine.edgeOnlyFilter);
    if (updates.length > 0) {
      mp.sendOrganize(updates);
      window.soundFX.playPickup();
      showToast('✨ Kepingan yang berserakan sudah dirapikan di sisi papan!');
      debouncedSaveSession();
    }
  });

  const ghostLevels = [0, 0.2, 0.45];
  let ghostIdx = 1;
  toggleGhostBtn.addEventListener('click', () => {
    ghostIdx = (ghostIdx + 1) % ghostLevels.length;
    engine.ghostOpacity = ghostLevels[ghostIdx];
    const pct = Math.round(engine.ghostOpacity * 100);
    ghostBtnLabel.textContent = pct === 0 ? 'Bayangan: OFF' : `Bayangan: ${pct}%`;
  });

  openSetupBtn.addEventListener('click', () => setupModal.classList.remove('hidden'));
  closeSetupModalBtn.addEventListener('click', () => setupModal.classList.add('hidden'));
  openLobbyBtn.addEventListener('click', () => lobbyModal.classList.remove('hidden'));

  // 8. Kamera & Zoom Controls
  panModeToggleBtn.addEventListener('click', () => {
    engine.panMode = !engine.panMode;
    panModeToggleBtn.classList.toggle('active', engine.panMode);
    panModeToggleBtn.textContent = engine.panMode ? '✋ Geser Meja: ON' : '✋ Geser Meja: OFF';
    canvas.style.cursor = engine.panMode ? 'all-scroll' : 'default';
  });

  zoomInBtn.addEventListener('click', () => engine.setZoom(engine.zoom * 1.2));
  zoomOutBtn.addEventListener('click', () => engine.setZoom(engine.zoom * 0.82));
  resetViewBtn.addEventListener('click', () => engine.fitTableToScreen());

  // 9. Kotak Referensi 3D
  minimizeBoxBtn.addEventListener('click', () => {
    puzzleBoxWidget.classList.toggle('minimized');
    minimizeBoxBtn.textContent = puzzleBoxWidget.classList.contains('minimized') ? '▢' : '_';
  });

  // 10. Reaksi Emoji Melayang
  document.querySelectorAll('.react-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      const myName = player1Tag.textContent;
      spawnFloatingEmoji(emoji, myName);
      window.soundFX.playPop();
      mp.sendEmoji(emoji);
    });
  });

  function spawnFloatingEmoji(emoji, senderName) {
    const container = document.getElementById('floatingReactionsContainer');
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.style.left = `${20 + Math.random() * 60}%`;
    el.innerHTML = `${emoji}<span>${senderName}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  // 11. Timer Permainan
  function resetTimer(initialElapsed = 0) {
    elapsedSeconds = initialElapsed;
    startTime = Date.now() - initialElapsed * 1000;
    timerDisplay.textContent = `⏱️ ${formatTime(elapsedSeconds)}`;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!engine.isCompleted) {
        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        timerDisplay.textContent = `⏱️ ${formatTime(elapsedSeconds)}`;
      }
    }, 1000);
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // 12. Victory & Surprise Envelope Reveal
  function triggerVictoryModal() {
    mysteryCover.classList.add('hidden');
    victoryStatsText.textContent = `Diselesaikan bersama dalam waktu ${formatTime(elapsedSeconds)} • ${engine.pieces.length} Keping Jigsaw`;
    letterTitleDisplay.textContent = currentConfig.surprise.title;
    letterBodyDisplay.textContent = currentConfig.surprise.message;

    if (currentConfig.surprise.voucher) {
      voucherTicketDisplay.classList.remove('hidden');
      voucherTextDisplay.textContent = currentConfig.surprise.voucher;
    } else {
      voucherTicketDisplay.classList.add('hidden');
    }

    envelopePrompt.classList.remove('hidden');
    loveLetterBox.classList.add('hidden');
    victoryModal.classList.remove('hidden');
    startConfetti();
  }

  openEnvelopeBtn.addEventListener('click', () => {
    window.soundFX.playVictory();
    envelopePrompt.classList.add('hidden');
    loveLetterBox.classList.remove('hidden');
  });

  closeVictoryBtn.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
  });

  playAgainBtn.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    setupModal.classList.remove('hidden');
  });

  function startConfetti() {
    const cCanvas = document.getElementById('confettiCanvas');
    cCanvas.width = window.innerWidth;
    cCanvas.height = window.innerHeight;
    const cCtx = cCanvas.getContext('2d');
    const pieces = Array.from({ length: 110 }, () => ({
      x: Math.random() * cCanvas.width,
      y: -20 - Math.random() * cCanvas.height * 0.5,
      w: 7 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      vy: 2.2 + Math.random() * 3.5,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      color: ['#ff4d79', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'][Math.floor(Math.random() * 5)],
    }));

    let frames = 0;
    function loop() {
      if (victoryModal.classList.contains('hidden') || frames > 360) {
        cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
        return;
      }
      frames++;
      cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += 0.06;
        cCtx.save();
        cCtx.translate(p.x, p.y);
        cCtx.rotate(p.rot);
        cCtx.fillStyle = p.color;
        cCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cCtx.restore();
      });
      requestAnimationFrame(loop);
    }
    loop();
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // 13. Event Listener Tema Suasana Background Meja
  if (themeSelectorBtn && themeMenu) {
    themeSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!themeMenu.contains(e.target) && e.target !== themeSelectorBtn) {
        themeMenu.classList.add('hidden');
      }
    });

    document.querySelectorAll('.theme-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const selected = item.dataset.theme;
        applyTheme(selected, true);
        themeMenu.classList.add('hidden');
        showToast(`🎨 Suasana diubah ke ${themeLabels[selected]}!`);
      });
    });
  }

  document.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      const selected = card.dataset.theme;
      applyTheme(selected, true);
    });
  });

  // 14. Helper Cloud Storage & LocalStorage Auto-Save
  async function uploadPuzzleToCloud(config) {
    if (!config || !config.imageDataUrl) return null;
    try {
      const payload = {
        imageDataUrl: config.imageDataUrl,
        targetPieces: config.targetPieces,
        seed: config.seed,
        mysteryMode: config.mysteryMode,
        theme: config.theme,
        surprise: config.surprise,
        puzzleState: engine ? engine.getSerializedState() : null,
      };
      const res = await fetch('https://dpaste.org/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          content: JSON.stringify(payload),
          expiry_days: '14',
        }),
      });
      if (res.ok) {
        const text = await res.text();
        const match = text.trim().match(/dpaste\.org\/([a-zA-Z0-9]+)/);
        if (match) {
          return match[1];
        }
      }
    } catch (err) {
      console.warn('Gagal upload cloud snapshot:', err);
    }
    return null;
  }

  async function fetchCloudPuzzle(cloudId) {
    try {
      const cleanId = cloudId.replace(/[^a-zA-Z0-9]/g, '');
      const res = await fetch(`https://dpaste.org/${cleanId}/raw`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Gagal unduh cloud snapshot:', err);
    }
    return null;
  }

  let saveDebounceTimer = null;
  function debouncedSaveSession() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveSessionToLocalStorage();
    }, 400);
  }

  function saveSessionToLocalStorage() {
    if (!currentConfig || !currentConfig.imageDataUrl) return;
    try {
      const sessionData = {
        config: currentConfig,
        roomCode: mp.roomCode,
        role: mp.role,
        myName: mp.myName,
        partnerName: mp.partnerName,
        elapsedSeconds: elapsedSeconds,
        timestamp: Date.now(),
        pieces: engine ? engine.getSerializedState() : null,
        isCompleted: engine ? engine.isCompleted : false,
      };
      localStorage.setItem('couple_puzzle_save', JSON.stringify(sessionData));
    } catch (err) {
      console.warn('Gagal simpan session ke localStorage:', err);
    }
  }

  window.addEventListener('beforeunload', () => saveSessionToLocalStorage());
  window.addEventListener('pagehide', () => saveSessionToLocalStorage());

  // 15. Inisialisasi Startup & Auto-Resume
  async function initializeApplication() {
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get('room') ? params.get('room').toUpperCase() : null;
    const cloudSnapshotId = params.get('c') || null;

    let savedSession = null;
    try {
      const raw = localStorage.getItem('couple_puzzle_save');
      if (raw) savedSession = JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse saved session:', e);
    }

    // Kasus 1: Dibuka lewat link undangan dengan Cloud Snapshot (?room=KODE&c=ID)
    if (invitedRoom && cloudSnapshotId) {
      joinRoomInput.value = invitedRoom;
      playerNameInput.value = 'Ayang';
      player1Tag.textContent = 'Ayang';
      roomCodeDisplay.textContent = invitedRoom;
      connectionDot.className = 'status-dot waiting';
      lobbyModal.classList.add('hidden');
      showToast(`💌 Mengunduh foto puzzle room "${invitedRoom}"...`);

      const cloudData = await fetchCloudPuzzle(cloudSnapshotId);
      if (cloudData && cloudData.imageDataUrl) {
        currentConfig = {
          imageDataUrl: cloudData.imageDataUrl,
          targetPieces: cloudData.targetPieces,
          seed: cloudData.seed,
          mysteryMode: cloudData.mysteryMode,
          theme: cloudData.theme || 'cabin',
          surprise: cloudData.surprise || currentConfig.surprise,
          cloudId: cloudSnapshotId,
        };
        applyTheme(currentConfig.theme, false);
        loadPuzzleFromConfig(currentConfig, cloudData.puzzleState || null);
        showToast(`🎉 Puzzle siap dimainkan! Menghubungkan ke pasangan...`);
      } else {
        currentConfig.imageDataUrl = generateSampleArtwork('sunset');
        loadPuzzleFromConfig(currentConfig);
      }

      mp.joinRoom(invitedRoom, 'Ayang');
      debouncedSaveSession();
      return;
    }

    // Kasus 2: Dibuka lewat link undangan biasa (?room=KODE)
    if (invitedRoom) {
      joinRoomInput.value = invitedRoom;
      playerNameInput.value = 'Ayang';
      player1Tag.textContent = 'Ayang';
      roomCodeDisplay.textContent = invitedRoom;
      connectionDot.className = 'status-dot waiting';
      lobbyModal.classList.add('hidden');
      showToast(`🔍 Bergabung ke Room "${invitedRoom}"...`);

      if (savedSession && savedSession.roomCode === invitedRoom && savedSession.config) {
        currentConfig = savedSession.config;
        applyTheme(currentConfig.theme, false);
        loadPuzzleFromConfig(currentConfig, savedSession.pieces || null, savedSession.elapsedSeconds || 0);
      } else {
        currentConfig.imageDataUrl = generateSampleArtwork('sunset');
        loadPuzzleFromConfig(currentConfig);
      }

      mp.joinRoom(invitedRoom, 'Ayang');
      return;
    }

    // Kasus 3: Kembali/Refresh halaman sendiri (Auto-Resume dari LocalStorage)
    if (savedSession && savedSession.config && savedSession.config.imageDataUrl) {
      currentConfig = savedSession.config;
      const myName = savedSession.myName || 'Sayang';
      player1Tag.textContent = myName;
      playerNameInput.value = myName;
      applyTheme(currentConfig.theme || 'cabin', false);
      loadPuzzleFromConfig(currentConfig, savedSession.pieces || null, savedSession.elapsedSeconds || 0);

      lobbyModal.classList.add('hidden');

      if (savedSession.roomCode) {
        roomCodeDisplay.textContent = savedSession.roomCode;
        connectionDot.className = 'status-dot waiting';

        if (savedSession.role === 'host') {
          showToast(`❤️ Melanjutkan Room "${savedSession.roomCode}" sebagai Host!`);
          mp.createRoom(savedSession.roomCode, myName, true);
        } else if (savedSession.role === 'guest') {
          showToast(`❤️ Melanjutkan Room "${savedSession.roomCode}"!`);
          mp.joinRoom(savedSession.roomCode, myName);
        }
      } else {
        showToast('❤️ Melanjutkan puzzle terakhirmu!');
      }
      return;
    }

    // Kasus 4: Pengunjung baru pertama kali membuka website
    applyTheme('cabin');
    currentConfig.imageDataUrl = generateSampleArtwork('sunset');
    loadPuzzleFromConfig(currentConfig);
  }

  initializeApplication();
});
