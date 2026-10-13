// Modul Multiplayer Real-Time menggunakan PeerJS (WebRTC DataChannel) + BroadcastChannel Fallback
// Dilengkapi auto-reconnect, graceful beforeunload cleanup, dan penanganan host offline

class PuzzleMultiplayer {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.peer = null;
    this.conn = null;
    this.role = null; // 'host' | 'guest' | 'solo'
    this.roomCode = null;
    this.myName = 'Sayang';
    this.partnerName = 'Pacar';
    this.isConnected = false;
    this.cloudId = null;

    // Throttle cursor & drag updates
    this.lastCursorSend = 0;
    this.lastDragSend = 0;

    // Reconnection tracking
    this.rejoinAttempts = 0;
    this.guestReconnectTimer = null;

    // BroadcastChannel untuk pengujian instan antar 2 tab di browser yang sama
    this.bc = null;
    try {
      this.bc = new BroadcastChannel('couple-jigsaw-puzzle-channel');
      this.bc.onmessage = (e) => this.handleIncomingMessage(e.data, 'bc');
    } catch (err) {
      console.warn('BroadcastChannel not supported', err);
    }

    // Lepaskan ID peer saat pengguna menutup tab/me-refresh halaman
    window.addEventListener('beforeunload', () => this.destroy());
    window.addEventListener('pagehide', () => this.destroy());
  }

  getPrefix() {
    return 'puzzlekita-';
  }

  cleanCode(code) {
    if (!code) return '';
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  destroy() {
    this.stopGuestReconnect();
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }
    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
  }

  createRoom(customCode, myName, isRejoin = false) {
    this.role = 'host';
    this.myName = myName || 'Sayang';
    const code = customCode ? this.cleanCode(customCode) : Math.random().toString(36).substring(2, 8).toUpperCase();
    this.roomCode = code;

    // Bersihkan koneksi peer lama jika ada
    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch (e) {}
    }

    const peerId = this.getPrefix() + code + '-host';

    if (window.Peer) {
      try {
        this.peer = new window.Peer(peerId, { debug: 1 });

        this.peer.on('open', (id) => {
          console.log('Peer Host opened:', id);
          this.rejoinAttempts = 0;
          if (this.handlers.onRoomReady) {
            this.handlers.onRoomReady(this.roomCode);
          }
        });

        this.peer.on('connection', (connection) => {
          this.setupConnection(connection);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer host error:', err);
          if (err.type === 'unavailable-id') {
            // Broker PeerJS mungkin masih menyimpan session lama sesaat setelah refresh
            if (this.rejoinAttempts < 3) {
              this.rejoinAttempts++;
              console.log(`Host peer ID unavailable, retrying in 1.2s (attempt ${this.rejoinAttempts})...`);
              setTimeout(() => {
                this.createRoom(code, this.myName, true);
              }, 1200);
              return;
            }
            if (this.handlers.onError) {
              this.handlers.onError('Kode room tersebut sedang aktif di perangkat/tab lain.');
            }
          }
        });
      } catch (err) {
        console.error('Peer init error:', err);
      }
    }

    if (this.handlers.onRoomReady) {
      this.handlers.onRoomReady(this.roomCode);
    }
  }

  joinRoom(targetCode, myName) {
    this.role = 'guest';
    this.myName = myName || 'Pacar';
    const code = this.cleanCode(targetCode);
    this.roomCode = code;

    this.connectAsGuest();
  }

  connectAsGuest() {
    this.stopGuestReconnect();
    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch (e) {}
    }

    const hostPeerId = this.getPrefix() + this.roomCode + '-host';
    const myPeerId = this.getPrefix() + this.roomCode + '-guest-' + Math.floor(Math.random() * 10000);

    if (window.Peer) {
      try {
        this.peer = new window.Peer(myPeerId, { debug: 1 });

        this.peer.on('open', () => {
          console.log('Connecting to host:', hostPeerId);
          const connection = this.peer.connect(hostPeerId, { reliable: true });
          this.setupConnection(connection);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer guest error:', err);
          if (err.type === 'peer-unavailable') {
            // Host sedang offline atau layarnya mati, jadwalkan reconnect otomatis!
            this.scheduleGuestReconnect();
          } else if (this.handlers.onError && !this.isConnected) {
            this.handlers.onError('Menghubungkan ke pasangan (menunggu Host online)...');
          }
        });
      } catch (err) {
        console.error('Peer init error:', err);
      }
    }

    // Beritahu tab host melalui BroadcastChannel jika di browser yang sama
    this.sendViaBC({ type: 'GUEST_JOIN_REQUEST', roomCode: this.roomCode, guestName: this.myName });
  }

  scheduleGuestReconnect() {
    this.stopGuestReconnect();
    if (this.isConnected) return;
    if (this.handlers.onStatusUpdate) {
      this.handlers.onStatusUpdate('Menunggu pasangan membuka website...');
    }
    this.guestReconnectTimer = setTimeout(() => {
      if (!this.isConnected && this.role === 'guest') {
        console.log('Retrying connection to host...');
        this.connectAsGuest();
      }
    }, 3000);
  }

  stopGuestReconnect() {
    if (this.guestReconnectTimer) {
      clearTimeout(this.guestReconnectTimer);
      this.guestReconnectTimer = null;
    }
  }

  setupConnection(connection) {
    this.conn = connection;

    this.conn.on('open', () => {
      console.log('Peer DataChannel Connected!');
      this.isConnected = true;
      this.rejoinAttempts = 0;
      this.stopGuestReconnect();

      // Kirim salam perkenalan nama
      this.send({ type: 'HANDSHAKE', name: this.myName });

      if (this.handlers.onConnected) {
        this.handlers.onConnected();
      }
    });

    this.conn.on('data', (data) => {
      this.handleIncomingMessage(data, 'webrtc');
    });

    this.conn.on('close', () => {
      this.isConnected = false;
      if (this.handlers.onDisconnected) {
        this.handlers.onDisconnected();
      }
      // Jika guest terputus, jadwalkan reconnect otomatis
      if (this.role === 'guest') {
        this.scheduleGuestReconnect();
      }
    });

    this.conn.on('error', (err) => {
      console.warn('Connection error:', err);
    });
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.warn('Failed to send via webrtc:', e);
      }
    }
    this.sendViaBC(data);
  }

  sendViaBC(data) {
    if (this.bc) {
      try {
        this.bc.postMessage({ ...data, _roomCode: this.roomCode, _senderRole: this.role });
      } catch (e) {
        // Abaikan jika payload gambar terlalu besar untuk BC
      }
    }
  }

  handleIncomingMessage(data, source) {
    if (!data || !data.type) return;

    // Filter broadcast channel jika berasal dari room berbeda
    if (source === 'bc' && data._roomCode && this.roomCode && data._roomCode !== this.roomCode) {
      return;
    }
    if (source === 'bc' && data._senderRole && data._senderRole === this.role) {
      return; // Jangan memproses pesan dari diri sendiri
    }

    switch (data.type) {
      case 'HANDSHAKE':
        this.partnerName = data.name || 'Pacar';
        this.isConnected = true;
        this.stopGuestReconnect();
        if (this.handlers.onPartnerJoined) {
          this.handlers.onPartnerJoined(this.partnerName);
        }
        // Jika kita host dan partner baru saja bergabung, kirim konfigurasi puzzle saat ini
        if (this.role === 'host' && this.handlers.onHostNeedsToSendPuzzle) {
          this.handlers.onHostNeedsToSendPuzzle();
        }
        break;

      case 'GUEST_JOIN_REQUEST':
        if (this.role === 'host' && this.handlers.onHostNeedsToSendPuzzle) {
          this.partnerName = data.guestName || 'Pacar';
          this.isConnected = true;
          if (this.handlers.onPartnerJoined) {
            this.handlers.onPartnerJoined(this.partnerName);
          }
          this.handlers.onHostNeedsToSendPuzzle();
        }
        break;

      case 'INIT_PUZZLE':
        if (this.handlers.onReceivePuzzleInit) {
          this.handlers.onReceivePuzzleInit(data);
        }
        break;

      case 'CURSOR':
        if (this.handlers.onPartnerCursor) {
          this.handlers.onPartnerCursor(data.x, data.y, this.partnerName);
        }
        break;

      case 'DRAG_PIECES':
        if (this.handlers.onPartnerDragPieces) {
          this.handlers.onPartnerDragPieces(data.updates);
        }
        break;

      case 'DROP_PIECES':
        if (this.handlers.onPartnerDropPieces) {
          this.handlers.onPartnerDropPieces(data.updates);
        }
        break;

      case 'ORGANIZE_PIECES':
        if (this.handlers.onPartnerOrganizePieces) {
          this.handlers.onPartnerOrganizePieces(data.updates);
        }
        break;

      case 'REACTION_EMOJI':
        if (this.handlers.onReceiveEmoji) {
          this.handlers.onReceiveEmoji(data.emoji, data.sender || this.partnerName);
        }
        break;

      case 'VICTORY_REVEAL':
        if (this.handlers.onReceiveVictory) {
          this.handlers.onReceiveVictory(data);
        }
        break;

      case 'CHANGE_THEME':
        if (this.handlers.onPartnerChangeTheme) {
          this.handlers.onPartnerChangeTheme(data.theme);
        }
        break;
    }
  }

  sendCursor(x, y) {
    const now = Date.now();
    if (now - this.lastCursorSend > 45) {
      this.lastCursorSend = now;
      this.send({ type: 'CURSOR', x, y });
    }
  }

  sendDrag(updates) {
    const now = Date.now();
    if (now - this.lastDragSend > 35) {
      this.lastDragSend = now;
      this.send({ type: 'DRAG_PIECES', updates });
    }
  }

  sendDrop(updates) {
    this.send({ type: 'DROP_PIECES', updates });
  }

  sendOrganize(updates) {
    this.send({ type: 'ORGANIZE_PIECES', updates });
  }

  sendEmoji(emoji) {
    this.send({ type: 'REACTION_EMOJI', emoji, sender: this.myName });
  }

  sendTheme(theme) {
    this.send({ type: 'CHANGE_THEME', theme });
  }
}

window.PuzzleMultiplayer = PuzzleMultiplayer;
