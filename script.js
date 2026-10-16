/* NexusStream. HTML5 Video API, без внешних библиотек. */
'use strict';

const PlayerTools = (() => {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    function time(value) {
        if (!Number.isFinite(value) || value < 0) return '0:00';
        const n = Math.floor(value), h = Math.floor(n / 3600);
        return (h ? h + ':' : '') + String(Math.floor(n / 60) % 60).padStart(h ? 2 : 1, '0') + ':' + String(n % 60).padStart(2, '0');
    }
    function stamp(text) {
        if (!/^(?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3}$/.test(text)) return NaN;
        const parts = text.replace(',', '.').split(':').map(Number);
        const seconds = parts.pop(), minutes = parts.pop(), hours = parts.pop() || 0;
        if (seconds >= 60 || minutes >= 60) return NaN;
        return hours * 3600 + minutes * 60 + seconds;
    }
    function plain(text) {
        return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
            .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, key) => ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '})[key]);
    }
    function parseSubtitles(raw) {
        const blocks = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n/);
        const cues = [];
        for (const block of blocks) {
            if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block)) continue;
            const lines = block.split('\n'), index = lines.findIndex(line => line.includes('-->'));
            if (index < 0) continue;
            const match = lines[index].match(/^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
            if (!match) throw new Error('Проверь строку с временем в субтитрах.');
            const start = stamp(match[1]), end = stamp(match[2]);
            const text = plain(lines.slice(index + 1).join('\n').trim());
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) {
                throw new Error('У каждой реплики должны быть текст и время окончания позже начала.');
            }
            cues.push({start, end, text});
        }
        if (!cues.length) throw new Error('Реплики не найдены. Нужен файл WebVTT (.vtt) или SubRip (.srt).');
        return cues.sort((a, b) => a.start - b.start);
    }
    function vtt(cues) {
        const format = seconds => {
            const ms = Math.round(seconds * 1000);
            return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' +
                String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' +
                String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
        };
        const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return 'WEBVTT\n\n' + cues.map((cue, i) => `${i + 1}\n${format(cue.start)} --> ${format(cue.end)}\n${escape(cue.text)}`).join('\n\n') + '\n';
    }
    return {clamp, time, parseSubtitles, vtt};
})();
window.PlayerTools = PlayerTools;

const ICON_PATHS = {
    play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    volume: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a5 5 0 0 1 0 8M18 4a10 10 0 0 1 0 16"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6"/>',
    back: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
    forward: '<path d="M21 10a9 9 0 1 0-1 8m1-14v6h-6"/>',
    cc: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9a3 3 0 1 0 0 6m9-6a3 3 0 1 0 0 6"/>',
    fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    compress: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>',
    theater: '<rect x="2" y="5" width="20" height="14" rx="2"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
    folder: '<path d="M3 8V4h6l2 3h10v13H3z"/><path d="m3 12 3-2h15"/>',
    moon: '<path d="M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    home: '<path d="m2 10 10-8 10 8M5 8v13h14V8M10 21v-7h4v7"/>',
    book: '<path d="M12 5v16M2 3h5l5 2 5-2h5v16h-5l-5 2-5-2H2z"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
    cap: '<path d="m2 8 10-5 10 5-10 5zM6 10v7l6 4 6-4v-7M22 8v9"/>',
    sliders: '<path d="M4 3v18M12 3v18M20 3v18M1 8h6m2 8h6m2-10h6"/>',
    speed: '<path d="M4 19a10 10 0 1 1 16 0M12 12l5-5"/><circle cx="12" cy="12" r="2"/>',
    share: '<path d="m9 8 7 4-7 4"/><circle cx="5" cy="7" r="3"/><circle cx="19" cy="12" r="3"/><circle cx="5" cy="19" r="3"/><path d="m8 8 8 3m-8 6 8-4"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m4 0h1m4 0h1M6 13h1m4 0h1m4 0h1M7 16h10"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>'
};
function icon(name) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
}
function replaceIcons() {
    const names = {'bars':'menu','volume-high':'volume','volume-low':'volume','volume-xmark':'mute','rotate-left':'back','rotate-right':'forward',
        'closed-captioning':'cc','expand':'fullscreen','rectangle-wide':'theater','folder-open':'folder','file-arrow-up':'upload',
        'circle-info':'info','magnifying-glass':'search','house':'home','book-open':'book','graduation-cap':'cap','user-graduate':'cap',
        'gauge-high':'speed','gear':'settings','xmark':'close','microchip':'chip','laptop-code':'code','list-check':'check',
        'clapperboard':'film','bullseye':'info','trophy':'cap'};
    document.querySelectorAll('i[class*="fa-"]').forEach(el => {
        const name = Array.from(el.classList).find(c => c.startsWith('fa-') && c !== 'fa-solid')?.slice(3);
        el.outerHTML = icon(names[name] || name);
    });
}

const PROJECT_VIDEO_PARTS = ["assets/video/00.part", "assets/video/01.part", "assets/video/02.part", "assets/video/03.part", "assets/video/04.part", "assets/video/05.part", "assets/video/06.part", "assets/video/07.part", "assets/video/08.part", "assets/video/09.part", "assets/video/10.part", "assets/video/11.part", "assets/video/12.part", "assets/video/13.part", "assets/video/14.part"];

const PROJECT_SUBTITLES = [{id: 'project-ru', label: 'Русский', lang: 'ru',
    cues: PlayerTools.parseSubtitles("WEBVTT\n\n1\n00:00:12.520 --> 00:00:21.351\nНевидимый код Вселенной.\nМатематика как универсальный язык мироздания: от спиралей раковин до алгоритмов машинного интеллекта.\n\n2\n00:00:22.553 --> 00:00:31.768\nПрирода выбирает идеальные формы.\nГексагональная сетка делит плоскость на равные доли с наименьшим периметром стенок: максимум места при минимуме воска.\n\n3\n00:00:32.620 --> 00:00:41.407\nЗолотое сечение строит красоту.\nЧисло гармонии. Целое к большей части относится так же, как большая часть к меньшей.\n\n4\n00:00:42.653 --> 00:00:51.864\nЦифровой мир держится на математике.\nЛюбой мультимедийный поток, транзакция и поисковый запрос опираются на строгие абстрактные теоремы.\n\n5\n00:00:52.653 --> 00:01:01.433\nНейросети думают матрицами.\nИИ не обладает сознанием: его основа — умножение матриц и градиентный спуск.\n\n6\n00:01:02.653 --> 00:01:11.856\nБудущее открытий за формулами.\nГлубины океана: уравнения Навье — Стокса моделируют климат и течения. Квантовый скачок: комплексные гильбертовы пространства открывают сверхвычисления.\n\n")}];

class VideoPlayerApp {
    constructor() {
        this.$ = id => document.getElementById(id);
        this.video = this.$('main-video');
        this.container = this.$('video-container');
        this.tracks = [];
        this.trackCounter = 0;
        this.selectedTrack = 'off';
        this.previousTrack = 'project-ru';
        this.isLocalVideo = false;
        this.videoUrl = null;
        this.toastTimer = null;
        this.menu = null;
        this.modal = null;
        this.isScrubbing = false;
        this.scrubRatio = 0;
        this.scrubWasPlaying = false;
        this.scrubPointer = null;
        this.pendingSeekTime = null;
        this.mediaRevision = 0;
        this.mediaLoading = false;
        this.projectObjectUrl = null;
        this.store = {
            get(key, fallback) { try { const value = localStorage.getItem('nexus_' + key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
            set(key, value) { try { localStorage.setItem('nexus_' + key, JSON.stringify(value)); } catch { /* Плеер работает и без хранилища. */ } }
        };
        this.init();
    }
    init() {
        replaceIcons();
        this.bind();
        this.setTheme(this.store.get('theme', 'dark'));
        const volume = Number(this.store.get('volume', 0.7));
        this.video.volume = Number.isFinite(volume) ? PlayerTools.clamp(volume, 0, 1) : 0.7;
        this.video.muted = this.store.get('muted', false) === true;
        const speed = Number(this.store.get('speed', 1));
        this.speed = this.validSpeed(speed) ? speed : 1;
        this.setPlaybackSpeed(this.speed, false);
        this.updateVolumeUI();
        this.applySubtitleStyles(this.store.get('sub_settings', {}));
        this.video.controls = false;
        this.showView('welcome');
        this.loadProject();
    }
    bind() {
        const on = (id, event, fn) => this.$(id).addEventListener(event, fn);
        ['play', 'pause', 'ended'].forEach(type => this.video.addEventListener(type, () => {
            const playing = !this.video.paused && !this.video.ended;
            this.$('play-pause-btn').innerHTML = icon(playing ? 'pause' : 'play');
            this.$('play-pause-btn').setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
            this.container.classList.toggle('is-playing', playing);
            this.revealControls();
        }));
        ['timeupdate','durationchange'].forEach(type => this.video.addEventListener(type, () => this.onTimeUpdate()));
        this.video.addEventListener('seeked', () => {
            this.pendingSeekTime = null;
            this.onTimeUpdate();
        });
        this.video.addEventListener('loadedmetadata', () => this.onMetadata());
        this.video.addEventListener('progress', () => this.updateBuffer());
        this.video.addEventListener('volumechange', () => this.updateVolumeUI());
        this.video.addEventListener('ratechange', () => this.updateSpeedUI());
        this.video.addEventListener('waiting', () => this.$('video-loader').classList.add('active'));
        ['playing','canplay','pause','ended','seeked'].forEach(type => this.video.addEventListener(type, () => this.$('video-loader').classList.remove('active')));
        this.video.addEventListener('error', () => {
            this.pendingSeekTime = null;
            this.$('video-loader').classList.remove('active');
            this.$('video-placeholder').classList.remove('hidden');
            this.$('placeholder-title').textContent = 'Видео не удалось открыть';
            this.$('placeholder-text').textContent = 'Выбери другой файл. Для совместимости подойдёт MP4 с видео H.264 и звуком AAC.';
        });
        this.video.addEventListener('click', () => this.togglePlayPause());
        on('play-pause-btn','click', () => this.togglePlayPause());
        on('rewind-btn','click', () => this.skipTime(-5));
        on('forward-btn','click', () => this.skipTime(5));
        on('mute-btn','click', () => {this.video.muted = !this.video.muted; this.updateVolumeUI();});
        on('volume-slider','input', e => {
            this.video.volume = PlayerTools.clamp(Number(e.target.value), 0, 1);
            this.video.muted = false;
            this.updateVolumeUI();
        });
        on('seek-slider','pointerdown', e => this.beginScrub(e));
        on('seek-slider','input', e => {
            const ratio=Number(e.target.value)/1000;
            if(this.isScrubbing){this.scrubRatio=ratio;this.onTimeUpdate();}
            else this.seekRatio(ratio);
        });
        on('seek-slider','change', () => {if(this.isScrubbing)this.finishScrub();});
        document.addEventListener('pointerup', e => {
            if(this.isScrubbing&&e.pointerId===this.scrubPointer)this.finishScrub();
        });
        document.addEventListener('pointercancel', e => {
            if(this.isScrubbing&&e.pointerId===this.scrubPointer)this.finishScrub(true);
        });
        on('progress-container','pointermove', e => {
            const rect = this.$('progress-container').getBoundingClientRect();
            const ratio = PlayerTools.clamp((e.clientX - rect.left) / rect.width, 0, 1);
            const tooltip = this.$('time-tooltip');
            tooltip.textContent = PlayerTools.time(ratio * this.video.duration);
            tooltip.style.left = (12 + ratio * rect.width) + 'px';
            tooltip.style.opacity = '1';
        });
        on('progress-container','pointerleave', () => this.$('time-tooltip').style.opacity = '0');
        on('subtitles-toggle-btn','click', () => this.toggleDropdown('subtitles-menu'));
        on('speed-toggle-btn','click', () => this.toggleDropdown('speed-menu'));
        on('subtitles-list','click', e => {const li=e.target.closest('[data-track]'); if(li) this.setSubtitleLanguage(li.dataset.track);});
        this.$('speed-menu').querySelectorAll('[data-speed]').forEach(li => li.addEventListener('click', () => this.setPlaybackSpeed(Number(li.dataset.speed))));
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); e.target.click();}
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault(); const items=Array.from(menu.querySelectorAll('li'));
                const n=items.indexOf(document.activeElement), step=e.key === 'ArrowDown' ? 1 : -1;
                items[(n+step+items.length)%items.length]?.focus();
            }
        }));
        ['local-video-upload','local-video-upload-toolbar','header-video-upload'].forEach(id => on(id,'change', e => this.handleLocalVideo(e)));
        on('custom-vtt-upload','change', e => this.handleCustomSubtitles(e));
        on('project-btn','click', () => this.loadProject());
        on('fullscreen-btn','click', () => this.toggleFullscreen());
        document.addEventListener('fullscreenchange', () => this.$('fullscreen-btn').innerHTML = icon(document.fullscreenElement ? 'compress':'fullscreen'));
        on('theater-btn','click', () => this.toggleTheater());
        on('theme-toggle','click', () => this.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light':'dark'));
        document.querySelectorAll('[data-view]').forEach(tab => {
            tab.addEventListener('click', () => this.showView(tab.dataset.view));
            tab.addEventListener('keydown', e => {
                const views=['welcome','player'];
                let index=views.indexOf(tab.dataset.view);
                if(e.key==='ArrowRight')index=(index+1)%views.length;
                else if(e.key==='ArrowLeft')index=(index+views.length-1)%views.length;
                else if(e.key==='Home')index=0;
                else if(e.key==='End')index=views.length-1;
                else return;
                e.preventDefault();this.showView(views[index]);this.$(views[index]+'-tab').focus();
            });
        });
        on('sub-settings-open','click', () => {this.closeMenus(); this.openModal('subtitle-settings-modal');});
        on('save-sub-settings','click', () => {
            const settings = {size:this.$('sub-size-select').value, color:this.$('sub-color-picker').value, bgColor:this.$('sub-bg-color').value, opacity:Number(this.$('sub-bg-opacity').value)};
            this.applySubtitleStyles(settings); this.store.set('sub_settings', settings); this.closeModal(); this.showToast('Оформление субтитров сохранено');
        });
        document.querySelectorAll('.close-modal-btn').forEach(button => button.addEventListener('click', () => this.closeModal()));
        document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', e => {if(e.target === modal) this.closeModal();}));
        on('download-subs-btn','click', () => this.downloadSubtitles());
        document.querySelectorAll('label[role="button"]').forEach(label => label.addEventListener('keydown', e => {
            if(e.key==='Enter'||e.key===' '){e.preventDefault();this.$(label.htmlFor).click();}
        }));
        document.addEventListener('click', e => {if(!e.target.closest('.dropdown')) this.closeMenus();});
        document.addEventListener('keydown', e => this.handleKeyboard(e));
        ['pointermove','pointerdown','focusin'].forEach(type => this.container.addEventListener(type, () => this.revealControls()));
        window.addEventListener('beforeunload', () => {
            if(this.videoUrl)URL.revokeObjectURL(this.videoUrl);
            if(this.projectObjectUrl)URL.revokeObjectURL(this.projectObjectUrl);
        });
    }
    onMetadata() {
        this.$('video-placeholder').classList.add('hidden');
        this.$('video-loader').classList.remove('active');
        this.video.playbackRate = this.speed;
        this.onTimeUpdate();
    }
    async togglePlayPause() {
        if(this.mediaLoading){
            const revision=this.mediaRevision;
            await this.mediaReady;
            if(revision!==this.mediaRevision||this.activeView!=='player')return;
        }
        if (!this.video.paused) {this.video.pause(); return;}
        if (this.video.ended) this.video.currentTime = 0;
        await this.playSafely();
    }
    async playSafely() {
        try {await this.video.play();} catch(error) {
            if (error.name !== 'AbortError') this.showToast('Не удалось начать воспроизведение. Попробуй выбрать другое видео.');
        }
    }
    beginScrub(e) {
        if(this.isScrubbing||this.mediaLoading||!Number.isFinite(this.video.duration)||this.video.duration<=0||e.button>0)return;
        this.isScrubbing=true;
        this.scrubRatio=Number(this.$('seek-slider').value)/1000;
        this.scrubPointer=e.pointerId;
        this.scrubWasPlaying=!this.video.paused;
        if(this.scrubWasPlaying)this.video.pause();
    }
    finishScrub(cancel=false) {
        if(!this.isScrubbing)return;
        const ratio=this.scrubRatio,resume=this.scrubWasPlaying;
        this.isScrubbing=false;this.scrubWasPlaying=false;this.scrubPointer=null;
        if(!cancel)this.seekRatio(ratio);
        else this.onTimeUpdate();
        if(resume&&this.activeView==='player')this.playSafely();
    }
    seekRatio(ratio) {
        if(!Number.isFinite(ratio))return;
        this.seekTo(PlayerTools.clamp(ratio,0,1)*this.video.duration);
    }
    skipTime(seconds) {
        this.seekTo((this.pendingSeekTime??this.video.currentTime)+seconds);
    }
    seekTo(seconds) {
        if(this.mediaLoading||!Number.isFinite(this.video.duration)||this.video.duration<=0||!Number.isFinite(seconds))return;
        const target=PlayerTools.clamp(seconds,0,this.video.duration);
        // Во время асинхронной перемотки currentTime может ещё содержать старое значение.
        // До seeked показываем выбранное время, а не перезаписываем ползунок старым кадром.
        this.pendingSeekTime=Math.abs(this.video.currentTime-target)>0.001?target:null;
        try{this.video.currentTime=target;}
        catch{this.pendingSeekTime=null;this.showToast('Этот файл пока не готов к перемотке.');}
        this.onTimeUpdate();
    }
    onTimeUpdate() {
        const duration = this.video.duration;
        const current=this.isScrubbing?this.scrubRatio*duration:(this.pendingSeekTime??this.video.currentTime);
        const fraction = Number.isFinite(duration) && duration > 0 ? PlayerTools.clamp(current / duration, 0, 1):0;
        this.$('current-time').textContent = PlayerTools.time(current);
        this.$('duration').textContent = PlayerTools.time(duration);
        this.$('progress-bar').style.width = (fraction * 100) + '%';
        if(!this.isScrubbing)this.$('seek-slider').value = String(Math.round(fraction * 1000));
        this.$('seek-slider').disabled = this.mediaLoading || !Number.isFinite(duration) || duration <= 0;
        this.$('seek-slider').setAttribute('aria-valuetext', `${PlayerTools.time(current)} из ${PlayerTools.time(duration)}`);
        this.renderSubtitles();
    }
    updateBuffer() {
        const v=this.video;
        const fraction = v.buffered.length && Number.isFinite(v.duration) && v.duration > 0 ? v.buffered.end(v.buffered.length-1)/v.duration : 0;
        this.$('buffered-bar').style.width = (PlayerTools.clamp(fraction,0,1)*100)+'%';
    }
    updateVolumeUI() {
        const effective=this.video.muted ? 0:this.video.volume;
        this.$('volume-slider').value=String(effective);
        this.$('volume-pct').textContent=Math.round(effective*100)+'%';
        this.$('mute-btn').innerHTML=icon(effective ? 'volume':'mute');
        this.$('mute-btn').setAttribute('aria-label', this.video.muted ? 'Включить звук':'Выключить звук');
        this.$('mute-btn').setAttribute('aria-pressed', String(this.video.muted));
        this.store.set('volume',this.video.volume); this.store.set('muted',this.video.muted);
    }
    validSpeed(speed) {return [0.25,0.5,0.75,1,1.25,1.5,1.75,2].includes(speed);}
    setPlaybackSpeed(speed, notify=true) {
        if (!this.validSpeed(speed)) return;
        this.speed=speed; this.video.playbackRate=speed;
        this.updateSpeedUI(); this.store.set('speed',speed); this.closeMenus();
        if(notify) this.showToast('Скорость: '+speed+'×');
    }
    updateSpeedUI() {
        this.$('speed-toggle-btn').textContent=this.video.playbackRate+'×';
        this.$('speed-menu').querySelectorAll('[data-speed]').forEach(li => {
            const active=Number(li.dataset.speed)===this.video.playbackRate;
            li.classList.toggle('active',active);li.setAttribute('aria-checked',String(active));
        });
    }
    clearTracks() {
        this.tracks.forEach(item => {item.track.mode='disabled'; Array.from(item.track.cues || []).forEach(cue => item.track.removeCue(cue));});
        this.tracks=[]; this.selectedTrack='off';this.previousTrack=null;
        this.$('custom-subtitle-overlay').replaceChildren(); this.renderTrackList();
    }
    addTrack(item) {
        const track=this.video.addTextTrack('subtitles',item.label,item.lang);
        track.mode='hidden';
        item.cues.forEach(cue => track.addCue(new VTTCue(cue.start,cue.end,cue.text)));
        track.mode='disabled';
        const entry={...item,track};this.tracks.push(entry);
        track.addEventListener('cuechange', () => {if(this.selectedTrack===entry.id) this.renderSubtitles();});
        this.renderTrackList();return entry;
    }
    addProjectTracks() {
        PROJECT_SUBTITLES.forEach(item => this.addTrack(item));
        this.setSubtitleLanguage('project-ru',false);
    }
    renderTrackList() {
        const list=this.$('subtitles-list');list.replaceChildren();
        [{id:'off',label:'Выключены'},...this.tracks].forEach(item => {
            const li=document.createElement('li');li.dataset.track=item.id;li.textContent=item.label;
            li.tabIndex=0;li.setAttribute('role','menuitemradio');
            li.classList.toggle('active',item.id===this.selectedTrack);
            li.setAttribute('aria-checked',String(item.id===this.selectedTrack));list.appendChild(li);
        });
    }
    setSubtitleLanguage(id,notify=true) {
        if(id!=='off'&&!this.tracks.some(item=>item.id===id)) return;
        this.selectedTrack=id;if(id!=='off') this.previousTrack=id;
        this.tracks.forEach(item=>item.track.mode=item.id===id?'hidden':'disabled');
        this.renderTrackList();this.renderSubtitles();
        this.$('subtitles-toggle-btn').classList.toggle('selected',id!=='off');
        this.$('subtitles-toggle-btn').setAttribute('aria-label',id==='off'?'Выбрать субтитры':'Субтитры включены. Выбрать язык');
        this.closeMenus();
        if(notify) this.showToast(id==='off'?'Субтитры выключены':'Субтитры: '+this.tracks.find(item=>item.id===id).label);
    }
    renderSubtitles() {
        // TextTrack остаётся hidden: рисуем один слой, без дублирования встроенным плеером.
        const overlay=this.$('custom-subtitle-overlay');overlay.replaceChildren();
        const entry=this.tracks.find(item=>item.id===this.selectedTrack);
        if(!entry) return;
        const time=this.video.currentTime;
        entry.cues.filter(cue=>time>=cue.start&&time<cue.end).forEach(cue=>{
            const span=document.createElement('span');span.className='subtitle-cue';span.textContent=cue.text;
            const row=document.createElement('div');row.appendChild(span);overlay.appendChild(row);
        });
    }
    async handleCustomSubtitles(e) {
        const file=e.target.files[0];e.target.value='';if(!file) return;
        if(file.size>5*1024*1024){this.showToast('Выбери файл субтитров до 5 МБ.');return;}
        try {
            const cues=PlayerTools.parseSubtitles(await file.text());
            const id='custom-'+(++this.trackCounter);
            this.addTrack({id,label:file.name.replace(/\.(vtt|srt)$/i,''),lang:'und',cues});
            this.setSubtitleLanguage(id,false);this.showToast('Субтитры загружены: '+cues.length+' реплик');
        } catch(error){this.showToast(error.message || 'Не удалось прочитать файл субтитров.');}
    }
    applySubtitleStyles(value) {
        const s=value&&typeof value==='object'?value:{};
        const size=['14px','18px','24px','32px'].includes(s.size)?s.size:'18px';
        const color=/^#[a-f\d]{6}$/i.test(s.color)?s.color:'#ffffff';
        const bgColor=/^#[a-f\d]{6}$/i.test(s.bgColor)?s.bgColor:'#000000';
        const opacity=typeof s.opacity==='number'&&Number.isFinite(s.opacity)?PlayerTools.clamp(s.opacity,0,1):0.7;
        const rgb=[1,3,5].map(index=>parseInt(bgColor.slice(index,index+2),16));
        this.container.style.setProperty('--subtitle-size',size);
        this.container.style.setProperty('--subtitle-color',color);
        this.container.style.setProperty('--subtitle-bg',`rgba(${rgb.join(',')},${opacity})`);
        this.$('sub-size-select').value=size;this.$('sub-color-picker').value=color;
        this.$('sub-bg-color').value=bgColor;this.$('sub-bg-opacity').value=String(opacity);
    }
    handleLocalVideo(e) {
        const file=e.target.files[0];e.target.value='';if(!file) return;
        this.mediaRevision++;this.mediaLoading=false;
        this.isScrubbing=false;this.pendingSeekTime=null;
        this.video.pause();const previous=this.videoUrl;
        this.videoUrl=URL.createObjectURL(file);this.isLocalVideo=true;
        this.clearTracks();this.setSubtitleLanguage('off',false);
        this.video.src=this.videoUrl;this.video.load();
        if(previous) URL.revokeObjectURL(previous);
        this.$('material-status').textContent='Видео с устройства: '+file.name;
        this.$('material-hint').textContent='Видео выбрано для этого просмотра. Добавь соответствующие ему субтитры через CC. Кнопка «Вернуть видео проекта» вернёт опубликованный ролик.';
        this.$('buffered-bar').style.width='0%';this.onTimeUpdate();
        this.showToast('Видео выбрано. Нажми воспроизведение.');
    }
    loadProject() {
        const revision=++this.mediaRevision;
        this.isScrubbing=false;this.pendingSeekTime=null;
        this.video.pause();const previous=this.videoUrl;this.videoUrl=null;this.isLocalVideo=false;
        this.clearTracks();this.addProjectTracks();
        if(previous)URL.revokeObjectURL(previous);
        this.$('material-status').textContent='Математика вокруг нас · 1:12 · с озвучкой';
        this.$('material-hint').textContent='Озвучка начинается с презентации на 0:12. Субтитры можно включить и настроить кнопкой CC.';
        const attach=source=>{
            if(revision!==this.mediaRevision)return;
            this.mediaLoading=false;this.video.src=source;this.video.load();this.onTimeUpdate();
        };
        this.mediaLoading=true;
        // Собираем опубликованный ролик из небольших файлов в один MP4 Blob.
        // Это сохраняет перемотку независимо от поддержки HTTP Range хостингом.
        if(!this.projectSource)this.projectSource=Promise.all(PROJECT_VIDEO_PARTS.map(async path=>{
            const response=await fetch(path,{credentials:'same-origin'});
            if(!response.ok)throw new Error('Video download failed');
            return response.arrayBuffer();
        })).then(parts=>{
            const blob=new Blob(parts,{type:'video/mp4'});
            if(!blob.size)throw new Error('Empty video');
            this.projectObjectUrl=URL.createObjectURL(blob);return this.projectObjectUrl;
        }).catch(error=>{this.projectSource=null;throw error;});
        this.mediaReady=this.projectSource.then(attach).catch(()=>{
            if(revision!==this.mediaRevision)return;
            this.mediaLoading=false;
            this.$('video-placeholder').classList.remove('hidden');
            this.$('placeholder-title').textContent='Видео не удалось загрузить';
            this.$('placeholder-text').textContent='Проверь интернет и нажми «Вернуть видео проекта» или выбери файл с устройства.';
            this.$('video-loader').classList.remove('active');this.onTimeUpdate();
        });
        this.$('buffered-bar').style.width='0%';this.onTimeUpdate();
    }
    setTheme(theme) {
        const value=theme==='light'?'light':'dark';document.documentElement.dataset.theme=value;
        this.$('theme-toggle').innerHTML=icon(value==='dark'?'sun':'moon');this.store.set('theme',value);
    }
    toggleDropdown(id) {
        const opening=this.menu!==id;this.closeMenus();
        if(opening){this.menu=id;this.$(id).classList.add('show');this.container.classList.remove('hide-controls');
            this.$(id==='speed-menu'?'speed-toggle-btn':'subtitles-toggle-btn').setAttribute('aria-expanded','true');
        }
    }
    closeMenus() {
        ['subtitles-menu','speed-menu'].forEach(id=>this.$(id).classList.remove('show'));
        ['subtitles-toggle-btn','speed-toggle-btn'].forEach(id=>this.$(id).setAttribute('aria-expanded','false'));
        this.menu=null;
    }
    revealControls() {
        clearTimeout(this.controlsTimer);this.container.classList.remove('hide-controls');
        this.controlsTimer=setTimeout(()=>{
            if(!this.video.paused&&!this.menu&&!this.container.contains(document.activeElement))this.container.classList.add('hide-controls');
        },3000);
    }
    async toggleFullscreen() {
        try {
            if(document.fullscreenElement)await document.exitFullscreen();
            else if(this.container.requestFullscreen)await this.container.requestFullscreen();
            else this.showToast('В этом браузере полный экран недоступен.');
        }catch{this.showToast('Браузер не разрешил полноэкранный режим.');}
    }
    toggleTheater() {this.container.classList.toggle('theater-mode');document.body.classList.toggle('theater-active',this.container.classList.contains('theater-mode'));}
    showView(view) {
        if(!['welcome','player'].includes(view))return;
        this.activeView=view;this.closeModal();this.closeMenus();
        this.$('greeting-section').hidden=view!=='welcome';
        this.$('player-section').hidden=view!=='player';
        this.$('upload-action').hidden=view!=='player';
        document.querySelectorAll('[data-view]').forEach(tab=>{
            const active=tab.dataset.view===view;
            tab.classList.toggle('active',active);
            tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
        });
        if(view==='welcome'){
            this.isScrubbing=false;this.scrubWasPlaying=false;
            this.video.pause();this.container.classList.remove('theater-mode');
            document.body.classList.remove('theater-active');
        }
    }
    openModal(id) {
        this.closeMenus();if(this.modal)this.closeModal();
        this.modal=this.$(id);this.preModalFocus=document.activeElement;
        if(document.fullscreenElement===this.container)this.container.appendChild(this.modal);
        this.modal.classList.add('show');this.modal.setAttribute('aria-hidden','false');
        this.modal.querySelector('button,input,select,textarea')?.focus();
    }
    closeModal() {
        if(!this.modal)return;this.modal.classList.remove('show');this.modal.setAttribute('aria-hidden','true');
        if(this.modal.parentNode===this.container)document.body.appendChild(this.modal);
        this.modal=null;this.preModalFocus?.focus();
    }
    handleKeyboard(e) {
        if(e.key==='Escape') {this.closeModal();this.closeMenus();return;}
        if(this.modal){
            if(e.key==='Tab'){
                const items=Array.from(this.modal.querySelectorAll('button,input,select,textarea,a[href]')).filter(item=>!item.disabled);
                const first=items[0],last=items[items.length-1];
                if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
                else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
            }return;
        }
        if(this.activeView!=='player'||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
        const target=e.target;
        if(target?.closest('input,textarea,select,button,a,[contenteditable="true"],[role="menuitemradio"]'))return;
        const key=e.key.toLowerCase();
        const actions={
            ' ':()=>this.togglePlayPause(),k:()=>this.togglePlayPause(),f:()=>this.toggleFullscreen(),t:()=>this.toggleTheater(),
            m:()=>{this.video.muted=!this.video.muted;this.updateVolumeUI();},
            arrowleft:()=>this.skipTime(-5),arrowright:()=>this.skipTime(5),j:()=>this.skipTime(-10),l:()=>this.skipTime(10),
            arrowup:()=>{this.video.volume=PlayerTools.clamp(this.video.volume+0.1,0,1);this.video.muted=false;this.updateVolumeUI();},
            arrowdown:()=>{this.video.volume=PlayerTools.clamp(this.video.volume-0.1,0,1);this.video.muted=false;this.updateVolumeUI();},
            c:()=>{if(!this.tracks.length){this.toggleDropdown('subtitles-menu');return;}this.setSubtitleLanguage(this.selectedTrack==='off'?(this.previousTrack||this.tracks[0].id):'off');}
        };
        if(actions[key]){e.preventDefault();actions[key]();this.revealControls();}
    }
    downloadSubtitles() {
        const item=this.tracks.find(track=>track.id===this.selectedTrack)||this.tracks[0];
        if(!item){this.showToast('Сначала загрузи субтитры.');return;}
        const url=URL.createObjectURL(new Blob([PlayerTools.vtt(item.cues)],{type:'text/vtt;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download='subtitles.vtt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    showToast(message) {
        clearTimeout(this.toastTimer);const toast=this.$('toast');toast.textContent=message;toast.classList.add('show');
        this.toastTimer=setTimeout(()=>toast.classList.remove('show'),4500);
    }
}
window.VideoPlayerApp=VideoPlayerApp;
document.addEventListener('DOMContentLoaded',()=>{window.app=new VideoPlayerApp();});
