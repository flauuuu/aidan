let player; // YouTube player instance
let iframe; // Reference to the iframe element
let youtubeAudioPlayer; // YouTube player instance for the song loader

// --- QUEUE STATE ---
let videoQueue = [];
let songQueue = [];
let currentVideoQueueIndex = -1;
let currentSongQueueIndex = -1;
let isPlayingVideo = false;
let isPlayingSong = false;
let currentModal = null; // 'video' or 'song'

// This function creates an <iframe> (and YouTube player)
// after the API code downloads.
window.onYouTubeIframeAPIReady = function() {
    // This function will be called when a user wants to load a new video.
    // We don't create a player here initially.
}

function loadYouTubeVideo(videoId) {
    if (player) {
        player.loadVideoById(videoId);
    } else {
        const playerContainer = document.getElementById('player-container');
        playerContainer.innerHTML = ''; // Clear previous content (video tag)
        const playerDiv = document.createElement('div');
        playerDiv.id = 'youtube-player';
        playerContainer.appendChild(playerDiv);

        player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'autoplay': 1,
            },
            events: {
                'onReady': (event) => {
                    iframe = document.getElementById('youtube-player');
                },
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED) {
        playNextVideo();
    }
}

function onAudioPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED) {
        playNextSong();
    }
}

function loadYouTubeAudio(videoId) {
    const audioPlayerWrapper = document.getElementById('audio-player-wrapper');
    const playerDivId = 'youtube-audio-player';

    // Ensure the container is ready
    if (!document.getElementById(playerDivId)) {
        audioPlayerWrapper.innerHTML = `<div id="${playerDivId}"></div>`;
    }

    if (youtubeAudioPlayer && typeof youtubeAudioPlayer.loadVideoById === 'function') {
        youtubeAudioPlayer.loadVideoById(videoId);
    } else {
        youtubeAudioPlayer = new YT.Player(playerDivId, {
            height: '0', // Hidden player
            width: '0',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'autoplay': 1,
            },
            events: {
                'onReady': (event) => {
                    event.target.playVideo();
                },
                'onStateChange': onAudioPlayerStateChange
            }
        });
    }
     // Show a placeholder to let user know something is playing
    if (!document.querySelector('#audio-player-wrapper .audio-placeholder')) {
        audioPlayerWrapper.innerHTML += '<p class="audio-placeholder">Playing from YouTube...</p>';
    }
}

async function loadSoundCloudOrSpotify(url) {
    const audioPlayerWrapper = document.getElementById('audio-player-wrapper');
    let embedUrl;

    if (url.includes('soundcloud.com')) {
        embedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}&auto_play=true`;
    } else if (url.includes('spotify.com')) {
        embedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    } else if (url.includes('suno.com') || url.includes('suno.ai')) {
        // Suno embed - use iframe approach since they don't have oEmbed
        audioPlayerWrapper.innerHTML = `
            <iframe 
                src="${url}" 
                width="100%" 
                height="152" 
                frameborder="0" 
                allow="autoplay; encrypted-media" 
                allowfullscreen>
            </iframe>
            <p class="audio-placeholder">Playing from Suno...</p>
        `;
        return;
    } else {
        return; // Should not happen if called correctly
    }

    try {
        const response = await fetch(embedUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch from ${url}`);
        }
        const data = await response.json();
        if (data.html) {
             // Spotify's oEmbed doesn't have an autoplay parameter, so we add it manually
            if (url.includes('spotify.com')) {
                data.html = data.html.replace('encrypted-media', 'encrypted-media; autoplay');
            }
            audioPlayerWrapper.innerHTML = data.html;
            // NOTE: Autoplay to next song is not supported for SoundCloud/Spotify embeds
        } else {
            throw new Error('Could not get embed code.');
        }
    } catch (error) {
        console.error('Error loading track:', error);
        audioPlayerWrapper.innerHTML = '<p class="error-message">Could not load this track. Please check the URL.</p>';
        alert('Could not load this track. Please check the URL.');
    }
}

function loadLocalVideo(file) {
    if (player) {
        player.destroy();
        player = null;
        iframe = null;
    }
    
    const playerContainer = document.getElementById('player-container');
    playerContainer.innerHTML = `
        <video id="video-player" controls>
            Your browser does not support the video tag.
        </video>
    `;

    const videoPlayer = document.getElementById('video-player');
    videoPlayer.addEventListener('ended', playNextVideo); // Autoplay next
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayer.play();
}

function loadLocalAudio(file) {
    const audioPlayerWrapper = document.getElementById('audio-player-wrapper');
    const audioURL = URL.createObjectURL(file);
    audioPlayerWrapper.innerHTML = `
        <audio id="local-audio-player" controls autoplay>
            <source src="${audioURL}" type="${file.type}">
            Your browser does not support the audio element.
        </audio>
    `;
    document.getElementById('local-audio-player').addEventListener('ended', playNextSong);
}

function getYouTubeVideoId(url) {
    let ID = '';
    url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    if (url[2] !== undefined) {
        ID = url[2].split(/[^0-9a-z_\-]/i);
        ID = ID[0];
    } else {
        ID = url;
    }
    return ID;
}

// --- QUEUE PLAYER LOGIC ---
function playNextVideo() {
    currentVideoQueueIndex++;
    if (currentVideoQueueIndex < videoQueue.length) {
        const item = videoQueue[currentVideoQueueIndex];
        isPlayingVideo = true;
        if (item.type === 'youtube') {
            loadYouTubeVideo(item.id);
        } else if (item.type === 'local') {
            loadLocalVideo(item.file);
        }
        updateQueueModal();
    } else {
        isPlayingVideo = false;
        currentVideoQueueIndex = -1; // Reset queue
        console.log("Video queue finished.");
    }
}

function playNextSong() {
    currentSongQueueIndex++;
    if (currentSongQueueIndex < songQueue.length) {
        const item = songQueue[currentSongQueueIndex];
        isPlayingSong = true;
        switch (item.type) {
            case 'youtube':
                loadYouTubeAudio(item.id);
                break;
            case 'local':
                loadLocalAudio(item.file);
                break;
            case 'soundcloud':
            case 'spotify':
            case 'suno':
                loadSoundCloudOrSpotify(item.url);
                break;
        }
        updateQueueModal();
    } else {
        isPlayingSong = false;
        currentSongQueueIndex = -1; // Reset queue
        console.log("Song queue finished.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- MEDIA PLAYER ---
    const videoFileInput = document.getElementById('video-file-input');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const videoWrapper = document.getElementById('video-wrapper');
    const videoUrlInput = document.getElementById('video-url-input');
    const loadUrlBtn = document.getElementById('load-url-btn');

    videoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const videoItem = { type: 'local', file: file, title: file.name, id: Date.now() };
            videoQueue.push(videoItem);
            if (!isPlayingVideo) {
                playNextVideo();
            }
        }
    });

    loadUrlBtn.addEventListener('click', () => {
        const url = videoUrlInput.value;
        if (url) {
            const videoId = getYouTubeVideoId(url);
            if (videoId) {
                const videoItem = { type: 'youtube', id: videoId, title: url, originalUrl: url };
                videoQueue.push(videoItem);
                 if (!isPlayingVideo) {
                    if (typeof YT !== 'undefined' && YT.Player) {
                       playNextVideo();
                    } else {
                        // Poll for the API to be ready if it wasn't
                        const apiCheckInterval = setInterval(() => {
                            if (typeof YT !== 'undefined' && YT.Player) {
                                clearInterval(apiCheckInterval);
                                playNextVideo();
                            }
                        }, 100);
                    }
                }
                videoUrlInput.value = '';
            } else {
                alert('Invalid YouTube URL.');
            }
        }
    });

    fullscreenBtn.addEventListener('click', () => {
        const videoPlayer = document.getElementById('video-player');
        
        if (iframe && iframe.requestFullscreen) { // YouTube Player
            iframe.requestFullscreen();
        } else if (videoPlayer && videoPlayer.requestFullscreen) { // HTML5 Video
            videoPlayer.requestFullscreen();
        } else if (videoPlayer && videoPlayer.mozRequestFullScreen) { /* Firefox */
            videoPlayer.mozRequestFullScreen();
        } else if (videoPlayer && videoPlayer.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            videoPlayer.webkitRequestFullscreen();
        } else if (videoPlayer && videoPlayer.msRequestFullscreen) { /* IE/Edge */
            videoPlayer.msRequestFullscreen();
        } else if (videoWrapper.webkitEnterFullscreen) { /* iOS */
           videoWrapper.webkitEnterFullscreen();
        }
    });
    
    // --- SONG LOADER ---
    const songUrlInput = document.getElementById('song-url-input');
    const loadSongBtn = document.getElementById('load-song-btn');
    const songFileInput = document.getElementById('song-file-input');
    const audioPlayerWrapper = document.getElementById('audio-player-wrapper');

    loadSongBtn.addEventListener('click', () => {
        const url = songUrlInput.value.trim();
        if (!url) return;

        let songItem = null;

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = getYouTubeVideoId(url);
            if (videoId) {
                songItem = { type: 'youtube', id: videoId, title: url };
            } else {
                 audioPlayerWrapper.innerHTML = '<p class="error-message">Invalid YouTube URL.</p>';
            }
        } else if (url.includes('soundcloud.com')) {
            songItem = { type: 'soundcloud', url: url, title: url };
        } else if (url.includes('spotify.com')) {
            songItem = { type: 'spotify', url: url, title: url };
        } else if (url.includes('suno.com') || url.includes('suno.ai')) {
            songItem = { type: 'suno', url: url, title: url };
        } else {
            audioPlayerWrapper.innerHTML = '<p class="error-message">Please enter a valid YouTube, SoundCloud, Suno, or Spotify URL.</p>';
        }

        if (songItem) {
            songQueue.push(songItem);
            if (!isPlayingSong) {
                playNextSong();
            }
            songUrlInput.value = '';
        }
    });

    songFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const songItem = { type: 'local', file: file, title: file.name };
            songQueue.push(songItem);
            if (!isPlayingSong) {
                playNextSong();
            }
        }
    });
    
    // --- QUEUE MODAL ---
    const queueModal = document.getElementById('queue-modal');
    const closeQueueBtn = document.getElementById('close-queue-modal-btn');
    const manageVideoQueueBtn = document.getElementById('manage-video-queue-btn');
    const manageSongQueueBtn = document.getElementById('manage-song-queue-btn');

    manageVideoQueueBtn.addEventListener('click', () => openQueueModal('video'));
    manageSongQueueBtn.addEventListener('click', () => openQueueModal('song'));
    closeQueueBtn.addEventListener('click', closeQueueModal);
    queueModal.addEventListener('click', (e) => {
        if (e.target === queueModal) {
            closeQueueModal();
        }
    });

    // --- SOUNDBOARD ---
    const soundboardContainer = document.getElementById('soundboard-container');
    const totalPads = 16;
    const padsState = [];

    // Initialize audio context for potential future use (best practice)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const createSoundPad = (index) => {
        // Initialize state for this pad
        padsState[index] = {
            audio: new Audio(),
            name: `Pad ${index + 1}`,
            hotkey: null
        };
        padsState[index].audio.preload = "auto";

        // Create elements
        const pad = document.createElement('div');
        pad.className = 'sound-pad';

        const playButton = document.createElement('button');
        playButton.className = 'play-button';
        playButton.textContent = padsState[index].name;

        const controls = document.createElement('div');
        controls.className = 'pad-controls';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Button Name';
        nameInput.value = padsState[index].name;
        nameInput.setAttribute('aria-label', `Name for pad ${index + 1}`);


        const hotkeyInput = document.createElement('input');
        hotkeyInput.type = 'text';
        hotkeyInput.placeholder = 'Assign Hotkey';
        hotkeyInput.className = 'hotkey-input';
        hotkeyInput.setAttribute('aria-label', `Hotkey for pad ${index + 1}`);
        hotkeyInput.setAttribute('readonly', true); // Prevent mobile keyboard pop-up


        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.id = `file-input-${index}`;
        fileInput.setAttribute('aria-label', `Upload sound for pad ${index + 1}`);


        const fileLabel = document.createElement('label');
        fileLabel.className = 'file-upload-label';
        fileLabel.htmlFor = `file-input-${index}`;
        fileLabel.textContent = 'Upload Sound';

        // --- Event Listeners ---

        // Play sound
        playButton.addEventListener('click', () => {
            const sound = padsState[index].audio;
            if (sound.src) {
                // Rewind to start and play
                sound.currentTime = 0;
                sound.play().catch(error => console.error("Error playing sound:", error));
            }
        });

        // Update name
        nameInput.addEventListener('input', (e) => {
            const newName = e.target.value;
            padsState[index].name = newName;
            playButton.textContent = newName;
        });

        // Handle hotkey assignment
        hotkeyInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            const key = e.key;

            if (key === 'Backspace' || key === 'Delete') {
                padsState[index].hotkey = null;
                hotkeyInput.value = '';
                hotkeyInput.placeholder = 'Assign Hotkey';
                return;
            }

            // A single character or a special key like 'Enter', 'ArrowUp' etc.
            if (key.length > 0) {
                 const isDuplicate = padsState.some((pad, i) => i !== index && pad.hotkey === key);
                 if (isDuplicate) {
                     alert(`Hotkey "${key}" is already assigned to another pad.`);
                     return;
                 }
                padsState[index].hotkey = key;
                hotkeyInput.value = key;
                hotkeyInput.blur();
            }
        });
        
        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.placeholder = 'Press any key...';
        });

        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.placeholder = 'Assign Hotkey';
        });


        // Handle file upload
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const objectURL = URL.createObjectURL(file);
                padsState[index].audio.src = objectURL;
                // Optional: Revoke the old URL to free up memory if one exists
                // padsState[index].audio.addEventListener('canplaythrough', () => {
                //     URL.revokeObjectURL(oldObjectURL);
                // }, { once: true });
            }
        });

        // Assemble the pad
        controls.appendChild(nameInput);
        controls.appendChild(hotkeyInput);
        controls.appendChild(fileInput);
        controls.appendChild(fileLabel);
        pad.appendChild(playButton);
        pad.appendChild(controls);

        padsState[index].padElement = pad; // Store reference to the pad element
        return pad;
    };

    // Create and append all pads to the container
    for (let i = 0; i < totalPads; i++) {
        const soundPad = createSoundPad(i);
        soundboardContainer.appendChild(soundPad);
    }

    // Add Stop All button functionality
    const stopAllBtn = document.getElementById('stop-all-btn');
    stopAllBtn.addEventListener('click', () => {
        padsState.forEach(padState => {
            if (padState.audio) {
                padState.audio.pause();
                padState.audio.currentTime = 0;
            }
        });
    });

    // --- Global Hotkey Listener ---
    document.addEventListener('keydown', (e) => {
        // Ignore hotkeys if user is typing in an input field
        if (e.target.tagName === 'INPUT') {
            return;
        }

        const triggeredPadState = padsState.find(pad => pad.hotkey === e.key);
        
        if (triggeredPadState && triggeredPadState.audio.src) {
            const sound = triggeredPadState.audio;
            sound.currentTime = 0;
            sound.play().catch(error => console.error("Error playing sound:", error));

            // Visual feedback
            const padElement = triggeredPadState.padElement;
            padElement.classList.add('playing');
            setTimeout(() => {
                padElement.classList.remove('playing');
            }, 200);
        }
    });
});

// --- QUEUE MODAL FUNCTIONS ---
function openQueueModal(type) {
    currentModal = type;
    const modal = document.getElementById('queue-modal');
    const title = document.getElementById('queue-modal-title');
    title.textContent = type === 'video' ? 'Video Queue' : 'Song Queue';
    updateQueueModal();
    modal.style.display = 'flex';
}

function closeQueueModal() {
    document.getElementById('queue-modal').style.display = 'none';
    currentModal = null;
}

function updateQueueModal() {
    if (!currentModal) return;

    const queue = currentModal === 'video' ? videoQueue : songQueue;
    const currentIndex = currentModal === 'video' ? currentVideoQueueIndex : currentSongQueueIndex;
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';

    if (queue.length === 0) {
        queueList.innerHTML = '<li>Queue is empty.</li>';
        return;
    }

    queue.forEach((item, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;
        li.draggable = true;

        if (index === currentIndex) {
            li.classList.add('playing');
        }

        li.innerHTML = `
            <span class="drag-handle">::</span>
            <span class="queue-item-name">${item.title}</span>
            <div class="queue-item-controls">
                <button class="remove-queue-item-btn" data-index="${index}">&times;</button>
            </div>
        `;
        queueList.appendChild(li);
    });

    addQueueEventListeners();
}

function addQueueEventListeners() {
    const queueList = document.getElementById('queue-list');
    
    // Remove buttons
    queueList.querySelectorAll('.remove-queue-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
            const queue = currentModal === 'video' ? videoQueue : songQueue;
            
            queue.splice(indexToRemove, 1);

            if (currentModal === 'video') {
                if (indexToRemove < currentVideoQueueIndex) {
                    currentVideoQueueIndex--;
                } else if (indexToRemove === currentVideoQueueIndex) {
                    // Item being removed is currently playing
                    // Stop current playback and play next
                    // This is complex, for now we'll just remove and user can manually play next
                    isPlayingVideo = false;
                    currentVideoQueueIndex--; // will be incremented in playNextVideo
                    playNextVideo();
                }
            } else { // song
                 if (indexToRemove < currentSongQueueIndex) {
                    currentSongQueueIndex--;
                } else if (indexToRemove === currentSongQueueIndex) {
                    isPlayingSong = false;
                    currentSongQueueIndex--;
                    playNextSong();
                }
            }
            
            updateQueueModal();
        });
    });

    // Drag and drop
    const items = queueList.querySelectorAll('li[draggable="true"]');
    let dragStartIndex;

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragStartIndex = parseInt(item.dataset.index, 10);
            e.target.classList.add('dragging');
        });

        item.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        item.addEventListener('drop', (e) => {
            const dragEndIndex = parseInt(item.dataset.index, 10);
            const queue = currentModal === 'video' ? videoQueue : songQueue;
            
            const itemToMove = queue.splice(dragStartIndex, 1)[0];
            queue.splice(dragEndIndex, 0, itemToMove);
            
            // Adjust current playing index if needed
            let currentIndex = currentModal === 'video' ? currentVideoQueueIndex : currentSongQueueIndex;
            if (currentIndex === dragStartIndex) {
                currentIndex = dragEndIndex;
            } else if (dragStartIndex < currentIndex && dragEndIndex >= currentIndex) {
                currentIndex--;
            } else if (dragStartIndex > currentIndex && dragEndIndex <= currentIndex) {
                currentIndex++;
            }
            if(currentModal === 'video') currentVideoQueueIndex = currentIndex;
            else currentSongQueueIndex = currentIndex;

            updateQueueModal();
        });
    });
}