window.addEventListener('load', function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    /**
     * Mengelola semua input keyboard.
     */
    class InputHandler {
        constructor(game) {
            this.keys = new Set();
            // Menambahkan event listener untuk tombol yang ditekan
            window.addEventListener('keydown', (e) => {
                // Tombol Tab digunakan untuk mode debug, mencegah perilaku default browser
                if (e.key === 'Tab') {
                    e.preventDefault();
                    game.debug = !game.debug;
                    console.log(`Debug Mode: ${game.debug ? 'Active' : 'Inactive'}`);
                } else {
                    this.keys.add(e.key);
                }
            });
            // Menambahkan event listener untuk tombol yang dilepas
            window.addEventListener('keyup', (e) => this.keys.delete(e.key));
        }

        /**
         * Memeriksa apakah salah satu dari tombol yang diberikan sedang ditekan.
         * @param {...string} keys Nama-nama tombol yang akan diperiksa (misalnya 'ArrowUp', 'w').
         * @returns {boolean} True jika salah satu tombol ditekan, false jika tidak.
         */
        isKeyPressed(...keys) {
            return keys.some(key => this.keys.has(key));
        }
    }

    /**
     * Mengelola logika, posisi, dan animasi karakter pemain.
     */
    class Player {
        constructor(game) {
            this.game = game;
            this.width = 24;  // Lebar sprite pemain
            this.height = 32; // Tinggi sprite pemain
            this.x = 100;     // Posisi X awal pemain
            this.y = 100;     // Posisi Y awal pemain
            this.speed = 0.5;   // Kecepatan pergerakan pemain

            this.direction = 'down'; // Arah hadap awal pemain
            this.isMoving = false;   // Status pergerakan
            this.frame = 0;          // Frame animasi saat ini
            this.animationSpeed = 0.2; // Kecepatan pergantian frame
            this.frameCount = 4;     // Jumlah frame per animasi arah
        }

        /**
         * Memperbarui status pemain (pergerakan, animasi).
         */
        update() {
            this.handleMovement();
            this.updateAnimation();
        }

        /**
         * Menggambar pemain di kanvas.
         * @param {CanvasRenderingContext2D} context Konteks gambar kanvas.
         */
        draw(context) {
            const playerImages = this.game.assets.playerImages;
            const img = playerImages[this.direction];

            if (img) {
                const frameWidth = img.width / this.frameCount;
                context.drawImage(
                    img,
                    Math.floor(this.frame) * frameWidth, 0, // Posisi sumber di sprite sheet
                    frameWidth, img.height,                 // Ukuran sumber di sprite sheet
                    this.x, this.y,                         // Posisi tujuan di kanvas
                    this.width, this.height                 // Ukuran tujuan di kanvas
                );
            }

            // Menggambar kotak collision (hitbox) di kaki pemain saat mode debug aktif
            if (this.game.debug) {
                context.strokeStyle = 'lime';
                context.lineWidth = 1;
                const pad = 2; // Padding untuk membuat collision box sedikit lebih kecil dari sprite
                const collisionBoxWidth = this.width - (pad * 2);
                const collisionBoxHeight = 4; // Tinggi area collision di kaki
                const collisionBoxX = this.x + pad;
                const collisionBoxY = this.y + this.height - collisionBoxHeight - 2; // Posisi Y di kaki
                context.strokeRect(collisionBoxX, collisionBoxY, collisionBoxWidth, collisionBoxHeight);
            }
        }

        /**
         * Menangani pergerakan pemain berdasarkan input keyboard.
         */
        handleMovement() {
            this.isMoving = false;
            let dx = 0; // Perubahan posisi X
            let dy = 0; // Perubahan posisi Y

            // Menentukan arah pergerakan dan arah hadap pemain
            if (this.game.input.isKeyPressed('ArrowUp', 'w')) { dy -= this.speed; this.direction = 'up'; }
            if (this.game.input.isKeyPressed('ArrowDown', 's')) { dy += this.speed; this.direction = 'down'; }
            if (this.game.input.isKeyPressed('ArrowLeft', 'a')) { dx -= this.speed; this.direction = 'left'; }
            if (this.game.input.isKeyPressed('ArrowRight', 'd')) { dx += this.speed; this.direction = 'right'; }

            if (dx !== 0 || dy !== 0) {
                this.isMoving = true;

                // Memeriksa tabrakan terpisah untuk pergerakan X dan Y
                // Ini memungkinkan pemain untuk "meluncur" di sepanjang dinding
                if (this.canMove(this.x + dx, this.y)) {
                    this.x += dx;
                }
                if (this.canMove(this.x, this.y + dy)) {
                    this.y += dy;
                }
            }
        }

        /**
         * Memeriksa apakah pemain bisa bergerak ke posisi target tanpa menabrak objek.
         * Ini adalah metode **penting** untuk mencegah pemain keluar dari peta.
         * @param {number} targetX Posisi X yang akan diperiksa.
         * @param {number} targetY Posisi Y yang akan diperiksa.
         * @returns {boolean} True jika bisa bergerak, false jika ada tabrakan.
         */
        canMove(targetX, targetY) {
            const pad = 2; // Padding untuk collision box
            const collisionBoxWidth = this.width - (pad * 2);
            const collisionBoxHeight = 4; // Tinggi area collision di kaki
            const collisionBoxX = targetX + pad;
            const collisionBoxY = targetY + this.height - collisionBoxHeight - 2;

            // Periksa 4 sudut dari kotak collision di kaki pemain
            // Jika ada salah satu sudut yang menabrak tile bertabrakan, maka tidak bisa bergerak
            if (this.game.isColliding(collisionBoxX, collisionBoxY) ||                  // Sudut kiri atas collision box
                this.game.isColliding(collisionBoxX + collisionBoxWidth, collisionBoxY) || // Sudut kanan atas collision box
                this.game.isColliding(collisionBoxX, collisionBoxY + collisionBoxHeight) || // Sudut kiri bawah collision box
                this.game.isColliding(collisionBoxX + collisionBoxWidth, collisionBoxY + collisionBoxHeight)) { // Sudut kanan bawah collision box
                return false; // Ada tabrakan
            }
            return true; // Aman untuk bergerak
        }

        /**
         * Memperbarui frame animasi pemain.
         */
        updateAnimation() {
            if (this.isMoving) {
                this.frame = (this.frame + this.animationSpeed) % this.frameCount;
            } else {
                this.frame = 0; // Kembali ke frame awal saat tidak bergerak
            }
        }
    }

    /**
     * Mengelola tampilan kamera dan level zoom.
     */
    class Camera {
        constructor(game) {
            this.game = game;
            this.x = 0;     // Posisi X kamera
            this.y = 0;     // Posisi Y kamera
            this.scale = 2; // Faktor zoom kamera (2x zoom)
        }

        /**
         * Memperbarui posisi kamera agar mengikuti pemain.
         */
        update() {
            const player = this.game.player;
            // Hitung lebar dan tinggi area pandang (viewport) setelah di-zoom
            const viewWidth = this.game.width / this.scale;
            const viewHeight = this.game.height / this.scale;

            // Pusatkan kamera pada pemain
            this.x = player.x + player.width / 2 - viewWidth / 2;
            this.y = player.y + player.height / 2 - viewHeight / 2;

            // Membatasi kamera agar tidak keluar dari batas peta
            // Ini sangat penting untuk menjaga kamera tetap di dalam area map
            this.x = Math.max(0, Math.min(this.x, this.game.map.width - viewWidth));
            this.y = Math.max(0, Math.min(this.y, this.game.map.height - viewHeight));
        }
    }

    /**
     * Kelas utama yang mengikat semua bagian game menjadi satu.
     */
    class Game {
        constructor(canvas) {
            this.canvas = canvas;
            this.width = canvas.width;
            this.height = canvas.height;
            this.debug = false; // Mode debug, aktifkan/nonaktifkan dengan tombol Tab

            this.map = {
                tileSize: 32,      // Ukuran satu ubin (tile) dalam piksel
                cols: 0,           // Jumlah kolom ubin (akan diisi setelah map dimuat)
                rows: 0,           // Jumlah baris ubin (akan diisi setelah map dimuat)
                width: 0,          // Lebar total peta dalam piksel (akan diisi setelah map dimuat)
                height: 0,         // Tinggi total peta dalam piksel (akan diisi setelah map dimuat)
                collisionData: []  // Data tabrakan dari file CSV
            };

            this.assets = {
                mapImage: null,
                playerImages: { down: null, up: null, left: null, right: null }
            };

            this.loading = true; // Status loading aset game
            this.input = new InputHandler(this);
            this.player = new Player(this);
            this.camera = new Camera(this);

            // Memuat semua aset yang diperlukan sebelum game dimulai
            this.loadAssets()
                .then(() => {
                    this.loading = false;
                    console.log("✅ All assets successfully loaded!");
                })
                .catch(err => console.error("❌ Failed to load assets:", err));
        }

        /**
         * Memuat semua gambar dan data CSV yang diperlukan untuk game.
         */
        async loadAssets() {
            // Fungsi pembantu untuk memuat gambar
            const loadImage = src => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
                img.src = src;
            });

            // Fungsi pembantu untuk memuat data CSV
            const loadCsv = async (src) => {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`Failed to load CSV: ${src}`);
                const text = await response.text();
                // Mengubah nilai -1 (dari Tiled untuk tile kosong) menjadi 0
                return text.split(',').map(val => Number(val) === -1 ? 0 : Number(val));
            };

            // Memuat semua aset secara paralel
            const [collisionData, mapImage, pDown, pUp, pLeft, pRight] = await Promise.all([
                loadCsv('keren_collition.csv'),   // Pastikan nama file ini benar
                loadImage('lintang.png'),         // Gambar map utama
                loadImage('playerDown.png'),
                loadImage('playerUp.png'),
                loadImage('playerLeft.png'),
                loadImage('playerRight.png')
            ]);

            this.map.collisionData = collisionData;
            this.assets.mapImage = mapImage;
            this.assets.playerImages = { down: pDown, up: pUp, left: pLeft, right: pRight };

            // === PENTING: Perbarui dimensi peta setelah gambar map dimuat ===
            this.map.width = mapImage.width;
            this.map.height = mapImage.height;
            this.map.cols = Math.floor(mapImage.width / this.map.tileSize);
            this.map.rows = Math.floor(mapImage.height / this.map.tileSize);
        }

        /**
         * Memeriksa apakah koordinat piksel tertentu menabrak ubin yang tidak bisa dilewati.
         * Ini adalah metode **penting** untuk mencegah karakter keluar dari peta.
         * @param {number} x Koordinat X dalam piksel.
         * @param {number} y Koordinat Y dalam piksel.
         * @returns {boolean} True jika ada tabrakan, false jika tidak.
         */
        isColliding(x, y) {
            const { tileSize, cols, rows, collisionData } = this.map;
            const tileX = Math.floor(x / tileSize);
            const tileY = Math.floor(y / tileSize);

            // Jika koordinat berada di luar batas peta (tileX/tileY negatif atau melebihi kolom/baris)
            // maka anggap itu sebagai tabrakan untuk mencegah karakter keluar map.
            if (tileX < 0 || tileX >= cols || tileY < 0 || tileY >= rows) {
                return true;
            }

            const index = tileY * cols + tileX;

            // Anggap tabrakan HANYA jika ID tile > 0.
            // Tile kosong (ID 0 atau -1 yang sudah diubah ke 0) tidak dianggap tabrakan.
            return collisionData[index] > 0;
        }

        /**
         * Memperbarui seluruh logika game.
         */
        update() {
            if (this.loading) return; // Jangan update jika aset belum dimuat
            this.player.update();
            this.camera.update();
        }

        /**
         * Menggambar semua elemen game ke kanvas.
         * @param {CanvasRenderingContext2D} context Konteks gambar kanvas.
         */
        draw(context) {
            context.clearRect(0, 0, this.width, this.height); // Bersihkan kanvas

            if (this.loading) {
                // Tampilkan pesan loading atau animasi
                context.fillStyle = 'black';
                context.fillRect(0, 0, this.width, this.height);
                context.fillStyle = 'white';
                context.font = '24px Arial';
                context.textAlign = 'center';
                context.fillText('Loading Game Assets...', this.width / 2, this.height / 2);
                return;
            }

            context.save(); // Simpaddan state konteks saat ini

            // Terapkan zoom dan translasi kamera untuk menggambar dunia
            context.scale(this.camera.scale, this.camera.scale);
            context.translate(-this.camera.x, -this.camera.y);

            // Gambar map
            if (this.assets.mapImage) {
                context.drawImage(this.assets.mapImage, 0, 0, this.map.width, this.map.height);
            }

            // Gambar map collision jika mode debug aktif
            if (this.debug) {
                this.drawCollisionMap(context);
            }

            // Gambar pemain
            this.player.draw(context);

            context.restore(); // Kembalikan state konteks yang disimpan
        }

        /**
         * Menggambar visualisasi map collision (untuk debug).
         * @param {CanvasRenderingContext2D} context Konteks gambar kanvas.
         */
        drawCollisionMap(context) {
            const { tileSize, cols, rows, collisionData } = this.map;
            context.fillStyle = 'rgba(255, 0, 0, 0.4)'; // Merah transparan

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const index = r * cols + c;
                    if (collisionData[index] > 0) { // Hanya gambar kotak jika tile memiliki ID tabrakan
                        context.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
                    }
                }
            }
        }
    }

    // Inisialisasi dan jalankan game
    const game = new Game(canvas);
    function animate() {
        game.update();
        game.draw(ctx);
        requestAnimationFrame(animate); // Loop animasi game
    }
    animate();
});