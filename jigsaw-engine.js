// Mesin Utama Jigsaw Puzzle (Interlocking Bezier Curves, Offscreen Sprite Cache, Zoom/Pan, Magnetic Group Snap)

function createSeededRandom(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

class JigsawEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    // Camera / Viewport transform
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1;
    this.minZoom = 0.35;
    this.maxZoom = 2.8;
    this.panMode = false;

    // Puzzle state
    this.image = null;
    this.cols = 10;
    this.rows = 10;
    this.pieceW = 80;
    this.pieceH = 80;
    this.boardW = 800;
    this.boardH = 800;
    this.boardX = 0;
    this.boardY = 0;

    this.pieces = []; // Array of piece objects
    this.pieceById = new Map();
    this.ghostOpacity = 0.2;
    this.edgeOnlyFilter = false;
    this.isCompleted = false;
    this.theme = 'cabin';

    // Interaction state
    this.draggingPiece = null;
    this.dragGroupPieces = [];
    this.dragStartWorld = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStartScreen = { x: 0, y: 0 };
    this.panStartCam = { x: 0, y: 0 };

    // Multi-touch pinch state
    this.activePointers = new Map();
    this.lastPinchDist = null;

    // Visual effects (sparkles on snap)
    this.sparkles = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.bindEvents();
    this.startRenderLoop();
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height) * dpr;
    this.screenW = rect.width;
    this.screenH = rect.height;
    this.dpr = dpr;
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.camX) / this.zoom,
      y: (sy - this.camY) / this.zoom,
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.camX,
      y: wy * this.zoom + this.camY,
    };
  }

  /**
   * Hitung ukuran kolom & baris optimal berdasarkan rasio foto dan target jumlah kepingan
   */
  static computeGridDimensions(imgWidth, imgHeight, targetCount) {
    const aspect = imgWidth / imgHeight;
    let cols = Math.max(3, Math.round(Math.sqrt(targetCount * aspect)));
    let rows = Math.max(3, Math.round(targetCount / cols));
    return { cols, rows, total: cols * rows };
  }

  /**
   * Bangun puzzle baru dari gambar HTMLImageElement, targetCount, dan seed
   */
  buildPuzzle(image, targetCount = 100, seed = 123456) {
    this.image = image;
    this.seed = seed;
    this.isCompleted = false;
    const rand = createSeededRandom(seed);

    const grid = JigsawEngine.computeGridDimensions(image.width, image.height, targetCount);
    this.cols = grid.cols;
    this.rows = grid.rows;

    // Ukuran papan utama di meja virtual (lebar sekitar 860px agar tajam)
    const baseBoardMax = 880;
    const aspect = image.width / image.height;
    if (aspect >= 1) {
      this.boardW = baseBoardMax;
      this.boardH = Math.round(baseBoardMax / aspect);
    } else {
      this.boardH = baseBoardMax;
      this.boardW = Math.round(baseBoardMax * aspect);
    }

    this.pieceW = this.boardW / this.cols;
    this.pieceH = this.boardH / this.rows;
    this.boardX = -this.boardW / 2;
    this.boardY = -this.boardH / 2;

    // 1. Buat matriks lekukan tepi (Horizontal & Vertical edges)
    // hEdges[r][c] adalah sisi bawah dari baris r, kolom c
    const hEdges = [];
    for (let r = 0; r < this.rows - 1; r++) {
      hEdges[r] = [];
      for (let c = 0; c < this.cols; c++) {
        hEdges[r][c] = rand() > 0.5 ? 1 : -1;
      }
    }

    // vEdges[r][c] adalah sisi kanan dari baris r, kolom c
    const vEdges = [];
    for (let r = 0; r < this.rows; r++) {
      vEdges[r] = [];
      for (let c = 0; c < this.cols - 1; c++) {
        vEdges[r][c] = rand() > 0.5 ? 1 : -1;
      }
    }

    // 2. Buat objek setiap kepingan & pre-render sprite ke offscreen canvas
    this.pieces = [];
    this.pieceById.clear();

    const padX = this.pieceW * 0.36;
    const padY = this.pieceH * 0.36;

    let idCounter = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const id = idCounter++;
        const tabs = {
          top: r === 0 ? 0 : -hEdges[r - 1][c],
          right: c === this.cols - 1 ? 0 : vEdges[r][c],
          bottom: r === this.rows - 1 ? 0 : hEdges[r][c],
          left: c === 0 ? 0 : -vEdges[r][c - 1],
        };

        const isEdge = r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1;
        const targetX = this.boardX + c * this.pieceW;
        const targetY = this.boardY + r * this.pieceH;

        const sprite = this.createPieceSprite(r, c, tabs, padX, padY);

        const piece = {
          id,
          r,
          c,
          tabs,
          isEdge,
          targetX,
          targetY,
          x: targetX,
          y: targetY,
          padX,
          padY,
          sprite,
          groupId: id, // Awalnya tiap kepingan punya grup sendiri
          locked: false, // true jika sudah menempel di posisi benar di papan utama
          heldBy: null, // 'me' | 'partner' | null
          zIndex: id,
        };

        this.pieces.push(piece);
        this.pieceById.set(id, piece);
      }
    }

    // 3. Sebarkan kepingan di sekeliling papan kayu (kiri, kanan, atas, bawah seperti di foto!)
    this.scatterPieces(rand);
    this.fitTableToScreen();
    this.notifyProgress();
  }

  /**
   * Menggambar 1 kepingan puzzle dengan lekukan Bezier ke offscreen canvas supaya render 60fps super ringan
   */
  createPieceSprite(r, c, tabs, padX, padY) {
    const w = this.pieceW;
    const h = this.pieceH;
    const cw = Math.ceil(w + padX * 2);
    const ch = Math.ceil(h + padY * 2);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = cw;
    offCanvas.height = ch;
    const ctx = offCanvas.getContext('2d');

    ctx.save();
    this.traceJigsawPath(ctx, padX, padY, w, h, tabs);
    ctx.clip();

    // Gambar bagian foto yang sesuai
    const scaleX = this.image.width / this.boardW;
    const scaleY = this.image.height / this.boardH;

    const srcX = (c * w - padX) * scaleX;
    const srcY = (r * h - padY) * scaleY;
    const srcW = cw * scaleX;
    const srcH = ch * scaleY;

    ctx.drawImage(this.image, srcX, srcY, srcW, srcH, 0, 0, cw, ch);

    // Efek bevel timbul (highlight tipis di dalam tepi kepingan)
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.032);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    this.traceJigsawPath(ctx, padX, padY, w, h, tabs);
    ctx.stroke();

    ctx.restore();

    // Garis luar tegas khas potongan karton jigsaw
    ctx.save();
    ctx.lineWidth = Math.max(1.1, Math.min(w, h) * 0.022);
    ctx.strokeStyle = 'rgba(35, 22, 12, 0.58)';
    this.traceJigsawPath(ctx, padX, padY, w, h, tabs);
    ctx.stroke();
    ctx.restore();

    return offCanvas;
  }

  /**
   * Membuat jalur kurva Bezier lekukan Jigsaw (Atas, Kanan, Bawah, Kiri)
   */
  traceJigsawPath(ctx, ox, oy, w, h, tabs) {
    ctx.beginPath();
    ctx.moveTo(ox, oy);

    // Sisi ATAS (kiri ke kanan)
    if (tabs.top !== 0) {
      const s = tabs.top;
      const tabH = h * 0.25 * s;
      ctx.lineTo(ox + w * 0.35, oy);
      ctx.bezierCurveTo(ox + w * 0.35, oy - tabH * 0.2, ox + w * 0.30, oy - tabH, ox + w * 0.5, oy - tabH);
      ctx.bezierCurveTo(ox + w * 0.70, oy - tabH, ox + w * 0.65, oy - tabH * 0.2, ox + w * 0.65, oy);
    }
    ctx.lineTo(ox + w, oy);

    // Sisi KANAN (atas ke bawah)
    if (tabs.right !== 0) {
      const s = tabs.right;
      const tabW = w * 0.25 * s;
      ctx.lineTo(ox + w, oy + h * 0.35);
      ctx.bezierCurveTo(ox + w + tabW * 0.2, oy + h * 0.35, ox + w + tabW, oy + h * 0.30, ox + w + tabW, oy + h * 0.5);
      ctx.bezierCurveTo(ox + w + tabW, oy + h * 0.70, ox + w + tabW * 0.2, oy + h * 0.65, ox + w, oy + h * 0.65);
    }
    ctx.lineTo(ox + w, oy + h);

    // Sisi BAWAH (kanan ke kiri)
    if (tabs.bottom !== 0) {
      const s = tabs.bottom;
      const tabH = h * 0.25 * s;
      ctx.lineTo(ox + w * 0.65, oy + h);
      ctx.bezierCurveTo(ox + w * 0.65, oy + h + tabH * 0.2, ox + w * 0.70, oy + h + tabH, ox + w * 0.5, oy + h + tabH);
      ctx.bezierCurveTo(ox + w * 0.30, oy + h + tabH, ox + w * 0.35, oy + h + tabH * 0.2, ox + w * 0.35, oy + h);
    }
    ctx.lineTo(ox, oy + h);

    // Sisi KIRI (bawah ke atas)
    if (tabs.left !== 0) {
      const s = tabs.left;
      const tabW = w * 0.25 * s;
      ctx.lineTo(ox, oy + h * 0.65);
      ctx.bezierCurveTo(ox - tabW * 0.2, oy + h * 0.65, ox - tabW, oy + h * 0.70, ox - tabW, oy + h * 0.5);
      ctx.bezierCurveTo(ox - tabW, oy + h * 0.30, ox - tabW * 0.2, oy + h * 0.35, ox, oy + h * 0.35);
    }
    ctx.lineTo(ox, oy);
    ctx.closePath();
  }

  /**
   * Sebarkan kepingan secara estetis di sekeliling papan utama (tidak menumpuk di dalam papan)
   */
  scatterPieces(rand = Math.random) {
    const margin = Math.max(this.pieceW, this.pieceH) * 0.7;
    const halfW = this.boardW / 2;
    const halfH = this.boardH / 2;
    const spreadW = Math.max(260, this.boardW * 0.42);
    const spreadH = Math.max(200, this.boardH * 0.35);

    this.pieces.forEach((p, idx) => {
      if (p.locked) return;
      const zone = idx % 4; // 0: kiri, 1: kanan, 2: atas, 3: bawah
      if (zone === 0) {
        p.x = -halfW - margin - rand() * spreadW - this.pieceW;
        p.y = -halfH - spreadH * 0.3 + rand() * (this.boardH + spreadH * 0.6);
      } else if (zone === 1) {
        p.x = halfW + margin + rand() * spreadW;
        p.y = -halfH - spreadH * 0.3 + rand() * (this.boardH + spreadH * 0.6);
      } else if (zone === 2) {
        p.x = -halfW - spreadW * 0.5 + rand() * (this.boardW + spreadW);
        p.y = -halfH - margin - rand() * spreadH - this.pieceH;
      } else {
        p.x = -halfW - spreadW * 0.5 + rand() * (this.boardW + spreadW);
        p.y = halfH + margin + rand() * spreadH;
      }
      p.groupId = p.id;
    });
  }

  /**
   * Rapikan kepingan yang belum terpasang dalam barisan rapi di luar papan
   */
  organizeLoosePieces(onlyEdges = false) {
    const loose = this.pieces.filter((p) => !p.locked && (!onlyEdges || p.isEdge));
    if (loose.length === 0) return [];

    // Pisahkan setiap kepingan yang masih sendirian agar tersusun rapi di sekeliling papan
    const stepX = this.pieceW * 1.32;
    const stepY = this.pieceH * 1.32;
    const halfW = this.boardW / 2;
    const halfH = this.boardH / 2;

    // Susun di sisi kiri dan kanan papan
    const perCol = Math.max(4, Math.floor((this.boardH * 1.3) / stepY));
    const movedUpdates = [];

    loose.forEach((p, i) => {
      // Hanya rapikan kepingan yang belum tergabung dengan kepingan lain
      const groupMembers = this.getGroupMembers(p.groupId);
      if (groupMembers.length > 1) return;

      const side = i % 2 === 0 ? -1 : 1;
      const sideIdx = Math.floor(i / 2);
      const colOffset = Math.floor(sideIdx / perCol);
      const rowOffset = sideIdx % perCol;

      if (side === -1) {
        p.x = -halfW - (colOffset + 1.4) * stepX;
      } else {
        p.x = halfW + (colOffset + 0.4) * stepX;
      }
      p.y = -halfH * 1.15 + rowOffset * stepY;

      movedUpdates.push({ id: p.id, x: p.x, y: p.y, groupId: p.groupId, locked: p.locked });
    });

    return movedUpdates;
  }

  fitTableToScreen() {
    if (!this.screenW || !this.screenH) return;
    const totalW = this.boardW * 2.05;
    const totalH = this.boardH * 1.85;
    const scaleX = this.screenW / totalW;
    const scaleY = this.screenH / totalH;
    this.zoom = Math.max(this.minZoom, Math.min(1.15, Math.min(scaleX, scaleY)));
    this.camX = this.screenW / 2;
    this.camY = this.screenH / 2;
    if (this.callbacks.onZoomChange) {
      this.callbacks.onZoomChange(this.zoom);
    }
  }

  setZoom(newZoom, centerScreenX = this.screenW / 2, centerScreenY = this.screenH / 2) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    const worldBefore = this.screenToWorld(centerScreenX, centerScreenY);
    this.zoom = clamped;
    this.camX = centerScreenX - worldBefore.x * this.zoom;
    this.camY = centerScreenY - worldBefore.y * this.zoom;
    if (this.callbacks.onZoomChange) {
      this.callbacks.onZoomChange(this.zoom);
    }
  }

  getGroupMembers(groupId) {
    return this.pieces.filter((p) => p.groupId === groupId);
  }

  bringGroupToFront(groupId) {
    const maxZ = this.pieces.reduce((m, p) => Math.max(m, p.zIndex), 0);
    let nextZ = maxZ + 1;
    this.pieces.forEach((p) => {
      if (p.groupId === groupId) {
        p.zIndex = nextZ++;
      }
    });
  }

  /**
   * Cari kepingan teratas pada koordinat dunia (wx, wy) dengan hit detection yang luas & responsif
   */
  pickPieceAt(wx, wy) {
    const hitMargin = Math.max(20, this.pieceW * 0.32, 28 / Math.max(0.35, this.zoom));

    // Filter kepingan yang belum terkunci di papan
    const candidates = this.pieces
      .filter((p) => !p.locked && (!this.edgeOnlyFilter || p.isEdge || this.getGroupMembers(p.groupId).length > 1));

    if (candidates.length === 0) return null;

    // Urutkan berdasarkan zIndex menurun (kepingan paling atas diuji TERLEBIH DAHULU!)
    candidates.sort((a, b) => b.zIndex - a.zIndex);

    // Pass 1: Direct hit pada bodi kepingan atau lekukan tab kepingan
    for (const p of candidates) {
      const left = p.x - p.padX;
      const right = p.x + this.pieceW + p.padX;
      const top = p.y - p.padY;
      const bottom = p.y + this.pieceH + p.padY;

      if (wx >= left && wx <= right && wy >= top && wy <= bottom) {
        return p;
      }
    }

    // Pass 2: Proximity hit dengan toleransi hitMargin (sangat responsif di HP & layar sentuh)
    let bestPiece = null;
    let minDistance = Infinity;

    for (const p of candidates) {
      const left = p.x - p.padX - hitMargin;
      const right = p.x + this.pieceW + p.padX + hitMargin;
      const top = p.y - p.padY - hitMargin;
      const bottom = p.y + this.pieceH + p.padY + hitMargin;

      if (wx >= left && wx <= right && wy >= top && wy <= bottom) {
        const centerX = p.x + this.pieceW / 2;
        const centerY = p.y + this.pieceH / 2;
        const dist = Math.hypot(wx - centerX, wy - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          bestPiece = p;
        }
      }
    }

    return bestPiece;
  }

  /**
   * Cek apakah grup kepingan yang baru digeser bisa menempel (Snap) ke Papan Utama atau ke Kepingan Tetangga!
   */
  checkMagneticSnap(movedGroupId) {
    const snapTolerance = Math.max(18, Math.min(this.pieceW, this.pieceH) * 0.34);
    let groupPieces = this.getGroupMembers(movedGroupId);
    let snappedAny = false;

    // 1. Cek apakah dekat dengan posisi asli di Papan Utama
    for (const p of groupPieces) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      if (Math.hypot(dx, dy) <= snapTolerance) {
        // Tempelkan seluruh anggota grup ke posisi target masing-masing di papan!
        for (const gp of groupPieces) {
          gp.x = gp.targetX;
          gp.y = gp.targetY;
          gp.locked = true;
          gp.zIndex = 0; // Pindah ke lapisan dasar papan
          this.spawnSparkles(gp.x + this.pieceW / 2, gp.y + this.pieceH / 2);
        }
        snappedAny = true;
        break;
      }
    }

    // 2. Jika belum terkunci ke papan, cek apakah dekat dengan kepingan tetangganya di meja!
    if (!snappedAny) {
      const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ];

      for (const p of groupPieces) {
        for (const { dr, dc } of directions) {
          const nr = p.r + dr;
          const nc = p.c + dc;
          if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;

          const neighbor = this.pieces[nr * this.cols + nc];
          if (!neighbor || neighbor.groupId === p.groupId) continue;

          // Posisi ideal p relatif terhadap neighbor
          const expectedX = neighbor.x - dc * this.pieceW;
          const expectedY = neighbor.y - dr * this.pieceH;
          const dist = Math.hypot(expectedX - p.x, expectedY - p.y);

          if (dist <= snapTolerance) {
            const shiftX = expectedX - p.x;
            const shiftY = expectedY - p.y;
            const targetGroupId = neighbor.groupId;
            const targetLocked = neighbor.locked;

            // Geser semua kepingan di grup kita agar menyatu presisi dengan tetangga
            for (const gp of groupPieces) {
              gp.x += shiftX;
              gp.y += shiftY;
              gp.groupId = targetGroupId;
              if (targetLocked) {
                gp.x = gp.targetX;
                gp.y = gp.targetY;
                gp.locked = true;
                gp.zIndex = 0;
              }
            }

            this.spawnSparkles(p.x + this.pieceW / 2, p.y + this.pieceH / 2);
            groupPieces = this.getGroupMembers(targetGroupId);
            snappedAny = true;
          }
        }
      }
    }

    if (snappedAny) {
      window.soundFX.playSnap();
      this.notifyProgress();
    }

    return groupPieces;
  }

  spawnSparkles(wx, wy) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 2.5;
      this.sparkles.push({
        x: wx,
        y: wy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: i % 2 === 0 ? '#ff4d79' : '#fbbf24',
      });
    }
  }

  notifyProgress() {
    const total = this.pieces.length;
    const lockedCount = this.pieces.filter((p) => p.locked).length;
    const percent = total > 0 ? Math.round((lockedCount / total) * 100) : 0;

    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({ lockedCount, total, percent });
    }

    if (total > 0 && lockedCount === total && !this.isCompleted) {
      this.isCompleted = true;
      window.soundFX.playVictory();
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
    }
  }

  /**
   * Terapkan perubahan posisi kepingan dari pasangan (Multiplayer Sync)
   */
  applyRemotePiecesUpdate(updates, holderType = null) {
    const now = Date.now();
    let anyLockedChanged = false;
    updates.forEach((u) => {
      const p = this.pieceById.get(u.id);
      if (!p) return;
      // Jangan timpa kepingan jika saat ini sedang digeser oleh kita sendiri
      if (this.draggingPiece && this.draggingPiece.groupId === p.groupId) {
        return;
      }
      p.x = u.x;
      p.y = u.y;
      if (u.groupId !== undefined) p.groupId = u.groupId;
      if (u.locked !== undefined && p.locked !== u.locked) {
        p.locked = u.locked;
        if (p.locked) {
          p.zIndex = 0;
          this.spawnSparkles(p.x + this.pieceW / 2, p.y + this.pieceH / 2);
        }
        anyLockedChanged = true;
      }
      p.heldBy = holderType;
      p.heldByTime = holderType ? now : 0;
    });

    if (anyLockedChanged) {
      window.soundFX.playSnap();
      this.notifyProgress();
    }
  }

  getSerializedState() {
    return this.pieces.map((p) => ({
      id: p.id,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      groupId: p.groupId,
      locked: p.locked,
    }));
  }

  bindEvents() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      // Bersihkan pointer lama jika mouse atau sudah ada >= 2 pointer (mencegah pointer nyangkut)
      if (e.pointerType === 'mouse' || this.activePointers.size >= 2) {
        this.activePointers.clear();
      }

      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.activePointers.set(e.pointerId, { x: sx, y: sy });

      // Jika 2 jari menyentuh layar (Pinch-to-zoom di HP/Tablet)
      if (this.activePointers.size === 2) {
        this.draggingPiece = null;
        this.isPanning = false;
        const pts = Array.from(this.activePointers.values());
        this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        return;
      }

      const worldPos = this.screenToWorld(sx, sy);

      // Tombol tengah mouse -> Khusus Geser Kamera
      if (e.button === 1) {
        this.isPanning = true;
        this.panStartScreen = { x: sx, y: sy };
        this.panStartCam = { x: this.camX, y: this.camY };
        return;
      }

      // Deteksi kepingan yang disentuh (prioritas utama, sangat responsif)
      const hit = this.pickPieceAt(worldPos.x, worldPos.y);

      if (hit) {
        // Bebaskan kepingan dan angkat
        hit.heldBy = null;
        this.isPanning = false;
        this.draggingPiece = hit;
        this.bringGroupToFront(hit.groupId);
        this.dragGroupPieces = this.getGroupMembers(hit.groupId).map((gp) => {
          gp.heldBy = null;
          return {
            piece: gp,
            startX: gp.x,
            startY: gp.y,
          };
        });
        this.dragStartWorld = worldPos;
        el.style.cursor = 'grabbing';
        window.soundFX.playPickup();
      } else {
        // Klik pada area meja kosong -> Geser Meja (Pan)
        this.isPanning = true;
        this.panStartScreen = { x: sx, y: sy };
        this.panStartCam = { x: this.camX, y: this.camY };
      }
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: sx, y: sy });
      }

      // Handle Pinch-to-Zoom 2 jari di HP
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;
        if (this.lastPinchDist && this.lastPinchDist > 10) {
          const factor = dist / this.lastPinchDist;
          this.setZoom(this.zoom * factor, centerX, centerY);
        }
        this.lastPinchDist = dist;
        return;
      }

      const worldPos = this.screenToWorld(sx, sy);

      // Ubah visual kursor secara responsif saat melayang di atas kepingan
      if (!this.draggingPiece && !this.isPanning && e.pointerType === 'mouse') {
        const hoverPiece = this.pickPieceAt(worldPos.x, worldPos.y);
        el.style.cursor = hoverPiece ? 'grab' : (this.panMode ? 'all-scroll' : 'default');
      }

      // Kirim posisi kursor kita ke pasangan
      if (this.callbacks.onCursorMove) {
        this.callbacks.onCursorMove(worldPos.x, worldPos.y);
      }

      if (this.draggingPiece) {
        el.style.cursor = 'grabbing';
        const dx = worldPos.x - this.dragStartWorld.x;
        const dy = worldPos.y - this.dragStartWorld.y;

        const updates = [];
        for (const item of this.dragGroupPieces) {
          item.piece.x = item.startX + dx;
          item.piece.y = item.startY + dy;
          updates.push({
            id: item.piece.id,
            x: Math.round(item.piece.x * 10) / 10,
            y: Math.round(item.piece.y * 10) / 10,
            groupId: item.piece.groupId,
            locked: item.piece.locked,
          });
        }

        if (this.callbacks.onPiecesDrag) {
          this.callbacks.onPiecesDrag(updates);
        }
      } else if (this.isPanning) {
        this.camX = this.panStartCam.x + (sx - this.panStartScreen.x);
        this.camY = this.panStartCam.y + (sy - this.panStartScreen.y);
      }
    });

    const endPointer = (e) => {
      try {
        if (e && e.pointerId) el.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (e && e.pointerId) {
        this.activePointers.delete(e.pointerId);
      } else {
        this.activePointers.clear();
      }

      if (this.activePointers.size < 2) {
        this.lastPinchDist = null;
      }

      if (this.draggingPiece) {
        const groupId = this.draggingPiece.groupId;
        const finalGroup = this.checkMagneticSnap(groupId);
        const updates = finalGroup.map((p) => {
          p.heldBy = null;
          return {
            id: p.id,
            x: Math.round(p.x * 10) / 10,
            y: Math.round(p.y * 10) / 10,
            groupId: p.groupId,
            locked: p.locked,
          };
        });

        if (this.callbacks.onPiecesDrop) {
          this.callbacks.onPiecesDrop(updates);
        }

        this.draggingPiece = null;
        this.dragGroupPieces = [];
      }
      this.isPanning = false;
      el.style.cursor = this.panMode ? 'all-scroll' : 'default';
    };

    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    window.addEventListener('blur', () => {
      this.activePointers.clear();
      this.draggingPiece = null;
      this.isPanning = false;
    });

    // Mouse Wheel Zoom
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        this.setZoom(this.zoom * factor, sx, sy);
      },
      { passive: false }
    );
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  setTheme(themeName) {
    this.theme = themeName || 'cabin';
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.screenW, this.screenH);

    // Terapkan transformasi kamera (Zoom & Pan)
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Gambar Papan Alas Puzzle di tengah meja sesuai tema (Bersih & Elegan)
    ctx.save();
    if (this.theme === 'galaxy') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.shadowColor = 'rgba(192, 132, 252, 0.45)';
      ctx.shadowBlur = 32;
      ctx.shadowOffsetY = 6;
      ctx.fillRect(this.boardX, this.boardY, this.boardW, this.boardH);
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.55)';
      ctx.strokeRect(this.boardX - 2, this.boardY - 2, this.boardW + 4, this.boardH + 4);
    } else if (this.theme === 'beach') {
      ctx.fillStyle = 'rgba(255, 253, 246, 0.88)';
      ctx.shadowColor = 'rgba(110, 80, 40, 0.22)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillRect(this.boardX, this.boardY, this.boardW, this.boardH);
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(202, 168, 126, 0.65)';
      ctx.strokeRect(this.boardX - 2, this.boardY - 2, this.boardW + 4, this.boardH + 4);
    } else if (this.theme === 'picnic') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(30, 60, 20, 0.24)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillRect(this.boardX, this.boardY, this.boardW, this.boardH);
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(132, 158, 98, 0.6)';
      ctx.strokeRect(this.boardX - 2, this.boardY - 2, this.boardW + 4, this.boardH + 4);
    } else {
      // 'cabin' (default)
      ctx.fillStyle = 'rgba(250, 244, 236, 0.88)';
      ctx.shadowColor = 'rgba(40, 26, 12, 0.28)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillRect(this.boardX, this.boardY, this.boardW, this.boardH);
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(130, 96, 65, 0.55)';
      ctx.strokeRect(this.boardX - 2, this.boardY - 2, this.boardW + 4, this.boardH + 4);
    }

    // 2. Gambar Bayangan Bantu (Ghost Reference Image) jika diaktifkan
    if (this.image && this.ghostOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = this.ghostOpacity;
      ctx.drawImage(this.image, this.boardX, this.boardY, this.boardW, this.boardH);
      ctx.restore();
    }

    // Garis kisi tipis di papan utama
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = this.theme === 'galaxy' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(120, 90, 60, 0.14)';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.pieces[r * this.cols + c];
        if (p && !p.locked) {
          this.traceJigsawPath(
            ctx,
            this.boardX + c * this.pieceW,
            this.boardY + r * this.pieceH,
            this.pieceW,
            this.pieceH,
            p.tabs
          );
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // 3. Gambar seluruh kepingan berdasarkan urutan zIndex
    const sorted = [...this.pieces].sort((a, b) => a.zIndex - b.zIndex);

    for (const p of sorted) {
      // Jika filter pinggiran aktif, sembunyikan kepingan tengah yang belum terpasang
      if (this.edgeOnlyFilter && !p.locked && !p.isEdge && this.getGroupMembers(p.groupId).length === 1) {
        continue;
      }

      ctx.save();
      if (!p.locked) {
        // Efek bayangan kepingan di atas meja kayu (seperti di foto)
        const isDragging = this.draggingPiece && this.draggingPiece.groupId === p.groupId;
        ctx.shadowColor = p.heldBy === 'partner' ? 'rgba(232, 74, 127, 0.65)' : 'rgba(28, 18, 8, 0.35)';
        ctx.shadowBlur = isDragging ? 18 : 6;
        ctx.shadowOffsetX = isDragging ? 4 : 2;
        ctx.shadowOffsetY = isDragging ? 8 : 3;
      }

      ctx.drawImage(p.sprite, p.x - p.padX, p.y - p.padY);
      ctx.restore();
    }

    // 4. Gambar efek partikel kilauan saat kepingan berhasil dipasang
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.035;
      if (sp.alpha <= 0) {
        this.sparkles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

window.JigsawEngine = JigsawEngine;
