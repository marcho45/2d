window.addEventListener('load', function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    /**
     * Mengelola input keyboard, termasuk tombol Tab untuk debug.
     */
    class InputHandler {
        constructor(game) {
            this.keys = new Set();
            window.addEventListener('keydown', (e) => {
                // Gunakan tombol Tab untuk mengaktifkan/menonaktifkan mode debug
                if (e.key === 'Tab') {
                    e.preventDefault(); // Mencegah pindah fokus dari game
                    game.debug = !game.debug;
                    console.log(`Mode Debug: ${game.debug ? 'Aktif' : 'Nonaktif'}`);
                } else {
                    this.keys.add(e.key);
                }
            });
            window.addEventListener('keyup', (e) => this.keys.delete(e.key));
        }

        isKeyPressed(...keys) {
            return keys.some(key => this.keys.has(key));
        }
    }

    /**
     * Mengelola semua logika untuk karakter pemain.
     */
    class Player {
        constructor(game) {
            this.game = game;
            this.width = 24;
            this.height = 32;
            this.x = 100; // Posisi awal X (pastikan ini di area yang aman)
            this.y = 100; // Posisi awal Y
            this.speed = 3;

            this.direction = 'down';
            this.isMoving = false;
            this.frame = 0;
            this.animationSpeed = 0.2;
            this.frameCount = 4;
        }

        update() {
            this.handleMovement();
            this.updateAnimation();
        }

        draw(context) {
            const playerImages = this.game.assets.playerImages;
            const img = playerImages[this.direction];

            if (img) {
                const frameWidth = img.width / this.frameCount;
                context.drawImage(
                    img,
                    Math.floor(this.frame) * frameWidth, 0,
                    frameWidth, img.height,
                    this.x, this.y,
                    this.width, this.height
                );
            }

            // Gambar kotak collision di kaki pemain saat mode debug aktif
            if (this.game.debug) {
                context.strokeStyle = 'lime';
                context.lineWidth = 1;
                const pad = 2;
                const left = this.x + pad;
                const right = this.x + this.width - pad;
                const top = this.y + this.height - 6;
                const bottom = this.y + this.height - 2;
                context.strokeRect(left, top, right - left, bottom - top);
            }
        }

        handleMovement() {
            this.isMoving = false;
            let dx = 0, dy = 0;

            if (this.game.input.isKeyPressed('ArrowUp', 'w')) { dy -= this.speed; this.direction = 'up'; }
            if (this.game.input.isKeyPressed('ArrowDown', 's')) { dy += this.speed; this.direction = 'down'; }
            if (this.game.input.isKeyPressed('ArrowLeft', 'a')) { dx -= this.speed; this.direction = 'left'; }
            if (this.game.input.isKeyPressed('ArrowRight', 'd')) { dx += this.speed; this.direction = 'right'; }

            if (dx !== 0 || dy !== 0) {
                this.isMoving = true;
                
                // Cek collision terpisah untuk X dan Y untuk gerakan yang lebih mulus (slide along walls)
                if (this.canMove(this.x + dx, this.y)) {
                    this.x += dx;
                }
                if (this.canMove(this.x, this.y + dy)) {
                    this.y += dy;
                }
            }
        }
        
        canMove(targetX, targetY) {
            const pad = 2;
            const left = targetX + pad;
            const right = targetX + this.width - pad;
            const top = targetY + this.height - 6; // Area atas kaki
            const bottom = targetY + this.height - 2; // Area bawah kaki

            // Cek 4 sudut dari kotak collision di kaki
            if (this.game.isColliding(left, top) || this.game.isColliding(right, top) || this.game.isColliding(left, bottom) || this.game.isColliding(right, bottom)) {
                return false; // Ada tabrakan
            }
            return true; // Aman untuk bergerak
        }

        updateAnimation() {
            if (this.isMoving) {
                this.frame = (this.frame + this.animationSpeed) % this.frameCount;
            } else {
                this.frame = 0;
            }
        }
    }

    /**
     * Mengelola kamera dan zoom.
     */
    class Camera {
        constructor(game) {
            this.game = game;
            this.x = 0;
            this.y = 0;
            this.scale = 2; // Faktor zoom
        }

        update() {
            const player = this.game.player;
            const viewWidth = this.game.width / this.scale;
            const viewHeight = this.game.height / this.scale;

            // Pusatkan kamera pada pemain
            this.x = player.x + player.width / 2 - viewWidth / 2;
            this.y = player.y + player.height / 2 - viewHeight / 2;

            // Jaga kamera agar tidak keluar dari batas peta
            this.x = Math.max(0, Math.min(this.x, this.game.map.width - viewWidth));
            this.y = Math.max(0, Math.min(this.y, this.game.map.height - viewHeight));
        }
    }

    /**
     * Kelas utama yang mengikat semua bagian menjadi satu.
     */
    class Game {
        constructor(canvas) {
            this.canvas = canvas;
            this.width = canvas.width;
            this.height = canvas.height;
            this.debug = false; // Aktifkan dengan menekan tombol Tab

            this.map = {
                tileSize: 32,
                cols: 64, rows: 64,
                width: 2048, height: 2048,
                collisionData: []
            };

            this.assets = {
                mapImage: null,
                playerImages: { down: null, up: null, left: null, right: null }
            };

            this.loading = true;
            this.input = new InputHandler(this);
            this.player = new Player(this);
            this.camera = new Camera(this);

            this.loadAssets()
                .then(() => {
                    this.loading = false;
                    console.log("✅ Semua aset berhasil dimuat!");
                })
                .catch(err => console.error("❌ Gagal memuat aset:", err));
        }

        async loadAssets() {
            const loadImage = src => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
                img.src = src;
            });

            const loadCsv = async (src) => {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`Gagal memuat CSV: ${src}`);
                const text = await response.text();
                // Mengubah nilai -1 (jika ada dari Tiled) menjadi 0, dan sisanya tetap
                return text.split(',').map(val => Number(val) === -1 ? 0 : Number(val));
            };

            // Ganti 'mapp3_collition.csv' jika Anda menggunakan nama file lain
            const [collisionData, mapImage, pDown, pUp, pLeft, pRight] = await Promise.all([
                loadCsv('colisionnnnnnnnnnn_collition.csv'),
                loadImage('lintang.png'),
                loadImage('playerDown.png'),
                loadImage('playerUp.png'),
                loadImage('playerLeft.png'),
                loadImage('playerRight.png')
            ]);

            this.map.collisionData = collisionData;
            this.assets.mapImage = mapImage;
            this.assets.playerImages = { down: pDown, up: pUp, left: pLeft, right: pRight };
        }

        isColliding(x, y) {
            const { tileSize, cols, rows, collisionData } = this.map;
            const tileX = Math.floor(x / tileSize);
            const tileY = Math.floor(y / tileSize);

            if (tileX < 0 || tileX >= cols || tileY < 0 || tileY >= rows) return true;
            
            const index = tileY * cols + tileX;

            // === PERBAIKAN UTAMA ADA DI SINI ===
            // Anggap tabrakan HANYA jika ID tile > 0.
            // Tile kosong (ID 0) tidak dianggap tabrakan.
            return collisionData[index] > 0;
        }

        update() {
            if (this.loading) return;
            this.player.update();
            this.camera.update();
        }

        draw(context) {
            context.clearRect(0, 0, this.width, this.height);
            if (this.loading) { /* ... kode loading ... */ return; }

            context.save();
            // Terapkan zoom kamera
            context.scale(this.camera.scale, this.camera.scale);
            // Geser dunia berdasarkan posisi kamera
            context.translate(-this.camera.x, -this.camera.y);

            if (this.assets.mapImage) {
                context.drawImage(this.assets.mapImage, 0, 0);
            }
            if (this.debug) {
                this.drawCollisionMap(context);
            }
            this.player.draw(context);
            
            context.restore();
        }

        drawCollisionMap(context) {
            const { tileSize, cols, rows, collisionData } = this.map;
            context.fillStyle = 'rgba(255, 0, 0, 0.4)'; // Merah transparan
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const index = r * cols + c;
                    if (collisionData[index] > 0) { // Hanya gambar kotak jika ada tabrakan
                        context.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
                    }
                }
            }
        }
    }

    const game = new Game(canvas);
    function animate() {
        game.update();
        game.draw(ctx);
        requestAnimationFrame(animate);
    }
    animate();
});
