/**
 * main.js
 * * Update Catatan:
 * - Udah dipindahin key API nya ke config.js biar gak dicolong orang wkwk.
 * - Login admin udah jalan (klik icon perisai).
 * - Load foto tim otomatis, jadi gak usah ngetik HTML satu-satu lagi.
 * - Lirik lagu bisa jalan barengan musik (sync).
 * - UPDATE: Tombol minimize musik udah dibenerin, skrg gak kepotong lagi.
 * - UPDATE (LAGI): Animasinya dibikin smooth pake bezier.
 * - UPDATE (LAGI2): Pas minimize, animasi dibikin antri (konten ilang dulu -> baru kotak kecil).
 * - ADA EFEK NATALNYA JUGA DONG! Salju, Bintang, Pohon.
 * - UPDATE BUG FIX: Counter foto team sekarang dinamis & support tombol panah keyboard.
 * - UPDATE FITUR: Lagu sekarang otomatis Loop (muter ulang) sampe user ganti sendiri.
 */

/*
   DAFTAR LAGU
   Kalo mau nambah lagu, tulis path-nya di sini ya.
   Formatnya: 'folder/namafile.mp3'
*/
const musicFiles = [
  'music/instrumentalxmas.mp3',
  'music/amelsound.mp3',
  'music/sigma.mp3',
  'music/sperta.mp3'
];

document.addEventListener('DOMContentLoaded', () => {
  console.log('Web initializing...');
  // Pake try-catch biar kalau ada error, loading screen dipaksa ilang (Safety Net)
  try {
    Site.init();
  } catch (error) {
    console.error("Critical Error saat init:", error);
    // Kalau error parah, paksa buka loading screen biar gak blank
    const loader = document.getElementById('loading-screen');
    if (loader) loader.style.display = 'none';
    document.body.style.overflow = '';
  }
});

const Site = (function() {
  // Ambil elemen audio
  const audio = document.getElementById('background-music');

  // Variabel buat player musik (biar gak ngetik ulang-ulang)
  const modern = {
    container: document.getElementById('modern-music-player'),
    toggle: document.getElementById('modern-toggle'),
    album: document.getElementById('modern-album'),
    title: document.getElementById('modern-title'),
    artist: document.getElementById('modern-artist'),
    lyrics: document.getElementById('modern-lyrics'),
    playBtn: document.getElementById('modern-play'),
    playIcon: document.getElementById('modern-play-icon'),
    prevBtn: document.getElementById('modern-prev'),
    nextBtn: document.getElementById('modern-next'),
    progressContainer: document.getElementById('modern-progress-container'),
    progressBar: document.getElementById('modern-progress'),
    currentTime: document.getElementById('modern-current'),
    totalTime: document.getElementById('modern-total')
  };

  // Variabel bantuan
  let currentIndex = 0;
  let isPlaying = false;
  let rafId = null;
  let currentLyrics = [];
  let currentLyricIndex = -1;

  /* Fungsi buat format waktu biar jadi (Menit:Detik) */
  function fmt(time) {
    if (!isFinite(time) || time <= 0) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Ambil nama file doang tanpa path ribet
  function baseName(path) {
    if (!path) return '';
    return path.split('/').pop().replace(/\.[^/.]+$/, '');
  }

  // Kalo metadata lagu gak ada, pake ginian aja buat default
  function metaFromPath(path) {
    const base = baseName(path);
    const title = base.replace(/[-_]/g, ' ');
    const img = `images/${base}.jpg`;
    return {
      title: decodeURIComponent(title),
      artist: '',
      img
    };
  }

  // Logic ganti lagu & LOOP
  function loadTrack(index) {
    if (!audio) return;
    if (!musicFiles || musicFiles.length === 0) {
      audio.removeAttribute('src');
      renderMeta({
        title: 'No Song',
        artist: '',
        img: 'images/elaina.jpg'
      });
      updateTimeUI(0, 0);
      return;
    }
    // Logic loop playlist (kalo abis balik ke awal)
    currentIndex = ((index % musicFiles.length) + musicFiles.length) % musicFiles.length;
    const path = musicFiles[currentIndex];
    audio.src = path;
    
    // === FITUR LOOP LAGU ===
    // Ini bikin lagu muter ulang-ulang terus
    audio.loop = true; 
    
    audio.load();

    // Reset lirik biar bersih
    currentLyrics = [];
    currentLyricIndex = -1;
    modern.lyrics.textContent = '...';

    const base = baseName(path);
    const lyricFilePath = `${base}.json`;

    console.log(`Lagi muter: ${path}`);

    // Coba cari file lirik .json
    fetch(lyricFilePath)
      .then(res => {
        if (!res.ok) throw new Error(`File JSON '${lyricFilePath}' gak ketemu.`);
        return res.json();
      })
      .then(data => {
        if (data.music) {
          const musicData = data.music;
          currentLyrics = musicData.timeSync || [];
          updateLyrics(0);
          const title = musicData.title || base.replace(/[-_]/g, ' ');
          const artist = musicData.artist || "";
          const img = musicData.albumArt || `images/${base}.jpg`;
          renderMeta({
            title: title,
            artist: artist,
            img: img
          });
        }
      })
      .catch(err => {
        // Kalo error atau gak ada lirik, yaudah pake default
        currentLyrics = [];
        modern.lyrics.textContent = 'Lirik tidak tersedia.';
        const meta = metaFromPath(path);
        renderMeta(meta);
      });
  }

  // Fungsi Play, Pause, Next, Prev
  function play() {
    if (!audio || !audio.src) return;
    audio.play().catch(e => console.warn('Browser nge-block autoplay, klik dulu gan:', e));
    isPlaying = true;
    updatePlayIcon();
    startRAF();
  }

  function pause() {
    if (!audio) return;
    audio.pause();
    isPlaying = false;
    updatePlayIcon();
    cancelRAF();
  }

  function togglePlay() {
    if (isPlaying) pause();
    else play();
  }

  function prev() {
    loadTrack(currentIndex - 1);
    if (isPlaying) setTimeout(() => play(), 150);
  }

  function next() {
    loadTrack(currentIndex + 1);
    if (isPlaying) setTimeout(() => play(), 150);
  }

  function updatePlayIcon() {
    if (!modern.playIcon) return;
    modern.playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
  }

  function renderMeta(meta) {
    if (!modern) return;
    modern.title.textContent = meta.title || 'Unknown';
    modern.artist.textContent = meta.artist || '';
    modern.album.src = meta.img || 'images/elaina.jpg';
  }

  function updateTimeUI(current, total) {
    if (!modern) return;
    modern.currentTime.textContent = fmt(current);
    modern.totalTime.textContent = fmt(total);
    const pct = total ? (current / total) * 100 : 0;
    modern.progressBar.style.width = pct + '%';
  }

  function onTimeUpdate() {
    if (!audio) return;
    updateTimeUI(audio.currentTime || 0, audio.duration || 0);
  }

  function onLoadedMetadata() {
    if (!audio) return;
    updateTimeUI(0, audio.duration || 0);
  }

  function onEnded() {
    // Karena audio.loop = true, ini jarang kepanggil kecuali loop dimatiin manual.
    next(); 
  }

  // Buat geser-geser progress bar
  function seek(e) {
    if (!modern.progressContainer || !audio) return;
    const rect = modern.progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    if (audio.duration) audio.currentTime = pct * audio.duration;
    onTimeUpdate();
  }

  // Request Animation Frame (biar smooth)
  function startRAF() {
    cancelRAF();
    const step = () => {
      if (audio && audio.duration) {
        const currentTime = audio.currentTime || 0;
        updateTimeUI(currentTime, audio.duration);
        updateLyrics(currentTime);
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function cancelRAF() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Logic Lirik Karaoke
  function updateLyrics(time) {
    if (!currentLyrics || currentLyrics.length === 0) return;
    let newLyricIndex = -1;
    let currentLyricText = null;
    for (let i = 0; i < currentLyrics.length; i++) {
      if (currentLyrics[i].time <= time) {
        currentLyricText = currentLyrics[i].text;
        newLyricIndex = i;
      } else {
        break;
      }
    }
    if (newLyricIndex !== currentLyricIndex) {
      currentLyricIndex = newLyricIndex;
      if (currentLyricText) {
        modern.lyrics.textContent = currentLyricText;
      } else if (currentLyricIndex === -1 && currentLyrics.length > 0) {
        modern.lyrics.textContent = '...';
      }
    }
  }

  // Sambungin fungsi JS ke tombol HTML
  function attachModernUI() {
    if (!modern) return;

    if (modern.playBtn) modern.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
    if (modern.prevBtn) modern.prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      prev();
    });
    if (modern.nextBtn) modern.nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      next();
    });
    if (modern.progressContainer) modern.progressContainer.addEventListener('click', seek);

    // LOGIC MINIMIZE (Cukup toggle class CSS aja)
    if (modern.toggle) modern.toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      modern.container.classList.toggle('minimized');
    });

    if (modern.album) {
      modern.album.onerror = function() {
        if (!this.src.endsWith('elaina.jpg')) {
          this.src = 'images/elaina.jpg'; // Gambar cadangan kalo error
        }
      };
    }

    // Tombol Spasi buat Pause/Play
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlay();
      }
    });

    if (!audio) return;
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', () => {
      isPlaying = true;
      updatePlayIcon();
      startRAF();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayIcon();
      cancelRAF();
    });
  }

  // Fitur liat foto zoom (IMAGE VIEWER - FIXED)
  function initImageViewer() {
    const viewer = document.getElementById('image-viewer');
    const viewerImage = document.getElementById('viewer-image');
    // Elemen buat update angka counter
    const currentIndexSpan = document.getElementById('current-index');
    const totalImagesSpan = document.getElementById('total-images');
    
    if (!viewer || !viewerImage) return;

    const imgs = Array.from(document.querySelectorAll('.member-photo-simple')).map(img => ({
      src: img.src,
      alt: img.alt
    }));
    let currentViewerIndex = 0;
    
    // FIX: Set Total Images di awal sesuai jumlah foto yg ada
    if (totalImagesSpan) {
        totalImagesSpan.textContent = imgs.length;
    }

    document.querySelectorAll('.member-photo-simple').forEach((img, idx) => {
      const newImg = img.cloneNode(true);
      img.parentNode.replaceChild(newImg, img);

      newImg.addEventListener('click', () => {
        currentViewerIndex = idx;
        viewer.classList.add('active');
        // Panggil fungsi updateViewer biar gambar & angka langsung bener
        updateViewer(currentViewerIndex);
        document.body.style.overflow = 'hidden';
      });
    });

    const closeBtn = document.querySelector('.close-viewer');

    function closeViewer() {
        viewer.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeViewer);
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) {
        closeViewer();
      }
    });

    const prevBtn = document.querySelector('.viewer-prev');
    const nextBtn = document.querySelector('.viewer-next');

    function updateViewer(i) {
      currentViewerIndex = (i + imgs.length) % imgs.length;
      viewerImage.src = imgs[currentViewerIndex].src;
      viewerImage.alt = imgs[currentViewerIndex].alt;
      
      // Bug fix: Update angka counter saat geser
      if (currentIndexSpan) {
          currentIndexSpan.textContent = currentViewerIndex + 1;
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateViewer(currentViewerIndex - 1);
    });
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateViewer(currentViewerIndex + 1);
    });

    // Bug fix: Tambah event listener keyboard (Panah Kiri/Kanan)
    document.addEventListener('keydown', (e) => {
        // Cek kalo viewer lagi aktif aja
        if (viewer.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                updateViewer(currentViewerIndex - 1);
            } else if (e.key === 'ArrowRight') {
                updateViewer(currentViewerIndex + 1);
            } else if (e.key === 'Escape') {
                closeViewer();
            }
        }
    });
  }

  // Load tim otomatis dari folder images
  function initDynamicTeamLoader() {
    const scrollContainer = document.querySelector('.team-member-scroll');
    if (!scrollContainer) return;
    scrollContainer.innerHTML = '';
    let photoCount = 0;

    function checkAndAddImage(index) {
      const imgPath = `images/team${index}.jpg`;
      const img = new Image();
      img.onload = function() {
        photoCount++;
        const cardHTML = `
          <div class="member-card-simple">
            <div class="member-photo-container">
              <img src="${imgPath}" alt="Sperta Squad Member ${index}" class="member-photo-simple">
            </div>
          </div>
        `;
        scrollContainer.insertAdjacentHTML('beforeend', cardHTML);
        checkAndAddImage(index + 1);
      };
      img.onerror = function() {
        // Stop kalo gambar udah gak ketemu, baru jalankan viewer
        initImageViewer();
      };
      img.src = imgPath;
    }
    checkAndAddImage(1);
  }

  // Logic Pesan Anonim (Firebase)
  function initAnonymousFeature() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined') {
      const listElement = document.getElementById('anon-messages-list');
      if (listElement) listElement.innerHTML = '<div class="anon-message-loading">Firebase SDK missing gan.</div>';
      return;
    }
    if (typeof firebaseConfig === 'undefined') {
      const listElement = document.getElementById('anon-messages-list');
      if (listElement) listElement.innerHTML = '<div class="anon-message-loading">Config.js belom dibikin.</div>';
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

      const db = firebase.firestore();
      const auth = firebase.auth();
      const messagesCollection = db.collection('pesan_anonim');

      const messageInput = document.getElementById('anon-message-input');
      const submitButton = document.getElementById('anon-submit-btn');
      const charCounter = document.getElementById('anon-char-counter');
      const messagesList = document.getElementById('anon-messages-list');
      const loginBtn = document.getElementById('admin-login-btn');
      const logoutBtn = document.getElementById('admin-logout-btn');

      if (!messageInput || !submitButton || !charCounter || !messagesList) return;

      let isAdmin = false;
      const provider = new firebase.auth.GoogleAuthProvider();

      if (loginBtn) loginBtn.addEventListener('click', () => {
        auth.signInWithPopup(provider).catch(error => alert("Login gagal, coba lagi."));
      });
      if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

      auth.onAuthStateChanged(user => {
        if (user) {
          isAdmin = true;
          if (loginBtn) loginBtn.style.display = 'none';
          if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
          isAdmin = false;
          if (loginBtn) loginBtn.style.display = 'block';
          if (logoutBtn) logoutBtn.style.display = 'none';
        }
        loadMessages();
      });

      messageInput.addEventListener('input', () => {
        const length = messageInput.value.length;
        const maxLength = messageInput.maxLength;
        charCounter.textContent = `${length} / ${maxLength}`;
        if (length >= maxLength) charCounter.classList.add('limit-reached');
        else charCounter.classList.remove('limit-reached');
      });

      submitButton.addEventListener('click', async () => {
        const messageText = messageInput.value.trim();
        if (messageText.length < 5) {
          alert('Pendek banget pesan lu bang.');
          return;
        }
        if (messageText.length > 500) {
          alert('Kepanjangan woy.');
          return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sabar...';

        try {
          await messagesCollection.add({
            text: messageText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          messageInput.value = '';
          charCounter.textContent = '0 / 500';
          charCounter.classList.remove('limit-reached');
        } catch (error) {
          alert('Yah error, gagal kirim.');
        } finally {
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Kirim';
        }
      });

      let messagesListener = null;

      function loadMessages() {
        if (messagesListener) messagesListener();
        messagesListener = messagesCollection.orderBy('timestamp', 'desc').limit(50)
          .onSnapshot(snapshot => {
            messagesList.innerHTML = '';
            if (snapshot.empty) {
              messagesList.innerHTML = '<div class="anon-message-loading">Masih sepi, isi dong.</div>';
              return;
            }
            snapshot.forEach(doc => {
              const data = doc.data();
              const messageId = doc.id;
              const messageCard = document.createElement('div');
              messageCard.className = 'anon-message-card';
              const date = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }) : 'Baru saja';
              const safeText = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
              const adminButtonHTML = isAdmin ? `<button class="admin-delete-btn" data-id="${messageId}" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>` : '';
              messageCard.innerHTML = `${adminButtonHTML}<p>${safeText}</p><span>${date}</span>`;
              messagesList.appendChild(messageCard);
            });
          }, error => {
            messagesList.innerHTML = '<div class="anon-message-loading">Gagal memuat pesan.</div>';
          });
      }

      messagesList.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.admin-delete-btn');
        if (deleteButton && isAdmin) {
          if (confirm('Yakin mau hapus? Gak bisa dibalikin loh.')) {
            try {
              await messagesCollection.doc(deleteButton.dataset.id).delete();
            } catch (error) {
              alert('Gagal hapus.');
            }
          }
        }
      });
    } catch (e) {
      console.error("Firebase Error:", e);
    }
  }

  // Popup Video
  function initVideoPopup() {
    const videoPopup = document.getElementById('video-popup');
    const popupVideo = document.getElementById('popup-video');
    const aboutVideo = document.querySelector('.about-video');

    function open() {
      if (!aboutVideo || !popupVideo || !videoPopup) return;
      const src = aboutVideo.querySelector('source') ? aboutVideo.querySelector('source').src : null;
      if (!src) return;
      popupVideo.innerHTML = '';
      const s = document.createElement('source');
      s.src = src;
      s.type = 'video/mp4';
      popupVideo.appendChild(s);
      popupVideo.load();
      videoPopup.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        popupVideo.play().catch(() => {});
      }, 200);
    }

    function close() {
      if (popupVideo) {
        popupVideo.pause();
        popupVideo.currentTime = 0;
      }
      if (videoPopup) {
        videoPopup.classList.remove('active');
      }
      document.body.style.overflow = '';
    }

    const overlay = document.querySelector('.video-overlay');
    if (overlay) overlay.addEventListener('click', open);
    const closeBtn = document.querySelector('.close-video-popup');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (videoPopup) videoPopup.addEventListener('click', (e) => {
      if (e.target === videoPopup) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && videoPopup && videoPopup.classList.contains('active')) close();
    });
  }

  // Navigasi Smooth Scroll & Tombol Back to Top
  function initNavAndBackToTop() {
    const navLinks = document.querySelectorAll('.ul-list li a');
    const sections = document.querySelectorAll('section');

    function removeActive() {
      navLinks.forEach(link => link.parentElement.classList.remove('active'));
    }
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('href').substring(1);
        const sec = document.getElementById(id);
        if (!sec) return;
        window.scrollTo({
          top: sec.offsetTop - 80,
          behavior: 'smooth'
        });
        removeActive();
        link.parentElement.classList.add('active');
      });
    });
    window.addEventListener('scroll', () => {
      let scrollPos = window.scrollY + 100;
      sections.forEach(section => {
        if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
          removeActive();
          const activeLink = document.querySelector(`.ul-list li a[href="#${section.id}"]`);
          if (activeLink) activeLink.parentElement.classList.add('active');
        }
      });
    });
    let backToTop = document.getElementById('back-to-top');
    if (!backToTop) {
      backToTop = document.createElement('div');
      backToTop.id = 'back-to-top';
      backToTop.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
      document.body.appendChild(backToTop);
      backToTop.addEventListener('click', () => window.scrollTo({
        top: 0,
        behavior: 'smooth'
      }));
    }
    window.addEventListener('scroll', () => {
      backToTop.style.display = window.scrollY > 500 ? 'flex' : 'none';
    });
  }

  // Animasi pas scroll
  function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active-reveal');
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // Scroll Tim Horizontal
  function initTeamScroll() {
    const teamScrollWrapper = document.querySelector('.team-scroll-wrapper');
    if (teamScrollWrapper) {
      teamScrollWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        teamScrollWrapper.scrollLeft += e.deltaY;
      });
    }
  }

  // Ganti Tema (Terang/Gelap)
  function updateThemeIcon(isDark) {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) return;
    themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  }

  function initThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) {
      const btn = document.createElement('button');
      btn.className = 'theme-toggle';
      btn.innerHTML = '<i class="fas fa-sun"></i>';
      document.body.appendChild(btn);
      btn.addEventListener('click', toggleTheme);
    } else {
      themeToggle.addEventListener('click', toggleTheme);
    }
    const saved = localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
      updateThemeIcon(true);
    } else {
      document.body.classList.remove('dark-mode');
      updateThemeIcon(false);
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
  }

  // Loading Screen & Typing Effect (FIXED BLACK SCREEN)
  function initLoadingAndTyping() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    const mainIcon = document.querySelector('.custom-logo');
    const subIcons = document.querySelectorAll('.sub-icons i');
    const designerText = document.getElementById('designer-text');
    const mainPage = document.getElementById('main-page');

    function showElement(el, delay = 0) {
      if (!el) return;
      setTimeout(() => {
        el.classList.remove('hidden');
        el.classList.add('fall');
      }, delay);
    }

    // Fungsi helper untuk menghilangkan loading dengan aman
    function hideLoadingSequence() {
      // Tunggu dikit biar animasi selesai
      setTimeout(() => {
        if (loadingScreen && loadingScreen.style.display !== 'none') {
          loadingScreen.style.transition = 'opacity 0.45s ease';
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (mainPage) mainPage.classList.add('visible');
            document.body.style.overflow = '';
          }, 500);
        }
      }, 350);
    }

    function startSequenceThenHide() {
      showElement(mainIcon, 0);
      showElement(loadingText, 650);
      subIcons.forEach((icon, idx) => showElement(icon, 1200 + idx * 350));
      showElement(designerText, 2200);
      setTimeout(hideLoadingSequence, 3200);
    }

    // FAILSAFE: Jika dalam 4 detik masih loading (karena bug atau internet lambat), paksa hilang
    setTimeout(() => {
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            console.warn("Loading screen timeout forced.");
            hideLoadingSequence();
        }
    }, 4000);

    if (!loadingScreen) {
      if (mainPage) mainPage.classList.add('visible');
      return;
    }

    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    document.body.style.overflow = 'hidden';

    if (document.readyState === 'complete') {
      setTimeout(startSequenceThenHide, 200);
    } else {
      window.addEventListener('load', () => startSequenceThenHide());
    }

    const typingElement = document.querySelector('.info-home h3');
    if (typingElement) {
      const words = ["Computer Engineering Students", "Web Development Learners", "Politeknik Negeri Manado", "Sperta Squad"];
      let wordIndex = 0,
        charIndex = 0,
        isDeleting = false;

      function type() {
        const currentWord = words[wordIndex];
        let displayed = currentWord.substring(0, charIndex);
        typingElement.innerHTML = displayed + '<span class="cursor">|</span>';
        if (!isDeleting && charIndex < currentWord.length) {
          charIndex++;
          setTimeout(type, 100);
        } else if (isDeleting && charIndex > 0) {
          charIndex--;
          setTimeout(type, 50);
        } else {
          isDeleting = !isDeleting;
          if (!isDeleting) wordIndex = (wordIndex + 1) % words.length;
          setTimeout(type, 800);
        }
      }
      setTimeout(() => {
        try {
          type();
        } catch (e) {}
      }, 800);
    }
  }

  // EFEK NATAL (POPUP & EFEK - STARS RESTORED!)
  function initChristmasMagic() {
    const container = document.getElementById('christmas-container');
    if (!container) return;

    // Bikin salju
    for (let i = 0; i < 50; i++) {
      const snowflake = document.createElement('div');
      snowflake.classList.add('snowflake');
      snowflake.textContent = ['❄', '❅', '❆', '•'][Math.floor(Math.random() * 4)];
      snowflake.style.left = Math.random() * 100 + 'vw';
      snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
      snowflake.style.opacity = Math.random();
      snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
      container.appendChild(snowflake);
    }

    // Bikin bintang kedip-kedip (INI YANG TADI HILANG, UDAH BALIK YA!)
    for (let i = 0; i < 12; i++) {
      const star = document.createElement('div');
      star.classList.add('christmas-star');
      star.innerHTML = '<i class="fas fa-star"></i>';
      container.appendChild(star);
      setInterval(() => {
        star.style.left = Math.random() * 100 + 'vw';
        star.style.top = Math.random() * 100 + 'vh';
        star.classList.add('visible');
        setTimeout(() => star.classList.remove('visible'), 1000);
      }, Math.random() * 3000 + 2000);
    }

    // Widget Pohon
    const tree = document.createElement('div');
    tree.className = 'christmas-tree-widget';
    tree.innerHTML = '<i class="fas fa-tree" style="color:#2ecc71;"></i><i class="fas fa-star" style="color:#f1c40f; position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:15px;"></i>';
    document.body.appendChild(tree);

    // Popup Handler
    const popupOverlay = document.getElementById('christmas-popup');
    const closePopupBtn = document.getElementById('close-xmas-popup');

    function closeChristmasPopup() {
      if (popupOverlay) {
        popupOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    tree.addEventListener('click', (e) => {
      e.stopPropagation();
      if (popupOverlay) {
        popupOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
    if (closePopupBtn) closePopupBtn.addEventListener('click', closeChristmasPopup);
    if (popupOverlay) popupOverlay.addEventListener('click', (e) => {
      if (e.target === popupOverlay) closeChristmasPopup();
    });
  }

  function init() {
    // Jalankan semua fungsi
    try {
        attachModernUI();
        loadTrack(0);
        initDynamicTeamLoader();
        initAnonymousFeature();
        initVideoPopup();
        initNavAndBackToTop();
        initRevealObserver();
        initTeamScroll();
        initThemeToggle();
        initLoadingAndTyping();
        initChristmasMagic();
        
        // Hack biar autoplay jalan saat user pertama kali interaksi
        document.addEventListener('click', function first() {
          if (audio && audio.src && !isPlaying) {
            audio.play().then(() => audio.pause()).catch(() => {});
          }
          document.removeEventListener('click', first);
        }, {
          once: true,
          capture: true
        });
    } catch(e) {
        console.error("Error di fungsi init utama:", e);
        // Pastikan loading screen hilang kalau ada error di sini
        const loader = document.getElementById('loading-screen');
        if (loader) loader.style.display = 'none';
        document.body.style.overflow = '';
    }
  }

  return {
    init
  };
})();