/**
 * List Update:
 * - Kunci API udah dipindah ke config.js biar aman.
 * - Fitur Admin: Login, Logout, Hapus pesan (udah jalan).
 * - Tim: Load otomatis biar gak capek ngetik satu-satu.
 * - Lirik: Udah nge-sync sama lagu.
 * - UPDATE BARU: Tombol ganti tema (Matahari/Bulan).
 * - UPDATE NATAL: Efek salju, bintang kedip, pohon goyang, sama popup ucapan.
 */

/*
   DAFTAR LAGU - Ganti di sini aja
*/
const musicFiles = [
  'music/amelsound.mp3',
  'music/sigma.mp3',
  'music/sperta.mp3'
];
/* ============================ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Gas! Website siap meluncur...');
  Site.init();
});

const Site = (function(){
  // Ambil elemen HTML
  const audio = document.getElementById('background-music');

  // Bagian Player Musik Modern
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

  // State (variable penyimpan kondisi)
  let currentIndex = 0;
  let isPlaying = false;
  let rafId = null;
  
  // Simpen state lirik di sini
  let currentLyrics = []; 
  let currentLyricIndex = -1;

  /* ----------------- Helper Functions ----------------- */
  function fmt(time){
    // Format waktu biar jadi menit:detik
    if (!isFinite(time) || time <= 0) return '0:00';
    const m = Math.floor(time/60), s = Math.floor(time%60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function baseName(path){
    if (!path) return '';
    return path.split('/').pop().replace(/\.[^/.]+$/, '');
  }

  // Pake ini kalo metadata gak ketemu
  function metaFromPath(path){
    const base = baseName(path);
    const title = base.replace(/[-_]/g, ' ');
    const img = `images/${base}.jpg`;
    return { title: decodeURIComponent(title), artist: '', img };
  }

  /* ----------------- Logic Kontrol Audio ----------------- */
  
  function loadTrack(index){
    if (!audio) return;
    if (!musicFiles || musicFiles.length === 0) {
      audio.removeAttribute('src');
      renderMeta({ title: 'No Song', artist: '', img: 'images/elaina.jpg' });
      updateTimeUI(0,0);
      return;
    }
    // Logic biar playlist muter terus (loop)
    currentIndex = ((index % musicFiles.length) + musicFiles.length) % musicFiles.length;
    const path = musicFiles[currentIndex];
    audio.src = path;
    audio.load();

    // Reset lirik
    currentLyrics = [];
    currentLyricIndex = -1;
    modern.lyrics.textContent = '...'; 
    
    const base = baseName(path); 
    const lyricFilePath = `${base}.json`; 

    console.log(`Lagi muter: ${path}. Nyari lirik di: ${lyricFilePath}`);

    // Coba ambil file lirik
    fetch(lyricFilePath)
      .then(res => {
          if (!res.ok) {
            throw new Error(`File JSON '${lyricFilePath}' gak ketemu euy.`);
          }
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
          
          renderMeta({ title: title, artist: artist, img: img });

        } else {
          throw new Error(`Format JSON '${lyricFilePath}' salah, cek lagi strukturnya.`);
        }
      })
      .catch(err => {
        console.warn(`Gagal load metadata/lirik (${lyricFilePath}):`, err.message);
        currentLyrics = [];
        modern.lyrics.textContent = 'Lirik belum ada.'; 
        const meta = metaFromPath(path);
        renderMeta(meta);
      });
  }

  function play(){
    if (!audio || !audio.src) return;
    audio.play().catch(e => console.warn('Browser nge-block autoplay:', e));
    isPlaying = true;
    updatePlayIcon();
    startRAF();
  }

  function pause(){
    if (!audio) return;
    audio.pause();
    isPlaying = false;
    updatePlayIcon();
    cancelRAF();
  }

  function togglePlay(){
    if (isPlaying) pause(); else play();
  }

  function prev(){
    loadTrack(currentIndex - 1);
    if (isPlaying) setTimeout(()=> play(), 150);
  }

  function next(){
    loadTrack(currentIndex + 1);
    if (isPlaying) setTimeout(()=> play(), 150);
  }

  function updatePlayIcon(){
    if (!modern.playIcon) return;
    modern.playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
  }

  function renderMeta(meta){
    if (!modern) return;
    modern.title.textContent = meta.title || 'Unknown';
    modern.artist.textContent = meta.artist || ''; 
    modern.album.src = meta.img || 'images/elaina.jpg';
  }

  function updateTimeUI(current, total){
    if (!modern) return;
    modern.currentTime.textContent = fmt(current);
    modern.totalTime.textContent = fmt(total);
    const pct = total ? (current / total) * 100 : 0;
    modern.progressBar.style.width = pct + '%';
  }

  function onTimeUpdate(){
    if (!audio) return;
    updateTimeUI(audio.currentTime || 0, audio.duration || 0);
  }

  function onLoadedMetadata(){
    if (!audio) return;
    updateTimeUI(0, audio.duration || 0);
  }

  function onEnded(){
    next(); // Kalo abis, lanjut lagu berikutnya
  }

  function seek(e){
    if (!modern.progressContainer || !audio) return;
    const rect = modern.progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    if (audio.duration) audio.currentTime = pct * audio.duration;
    onTimeUpdate();
  }

  // Pake RAF biar smooth bar-nya
  function startRAF(){
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

  function cancelRAF(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  function updateLyrics(time) {
    if (!currentLyrics || currentLyrics.length === 0) return; 

    let newLyricIndex = -1;
    let currentLyricText = null;
    
    // Loop cari lirik yang pas sama timing
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

  /* ----------------- Sambungin ke UI ----------------- */
  function attachModernUI(){
    if (!modern) return;

    if (modern.playBtn) modern.playBtn.addEventListener('click', (e)=> { e.stopPropagation(); togglePlay(); });
    if (modern.prevBtn) modern.prevBtn.addEventListener('click', (e)=> { e.stopPropagation(); prev(); });
    if (modern.nextBtn) modern.nextBtn.addEventListener('click', (e)=> { e.stopPropagation(); next(); });
    if (modern.progressContainer) modern.progressContainer.addEventListener('click', seek);
    
    if (modern.toggle) modern.toggle.addEventListener('click', (e)=> { 
      e.stopPropagation(); 
      modern.container.classList.toggle('minimized'); 
    });

    if (modern.album) {
      modern.album.onerror = function() {
        if (!this.src.endsWith('elaina.jpg')) {
          this.src = 'images/elaina.jpg'; // Fallback gambar
        }
      };
    }

    // Shortcut spasi buat play/pause (kecuali lagi ngetik)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlay();
      }
    });

    // Event listener audio bawaan
    if (!audio) return;
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', () => { isPlaying = true; updatePlayIcon(); startRAF(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayIcon(); cancelRAF(); });
  }

  /* ----------------- Fitur Lainnya ----------------- */
  function initImageViewer(){
    const viewer = document.getElementById('image-viewer');
    const viewerImage = document.getElementById('viewer-image');
    const currentIndexEl = document.getElementById('current-index');
    const totalImages = document.getElementById('total-images');
    if (!viewer || !viewerImage) return;

    const imgs = Array.from(document.querySelectorAll('.member-photo-simple')).map(img => ({ src: img.src, alt: img.alt }));
    
    if (totalImages) totalImages.textContent = imgs.length;
    
    let currentViewerIndex = 0;

    document.querySelectorAll('.member-photo-simple').forEach((img, idx) => {
      const newImg = img.cloneNode(true);
      img.parentNode.replaceChild(newImg, img);
      
      newImg.addEventListener('click', () => {
          currentViewerIndex = idx; 
          viewer.classList.add('active');
          viewerImage.src = imgs[currentViewerIndex].src;
          viewerImage.alt = imgs[currentViewerIndex].alt;
          if (currentIndexEl) currentIndexEl.textContent = currentViewerIndex + 1;
          document.body.style.overflow = 'hidden'; // Matiin scroll
      });
    });

    const closeBtn = document.querySelector('.close-viewer');
    if (closeBtn) closeBtn.addEventListener('click', () => { viewer.classList.remove('active'); document.body.style.overflow = ''; });
    viewer.addEventListener('click', (e) => { if (e.target === viewer) { viewer.classList.remove('active'); document.body.style.overflow = ''; } });

    const prevBtn = document.querySelector('.viewer-prev');
    const nextBtn = document.querySelector('.viewer-next');
    
    function updateViewer(i){ 
        currentViewerIndex = (i + imgs.length) % imgs.length; 
        viewerImage.src = imgs[currentViewerIndex].src; 
        viewerImage.alt = imgs[currentViewerIndex].alt; 
        if (currentIndexEl) currentIndexEl.textContent = currentViewerIndex + 1; 
    }
    
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); updateViewer(currentViewerIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); updateViewer(currentViewerIndex + 1); });
    document.addEventListener('keydown', (e) => { if (viewer.classList.contains('active')){ if (e.key==='Escape') viewer.classList.remove('active'); if (e.key==='ArrowLeft') updateViewer(currentViewerIndex - 1); if (e.key==='ArrowRight') updateViewer(currentViewerIndex + 1); }});
  }

  function initDynamicTeamLoader() {
    const scrollContainer = document.querySelector('.team-member-scroll');
    
    if (!scrollContainer) {
      console.warn('Waduh, container tim gak ketemu. Gak jadi load tim.');
      return;
    }
    
    scrollContainer.innerHTML = '';
    
    let photoCount = 0; 

    // Rekursif buat load gambar satu-satu
    function checkAndAddImage(index) {
      const imgPath = `images/team${index}.jpg`;
      const img = new Image(); 

      img.onload = function() {
        photoCount++; 
        
        const cardHTML = `
          <div class="member-card-simple">
            <div class="member-photo-container">
              <img src="${imgPath}" alt="Sperta Squad Member ${index}" class="member-photo-simple" data-index="${index - 1}">
            </div>
          </div>
        `;
        
        scrollContainer.insertAdjacentHTML('beforeend', cardHTML);
        checkAndAddImage(index + 1);
      };
      
      img.onerror = function() {
        console.log(`Selesai load tim. Ketemu ${photoCount} orang.`);
        initImageViewer(); 
      };
      
      img.src = imgPath;
    }
    
    checkAndAddImage(1);
  }
  
  
  // =========================================================================
  // === LOGIC FITUR ANONIM & ADMIN (Hati-hati edit sini) ===
  // =========================================================================
  function initAnonymousFeature() {
    // Cek dulu, firebase udah keload apa belom
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.auth === 'undefined') {
      console.error('Firebase SDK gak ketemu bos. Fitur anonim mati.');
      const listElement = document.getElementById('anon-messages-list');
      if(listElement) listElement.innerHTML = '<div class="anon-message-loading">Gagal load Firebase.</div>';
      return;
    }
    
    // Cek config.js
    if (typeof firebaseConfig === 'undefined') {
        console.error('Config.js ilang atau variabelnya gak ada.');
        const listElement = document.getElementById('anon-messages-list');
        if(listElement) listElement.innerHTML = '<div class="anon-message-loading">Error Konfigurasi.</div>';
        return;
    }
    
    try {
      // Inisialisasi Firebase pake config dari file sebelah
      if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
      }
      
      const db = firebase.firestore();
      const auth = firebase.auth(); 
      const messagesCollection = db.collection('pesan_anonim');

      // Ambil elemen DOM
      const messageInput = document.getElementById('anon-message-input');
      const submitButton = document.getElementById('anon-submit-btn');
      const charCounter = document.getElementById('anon-char-counter');
      const messagesList = document.getElementById('anon-messages-list');
      const loginBtn = document.getElementById('admin-login-btn');
      const logoutBtn = document.getElementById('admin-logout-btn');
      
      if (!messageInput || !submitButton || !charCounter || !messagesList || !loginBtn || !logoutBtn) {
          console.error("Ada elemen HTML yang ilang nih buat fitur anonim.");
          return;
      }

      // === LOGIKA LOGIN ADMIN ===
      let isAdmin = false; 
      const provider = new firebase.auth.GoogleAuthProvider();

      loginBtn.addEventListener('click', () => {
          auth.signInWithPopup(provider).catch(error => {
              console.error("Gagal login:", error);
              alert("Gagal login. Coba lagi deh.");
          });
      });

      logoutBtn.addEventListener('click', () => {
          auth.signOut();
      });

      auth.onAuthStateChanged(user => {
          if (user) {
              console.log("Admin masuk:", user.uid);
              isAdmin = true;
              loginBtn.style.display = 'none'; 
              logoutBtn.style.display = 'block'; 
          } else {
              console.log("Admin keluar.");
              isAdmin = false;
              loginBtn.style.display = 'block'; 
              logoutBtn.style.display = 'none'; 
          }
          loadMessages();
      });
      // === SELESAI LOGIKA LOGIN ===


      // --- Fitur 1: Hitung Karakter ---
      messageInput.addEventListener('input', () => {
        const length = messageInput.value.length;
        const maxLength = messageInput.maxLength;
        charCounter.textContent = `${length} / ${maxLength}`;
        
        if (length >= maxLength) {
          charCounter.classList.add('limit-reached');
        } else {
          charCounter.classList.remove('limit-reached');
        }
      });

      // --- Fitur 2: Kirim Pesan ---
      submitButton.addEventListener('click', async () => {
        const messageText = messageInput.value.trim();
        if (messageText.length < 5) { alert('Pendek banget bang, minimal 5 huruf lah.'); return; }
        if (messageText.length > 500) { alert('Kepanjangan, max 500 huruf aja.'); return; }

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
          console.error("Gagal kirim:", error);
          alert('Yah gagal kirim. Coba nanti lagi.');
        } finally {
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Kirim';
        }
      });

      // --- Fitur 3: Tampilin Pesan ---
      let messagesListener = null;
      
      function loadMessages() {
          if (messagesListener) messagesListener(); 
          
          messagesListener = messagesCollection.orderBy('timestamp', 'desc').limit(50)
            .onSnapshot(snapshot => {
              messagesList.innerHTML = '';
              
              if (snapshot.empty) {
                messagesList.innerHTML = '<div class="anon-message-loading">Masih sepi nih. Jadilah yang pertama!</div>';
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
                }) : 'Barusan';
                
                const safeText = data.text
                                    .replace(/</g, "&lt;")
                                    .replace(/>/g, "&gt;");

                // Tombol hapus cuma nongol kalo Admin
                const adminButtonHTML = isAdmin 
                  ? `<button class="admin-delete-btn" data-id="${messageId}" title="Hapus pesan ini">
                       <i class="fa-solid fa-trash-can"></i>
                     </button>`
                  : '';

                messageCard.innerHTML = `
                  ${adminButtonHTML}
                  <p>${safeText}</p>
                  <span>${date}</span>
                `;
                
                messagesList.appendChild(messageCard);
              });
              
            }, error => {
                console.error("Gagal ambil data:", error);
                messagesList.innerHTML = '<div class="anon-message-loading">Gagal memuat pesan.</div>';
            });
      }
      
      // === FITUR HAPUS PESAN ===
      messagesList.addEventListener('click', async (e) => {
          const deleteButton = e.target.closest('.admin-delete-btn');
          
          if (deleteButton && isAdmin) {
              const messageId = deleteButton.dataset.id; 
              
              if (confirm('Yakin mau hapus pesan ini? Gak bisa dibalikin loh.')) {
                  try {
                      await messagesCollection.doc(messageId).delete();
                      console.log("Pesan dihapus:", messageId);
                  } catch (error) {
                      console.error("Gagal hapus:", error);
                      alert('Gagal hapus. Cek Rules Firebase lu.');
                  }
              }
          }
      });
      // === SELESAI FITUR HAPUS ===

    } catch (e) {
        console.error("Error inisialisasi:", e);
        const listElement = document.getElementById('anon-messages-list');
        if(listElement) listElement.innerHTML = '<div class="anon-message-loading">Error config Firebase.</div>';
    }
  }
  // ===== BATAS FUNGSI ANONIM/ADMIN =====


  function initVideoPopup(){
    const videoPopup = document.getElementById('video-popup');
    const popupVideo = document.getElementById('popup-video');
    const aboutVideo = document.querySelector('.about-video');

    function open(){
      if (!aboutVideo || !popupVideo || !videoPopup) return;
      const src = aboutVideo.querySelector('source') ? aboutVideo.querySelector('source').src : null;
      if (!src) return;
      popupVideo.innerHTML = '';
      const s = document.createElement('source');
      s.src = src; s.type = 'video/mp4';
      popupVideo.appendChild(s);
      popupVideo.load();
      videoPopup.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(()=> {
        popupVideo.play().catch(e => console.warn('Autoplay popup diblok:', e));
      }, 200);
    }
    function close(){
      if (popupVideo) { popupVideo.pause(); popupVideo.currentTime = 0; }
      if (videoPopup) { videoPopup.classList.remove('active'); }
      document.body.style.overflow = '';
      if (aboutVideo && aboutVideo.paused) aboutVideo.play().catch(()=>{});
    }

    const overlay = document.querySelector('.video-overlay');
    if (overlay) overlay.addEventListener('click', open);
    const closeBtn = document.querySelector('.close-video-popup');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (videoPopup) videoPopup.addEventListener('click', (e)=>{ if (e.target === videoPopup) close(); });
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && videoPopup && videoPopup.classList.contains('active')) close();});
  }

  function initNavAndBackToTop(){
    const navLinks = document.querySelectorAll('.ul-list li a');
    const sections = document.querySelectorAll('section');

    function removeActive(){ navLinks.forEach(link => link.parentElement.classList.remove('active')); }

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('href').substring(1);
        const sec = document.getElementById(id);
        if (!sec) return;
        window.scrollTo({ top: sec.offsetTop - 80, behavior: 'smooth' });
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

    // logic back to top
    let backToTop = document.getElementById('back-to-top');
    if (!backToTop) {
      backToTop = document.createElement('div');
      backToTop.id = 'back-to-top';
      backToTop.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
      document.body.appendChild(backToTop);
      backToTop.style.cssText = 'position:fixed;bottom:80px;right:20px;background:#474af0;color:#fff;width:50px;height:50px;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;z-index:1000;transition:transform .3s;';
      backToTop.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
    }
    window.addEventListener('scroll', ()=> { backToTop.style.display = window.scrollY > 500 ? 'flex' : 'none'; });
  }

  function initRevealObserver(){
    const revealElements = document.querySelectorAll('.reveal');
    const observerOptions = { threshold:0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active-reveal'); });
    }, observerOptions);
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  function initTeamScroll(){
    const teamScrollWrapper = document.querySelector('.team-scroll-wrapper');
    if (teamScrollWrapper) {
      teamScrollWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        teamScrollWrapper.scrollLeft += e.deltaY;
      });
    }
  }

  /* ----------------- GANTI TEMA (Matahari / Bulan) ----------------- */
  
  // Helper: Ganti ikon sesuai mode
  function updateThemeIcon(isDark) {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) return;

    // Kalo gelap -> Bulan
    // Kalo terang -> Matahari
    if (isDark) {
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>'; 
    } else {
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  }

  function initThemeToggle(){
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (!themeToggle) {
      const btn = document.createElement('button');
      btn.className = 'theme-toggle';
      // Icon default
      btn.innerHTML = '<i class="fas fa-sun"></i>'; 
      document.body.appendChild(btn);
      btn.addEventListener('click', toggleTheme);
    } else {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Cek settingan user sebelumnya
    const saved = localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Set mode awal
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
      updateThemeIcon(true);
    } else {
      document.body.classList.remove('dark-mode');
      updateThemeIcon(false);
    }
  }

  function toggleTheme(){
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
  }

  /* ----------------- Animasi Loading & Typing ----------------- */
  function initLoadingAndTyping(){
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    const mainIcon = document.querySelector('.custom-logo');
    const subIcons = document.querySelectorAll('.sub-icons i');
    const designerText = document.getElementById('designer-text');
    const mainPage = document.getElementById('main-page');

    function showElement(el, delay = 0){
      if (!el) return;
      setTimeout(() => {
        el.classList.remove('hidden'); 
        el.classList.add('fall');
      }, delay);
    }

    function hideLoadingSequence(){
      setTimeout(() => {
        if (loadingScreen) {
          loadingScreen.style.transition = 'opacity 0.45s ease';
          loadingScreen.style.opacity = '0';
        }
        setTimeout(()=>{
          if (loadingScreen) loadingScreen.style.display = 'none';
          if (mainPage) mainPage.classList.add('visible');
          document.body.style.overflow = '';
        }, 500);
      }, 350); 
    }

    function startSequenceThenHide(){
      showElement(mainIcon, 0);
      showElement(loadingText, 650);
      subIcons.forEach((icon, idx) => showElement(icon, 1200 + idx * 350));
      showElement(designerText, 2200);
      setTimeout(hideLoadingSequence, 3200);
    }

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
      let didRun = false;
      const runOnce = () => {
        if (didRun) return;
        didRun = true;
        startSequenceThenHide();
      };
      window.addEventListener('load', () => runOnce());
      setTimeout(() => runOnce(), 6500); // Timeout jaga-jaga
    }

    // Efek ngetik sendiri
    const typingElement = document.querySelector('.info-home h3');
    if (typingElement) {
      const words = ["Computer Engineering Students", "Web Development Learners", "Politeknik Negeri Manado", "Sperta Squad"];
      let wordIndex = 0, charIndex = 0, isDeleting = false;
      function type(){
        const currentWord = words[wordIndex];
        let displayed = currentWord.substring(0,charIndex);
        typingElement.innerHTML = displayed + '<span class="cursor">|</span>';
        if (!isDeleting && charIndex < currentWord.length) { charIndex++; setTimeout(type, 100); }
        else if (isDeleting && charIndex > 0) { charIndex--; setTimeout(type, 50); }
        else { isDeleting = !isDeleting; if (!isDeleting) wordIndex = (wordIndex+1)%words.length; setTimeout(type, 800); }
      }
      setTimeout(() => { try{ type(); } catch(e){} }, 800);
    }
  }

  /* ----------------- SIHIR NATAL (POPUP & EFEK) ----------------- */
  function initChristmasMagic() {
    const container = document.getElementById('christmas-container');
    if (!container) return;

    // 1. Buat Salju
    const snowCount = 50;
    const snowChars = ['❄', '❅', '❆', '•'];
    for (let i = 0; i < snowCount; i++) {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        snowflake.textContent = snowChars[Math.floor(Math.random() * snowChars.length)];
        snowflake.style.left = Math.random() * 100 + 'vw';
        snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
        snowflake.style.opacity = Math.random();
        snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
        container.appendChild(snowflake);
    }

    // 2. Buat Bintang
    const starCount = 12;
    function relocateAndTwinkle(star) {
        const duration = Math.random() * 1500 + 1500;
        star.style.left = Math.random() * 100 + 'vw';
        star.style.top = Math.random() * 100 + 'vh';
        star.style.fontSize = Math.random() * 15 + 8 + 'px';
        requestAnimationFrame(() => { star.classList.add('visible'); });
        setTimeout(() => {
            star.classList.remove('visible');
            setTimeout(() => { relocateAndTwinkle(star); }, 1000);
        }, duration);
    }
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('christmas-star');
        star.innerHTML = '<i class="fas fa-star"></i>';
        container.appendChild(star);
        setTimeout(() => { relocateAndTwinkle(star); }, Math.random() * 3000);
    }

    // --- 3. POHON NATAL & LOGIC POPUP ---

    // Buat Widget Pohon
    const tree = document.createElement('div');
    tree.className = 'christmas-tree-widget';
    tree.innerHTML = '<i class="fas fa-tree" style="color:#2ecc71;"></i><i class="fas fa-star" style="color:#f1c40f; position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:15px;"></i>';
    tree.title = "Klik buat liat ucapan!";
    document.body.appendChild(tree);

    // Ambil elemen Popup yang udah dibuat di HTML
    const popupOverlay = document.getElementById('christmas-popup');
    const closePopupBtn = document.getElementById('close-xmas-popup');

    // Buka Popup
    function openChristmasPopup() {
        if (popupOverlay) {
            popupOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Matiin scroll
        }
    }

    // Tutup Popup
    function closeChristmasPopup() {
        if (popupOverlay) {
            popupOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Hidupin scroll lagi
        }
    }

    // Klik Pohon -> Buka Popup
    tree.addEventListener('click', (e) => {
        e.stopPropagation(); 
        openChristmasPopup();
    });

    // Klik Tombol X -> Tutup
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', closeChristmasPopup);
    }

    // Klik di luar kotak (di background gelap) -> Tutup
    if (popupOverlay) {
        popupOverlay.addEventListener('click', (e) => {
            if (e.target === popupOverlay) {
                closeChristmasPopup();
            }
        });
    }
  }

  /* ----------------- Initialization (Mulai Semua) ----------------- */
  function init(){
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
    
    initChristmasMagic(); // Load efek natal

    // Pancing audio biar bisa play di beberapa browser
    document.addEventListener('click', function first() {
      if (audio && audio.src && !isPlaying) {
        audio.play().then(()=> audio.pause()).catch(e => console.warn('Audio priming failed:', e));
      }
      document.removeEventListener('click', first);
    }, { once: true, capture: true });
  }

  return { init };
})();

// Variabel global buatjagajaga
let userData = null;
let currentLyricIndex = -1;
let songDuration = 60;