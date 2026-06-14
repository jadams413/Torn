// ==UserScript==
// @name         Jbling is the Shit V413
// @namespace    http://tampermonkey.net/
// @version      8.3
// @description  Enemy-only ranked war hospital tracker, next 10 releases, draggable
// @author       jbling413
// @match        https://www.torn.com/*
// @grant        none
// Jbling Hospital Release Tracker
//
// Tracks enemy hospital timers during Ranked Wars.
// Shows the next 10 enemy hospital releases.
// Highlights the next target out.
// Click 👤 to open profile.
// Click 📋 to copy profile link.
//
// First scan may take ~30 seconds because the script
// gathers hospital data from enemy profiles.
// After the initial scan, updates are fast thanks to caching.
// ==/UserScript==

(function () {
    'use strict';

    const BOX_ID = 'jbling-hosp-box';
    const HIGHLIGHT_CLASS = 'jbling-hosp-highlight';

    const MAX_SHOWN = 10;
    const SCAN_EVERY_MS = 30000;
    const CACHE_TTL_MS = 120000;

    let releases = [];
    let cache = {};
    let scanning = false;

    function secondsToTime(sec) {
        sec = Math.max(0, sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function colorForSeconds(sec, index) {
        if (index === 0) return '#00c853';
        if (sec < 60) return '#dc3545';
        if (sec < 300) return '#ff9800';
        return '#007bff';
    }

    function makeDraggable(el) {
        let isDown = false;
        let offsetX = 0;
        let offsetY = 0;

        const savedX = localStorage.getItem('jbling_box_x');
        const savedY = localStorage.getItem('jbling_box_y');

        if (savedX && savedY) {
            el.style.left = savedX + 'px';
            el.style.top = savedY + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        el.addEventListener('mousedown', e => {
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;

            isDown = true;
            offsetX = e.clientX - el.offsetLeft;
            offsetY = e.clientY - el.offsetTop;

            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isDown) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!isDown) return;

            isDown = false;

            localStorage.setItem('jbling_box_x', el.offsetLeft);
            localStorage.setItem('jbling_box_y', el.offsetTop);
        });
    }

    function getBox() {
        let box = document.querySelector('#' + BOX_ID);

        if (!box) {
            box = document.createElement('div');
            box.id = BOX_ID;
            box.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 999999;
                background: #007bff;
                color: white;
                padding: 8px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: bold;
                min-width: 240px;
                max-width: 260px;
                max-height: 280px;
                overflow-y: auto;
                overflow-x: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,.25);
                cursor: move;
                user-select: none;
            `;
            document.body.appendChild(box);
            makeDraggable(box);
        }

        return box;
    }

    function clearVisuals() {
        document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(e => {
            e.classList.remove(HIGHLIGHT_CLASS);
            e.style.outline = '';
            e.style.boxShadow = '';
        });
    }

    function getHospitalPlayers() {
        return [...document.querySelectorAll('li.enemy')]
            .map(li => {
                const status = li.querySelector('div[class*="status"]');
                const link = li.querySelector('a[href*="profiles.php?XID="]');

                if (!status || !link) return null;
                if (!/Hospital/i.test(status.textContent || '')) return null;

                const id = link.href.match(/XID=(\d+)/)?.[1];
                if (!id) return null;

                const label = link.getAttribute('aria-label') || '';
                const name = label.replace(/^View profile of\s+/i, '').trim() || `ID ${id}`;

                return { id, name, link, row: li };
            })
            .filter(Boolean);
    }

    async function fetchProfileData(player) {
        const cached = cache[player.id];
        const now = Date.now();

        if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
            cached.link = player.link;
            cached.row = player.row;
            return cached;
        }

        const url = `/profiles.php?step=getProfileData&XID=${player.id}&rfcv=${Date.now()}`;

        const r = await fetch(url, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await r.json();
        const status = data?.userStatus?.status;

        if (!status || status.type !== 'hospital') return null;

        const timestamp = Number(status.timestamp || 0);
        if (!timestamp) return null;

        const result = { ...player, timestamp, checkedAt: now };
        cache[player.id] = result;
        return result;
    }

    function cleanCache(currentIds) {
        for (const id of Object.keys(cache)) {
            if (!currentIds.has(id)) delete cache[id];
        }
    }

    async function scan() {
        if (scanning) return;
        scanning = true;

        const players = getHospitalPlayers();
        const currentIds = new Set(players.map(p => p.id));
        cleanCache(currentIds);

        const found = [];

        for (const player of players) {
            try {
                const info = await fetchProfileData(player);
                if (!info) continue;

                const left = info.timestamp - Math.floor(Date.now() / 1000);
                if (left > 0) found.push(info);
            } catch (e) {}
        }

        releases = found
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, MAX_SHOWN);

        scanning = false;
        draw();
    }

    function draw() {
        clearVisuals();

        const now = Math.floor(Date.now() / 1000);
        releases = releases.filter(p => p.timestamp > now - 5);

        const box = getBox();

        if (!releases.length) {
            box.innerHTML = `🏥 Next 10 Releases<br>No enemy hospital timers found`;
            return;
        }

        let html = `🏥 Next 10 Releases<br><br>`;

        releases.forEach((p, index) => {
            const secondsLeft = p.timestamp - now;
            const time = secondsToTime(secondsLeft);
            const color = colorForSeconds(secondsLeft, index);
            const rank = index === 0 ? '🎯' : `${index + 1}.`;

            html += `
                <div style="margin-bottom:2px;line-height:16px;white-space:nowrap;">
                    <span>${rank}</span>

                    <span style="margin-left:4px;">
                        ${p.name}
                    </span>

                    <span style="
                        color:${color};
                        background:white;
                        padding:1px 4px;
                        border-radius:3px;
                        margin-left:4px;
                    ">
                        ${time}
                    </span>

                    <a href="/profiles.php?XID=${p.id}"
                       target="_blank"
                       title="Open profile"
                       style="text-decoration:none;margin-left:5px;">
                        👤
                    </a>

                    <button
                       class="jbling-copy"
                       data-id="${p.id}"
                       data-name="${p.name}"
                       title="Copy profile link"
                       style="
                          border:none;
                          background:none;
                          cursor:pointer;
                          margin-left:2px;
                          font-size:12px;
                          padding:0;
                       ">
                        📋
                    </button>
                </div>
            `;

            if (index === 0) {
                p.row.classList.add(HIGHLIGHT_CLASS);
                p.row.style.outline = '3px solid #00c853';
                p.row.style.boxShadow = '0 0 8px #00c853';
            }
        });

        box.innerHTML = html;

        box.querySelectorAll('.jbling-copy').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;

                navigator.clipboard.writeText(
                    `${name} - https://www.torn.com/profiles.php?XID=${id}`
                );

                btn.textContent = '✓';

                setTimeout(() => {
                    btn.textContent = '📋';
                }, 1000);
            };
        });
    }

    setInterval(draw, 1000);
    setInterval(scan, SCAN_EVERY_MS);
    setTimeout(scan, 3000);
})();
