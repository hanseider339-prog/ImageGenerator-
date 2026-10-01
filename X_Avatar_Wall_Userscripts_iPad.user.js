// ==UserScript==
// @name         X Avatar Wall - iPad
// @namespace    https://github.com/hanseider339-prog/x-avatar-wall
// @version      1.1.0
// @description  在 X/Twitter 页面使用 XAvatarWall JSON 生成高清头像墙
// @author       hanseider339-prog
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle
// @connect      pbs.twimg.com
// @connect      abs.twimg.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'x-avatar-wall-panel';
    const BUTTON_ID = 'x-avatar-wall-button';

    // =========================================================
    // 基础样式
    // =========================================================

    GM.addStyle(`
        #${BUTTON_ID} {
            position: fixed;
            right: 18px;
            bottom: 90px;
            z-index: 999999;
            border: none;
            border-radius: 999px;
            padding: 12px 18px;
            background: #1d9bf0;
            color: white;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,.25);
        }

        #${BUTTON_ID}:active {
            transform: scale(.96);
        }

        #${PANEL_ID} {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: min(92vw, 560px);
            max-height: 88vh;
            overflow-y: auto;
            z-index: 999998;
            background: #ffffff;
            color: #111111;
            border-radius: 18px;
            padding: 20px;
            box-shadow: 0 15px 60px rgba(0,0,0,.35);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-sizing: border-box;
        }

        #${PANEL_ID} * {
            box-sizing: border-box;
        }

        #${PANEL_ID} h2 {
            margin: 0 0 15px;
            font-size: 22px;
        }

        #${PANEL_ID} label {
            display: block;
            margin-top: 13px;
            margin-bottom: 5px;
            font-size: 14px;
            font-weight: 700;
        }

        #${PANEL_ID} input,
        #${PANEL_ID} select {
            width: 100%;
            border: 1px solid #cfd4da;
            border-radius: 9px;
            padding: 10px;
            font-size: 15px;
            background: #fff;
            color: #111;
        }

        #${PANEL_ID} input[type="color"] {
            height: 42px;
            padding: 3px;
        }

        #${PANEL_ID} input[type="file"] {
            padding: 8px;
        }

        .xaw-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .xaw-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 18px;
        }

        .xaw-btn {
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
        }

        .xaw-primary {
            background: #1d9bf0;
            color: white;
        }

        .xaw-secondary {
            background: #e8eaed;
            color: #111;
        }

        .xaw-danger {
            background: #fee2e2;
            color: #991b1b;
        }

        #xaw-status {
            margin-top: 12px;
            padding: 10px;
            border-radius: 9px;
            background: #f3f4f6;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
        }

        #xaw-preview {
            width: 100%;
            margin-top: 15px;
            border-radius: 10px;
            background: #eee;
        }

        #xaw-overlay {
            position: fixed;
            inset: 0;
            z-index: 999997;
            background: rgba(0,0,0,.45);
        }

        @media (max-width: 600px) {
            #${PANEL_ID} {
                width: 94vw;
                padding: 16px;
            }
        }
    `);

    // =========================================================
    // 工具函数
    // =========================================================

    function create(tag, props = {}) {
        const el = document.createElement(tag);

        Object.entries(props).forEach(([key, value]) => {
            if (key === 'text') {
                el.textContent = value;
            } else if (key === 'html') {
                el.innerHTML = value;
            } else {
                el[key] = value;
            }
        });

        return el;
    }

    function setStatus(text) {
        const el = document.getElementById('xaw-status');

        if (el) {
            el.textContent = text;
        }
    }

    // =========================================================
    // 头像 URL
    // =========================================================

    /*
     * X 的头像 URL 通常类似：
     *
     * https://pbs.twimg.com/profile_images/.../xxxxx_x96.jpg
     *
     * 不再强制把 _x96.jpg 改成 _orig.jpg。
     *
     * 因为这种替换并不保证对应文件真实存在。
     *
     * 优先使用 JSON 原始 URL。
     */

    function getAvatarUrls(url) {
        if (!url) {
            return [];
        }

        const original = String(url).trim();

        const urls = [];

        // 第一优先级：JSON 原始 URL
        urls.push(original);

        try {
            const parsed = new URL(original);

            /*
             * 如果 X 使用 name=small / medium / large，
             * 尝试改成 large。
             */
            if (parsed.searchParams.has('name')) {
                const large = new URL(parsed.href);

                large.searchParams.set('name', 'large');

                if (!urls.includes(large.href)) {
                    urls.push(large.href);
                }
            }

            /*
             * 尝试 orig。
             */
            if (parsed.searchParams.has('name')) {
                const orig = new URL(parsed.href);

                orig.searchParams.set('name', 'orig');

                if (!urls.includes(orig.href)) {
                    urls.push(orig.href);
                }
            }

        } catch (e) {
            // URL 解析失败时继续使用原始 URL
        }

        return urls;
    }

    // =========================================================
    // 加载图片
    // =========================================================

    function loadImage(url) {
        return new Promise((resolve, reject) => {

            if (!url) {
                reject(new Error('empty url'));
                return;
            }

            GM.xmlHttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                timeout: 30000,

                onload: function (response) {

                    if (
                        response.status < 200 ||
                        response.status >= 300
                    ) {
                        reject(
                            new Error(
                                'HTTP ' + response.status
                            )
                        );

                        return;
                    }

                    const blob = response.response;

                    if (!(blob instanceof Blob)) {
                        reject(
                            new Error('not a blob')
                        );

                        return;
                    }

                    const objectUrl =
                        URL.createObjectURL(blob);

                    const img =
                        new Image();

                    img.onload = function () {

                        URL.revokeObjectURL(
                            objectUrl
                        );

                        resolve(img);
                    };

                    img.onerror = function () {

                        URL.revokeObjectURL(
                            objectUrl
                        );

                        reject(
                            new Error(
                                'image decode failed'
                            )
                        );
                    };

                    img.src = objectUrl;
                },

                onerror: function () {

                    reject(
                        new Error(
                            'network error'
                        )
                    );
                },

                ontimeout: function () {

                    reject(
                        new Error(
                            'timeout'
                        )
                    );
                }
            });
        });
    }

    async function loadAvatar(url) {

        const urls =
            getAvatarUrls(url);

        for (const candidate of urls) {

            try {

                const image =
                    await loadImage(candidate);

                return image;

            } catch (error) {

                console.log(
                    '头像加载失败，尝试下一个 URL：',
                    candidate,
                    error
                );
            }
        }

        return null;
    }

    // =========================================================
    // JSON
    // =========================================================

    function parseJson(text) {

        let data;

        try {

            data =
                JSON.parse(text);

        } catch (e) {

            throw new Error(
                'JSON 格式无法解析'
            );
        }

        if (!Array.isArray(data)) {

            throw new Error(
                'JSON 顶层必须是数组'
            );
        }

        return data

            .filter(
                item =>
                    item &&
                    item.avatar
            )

            .map(
                (item, index) => ({

                    username:
                        item.username || '',

                    avatar:
                        item.avatar || '',

                    time:
                        Number(item.time) || 0,

                    order:
                        Number(item.order) ||
                        index + 1

                })
            );
    }

    // =========================================================
    // 排序
    // =========================================================

    function sortData(data, mode) {

        const arr =
            [...data];

        switch (mode) {

            case 'order':

                arr.sort(
                    (a, b) =>
                        a.order - b.order
                );

                break;

            case 'username-asc':

                arr.sort(
                    (a, b) =>
                        a.username.localeCompare(
                            b.username
                        )
                );

                break;

            case 'username-desc':

                arr.sort(
                    (a, b) =>
                        b.username.localeCompare(
                            a.username
                        )
                );

                break;

            case 'time-new':

                arr.sort(
                    (a, b) =>
                        b.time - a.time
                );

                break;

            case 'time-old':

                arr.sort(
                    (a, b) =>
                        a.time - b.time
                );

                break;

            case 'random':

                for (
                    let i = arr.length - 1;
                    i > 0;
                    i--
                ) {

                    const j =
                        Math.floor(
                            Math.random() *
                            (i + 1)
                        );

                    [
                        arr[i],
                        arr[j]
                    ] =
                    [
                        arr[j],
                        arr[i]
                    ];
                }

                break;
        }

        return arr;
    }

    // =========================================================
    // 创建头像墙
    // =========================================================

    async function generateWall(
        data,
        options
    ) {

        const {
            title,
            bgColor,
            titleColor,
            titleSize,
            columns,
            avatarSize,
            gap,
            scale
        } = options;

        const canvas =
            document.createElement(
                'canvas'
            );

        const padding =
            Math.max(
                gap,
                20
            );

        const titleHeight =
            title
                ? Math.max(
                    Number(titleSize) + 25,
                    70
                )
                : 20;

        const rows =
            Math.ceil(
                data.length /
                columns
            );

        const width =
            padding * 2 +
            columns * avatarSize +
            (columns - 1) * gap;

        const height =
            titleHeight +
            padding +
            rows * avatarSize +
            (rows - 1) * gap +
            padding;

        const finalWidth =
            Math.round(
                width * scale
            );

        const finalHeight =
            Math.round(
                height * scale
            );

        canvas.width =
            finalWidth;

        canvas.height =
            finalHeight;

        const ctx =
            canvas.getContext(
                '2d'
            );

        if (!ctx) {

            throw new Error(
                '无法创建 Canvas 2D 上下文'
            );
        }

        ctx.scale(
            scale,
            scale
        );

        // -----------------------------------------------------
        // 背景
        // -----------------------------------------------------

        ctx.fillStyle =
            bgColor;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        // -----------------------------------------------------
        // 标题
        // -----------------------------------------------------

        if (title) {

            ctx.fillStyle =
                titleColor;

            ctx.font =
                `700 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

            ctx.textAlign =
                'center';

            ctx.textBaseline =
                'middle';

            ctx.fillText(
                title,
                width / 2,
                titleHeight / 2
            );
        }

        const startY =
            titleHeight +
            padding;

        let success = 0;
        let failed = 0;

        // -----------------------------------------------------
        // 头像
        // -----------------------------------------------------

        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            const item =
                data[i];

            const col =
                i % columns;

            const row =
                Math.floor(
                    i / columns
                );

            const x =
                padding +
                col *
                (avatarSize + gap);

            const y =
                startY +
                row *
                (avatarSize + gap);

            setStatus(
                `正在处理头像 ${i + 1} / ${data.length}\n` +
                `成功：${success}　失败：${failed}`
            );

            const img =
                await loadAvatar(
                    item.avatar
                );

            if (!img) {

                failed++;

                continue;
            }

            success++;

            ctx.save();

            // 圆形裁剪
            ctx.beginPath();

            ctx.arc(
                x + avatarSize / 2,
                y + avatarSize / 2,
                avatarSize / 2,
                0,
                Math.PI * 2
            );

            ctx.clip();

            // 等比例裁剪
            const ratio =
                Math.max(
                    avatarSize /
                        img.width,

                    avatarSize /
                        img.height
                );

            const drawWidth =
                img.width *
                ratio;

            const drawHeight =
                img.height *
                ratio;

            const drawX =
                x +
                (
                    avatarSize -
                    drawWidth
                ) / 2;

            const drawY =
                y +
                (
                    avatarSize -
                    drawHeight
                ) / 2;

            ctx.drawImage(
                img,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );

            ctx.restore();
        }

        setStatus(
            `生成完成！\n` +
            `头像总数：${data.length}\n` +
            `成功：${success}\n` +
            `失败：${failed}\n` +
            `输出尺寸：${canvas.width} × ${canvas.height}`
        );

        return canvas;
    }

    // =========================================================
    // 下载辅助
    // =========================================================

    function saveBlob(
        blob,
        extension
    ) {

        if (!blob) {

            throw new Error(
                'Blob 为空'
            );
        }

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                'a'
            );

        a.href =
            url;

        a.download =
            'XAvatarWall_' +
            Date.now() +
            '.' +
            extension;

        a.style.display =
            'none';

        document.body.appendChild(
            a
        );

        a.click();

        a.remove();

        setTimeout(
            () => {
                URL.revokeObjectURL(
                    url
                );
            },
            5000
        );
    }

    // =========================================================
    // DataURL 备用导出
    // =========================================================

    function exportWithDataURL(
        canvas,
        mime,
        extension
    ) {

        try {

            setStatus(
                '第一次导出失败，正在使用 Safari 兼容模式……'
            );

            const dataURL =
                canvas.toDataURL(
                    mime,
                    0.95
                );

            if (
                !dataURL ||
                dataURL === 'data:,'
            ) {

                throw new Error(
                    'Safari 无法创建图片数据'
                );
            }

            const a =
                document.createElement(
                    'a'
                );

            a.href =
                dataURL;

            a.download =
                'XAvatarWall_' +
                Date.now() +
                '.' +
                extension;

            a.style.display =
                'none';

            document.body.appendChild(
                a
            );

            a.click();

            a.remove();

            setStatus(
                '图片生成成功！\n' +
                '请检查 Safari 的下载文件。'
            );

        } catch (error) {

            console.error(
                'DataURL 导出失败：',
                error
            );

            alert(
                '图片生成失败。\n\n' +
                '请将「导出分辨率」改为 1× 后重新生成。'
            );

            setStatus(
                '图片导出失败：\n' +
                error.message +
                '\n\n' +
                '建议：将导出分辨率改为 1×。'
            );
        }
    }

    // =========================================================
    // Canvas 下载
    // =========================================================

    function downloadCanvas(
        canvas,
        format
    ) {

        const mime =
            format === 'png'
                ? 'image/png'
                : 'image/jpeg';

        const extension =
            format === 'png'
                ? 'png'
                : 'jpg';

        /*
         * iPad Safari 对超大 Canvas 的导出
         * 比较容易失败。
         *
         * 因此限制最终导出的像素总量。
         */

        const MAX_PIXELS =
            24000000;

        const MAX_SIZE =
            12000;

        let exportCanvas =
            canvas;

        const totalPixels =
            canvas.width *
            canvas.height;

        // -----------------------------------------------------
        // 自动缩小超大 Canvas
        // -----------------------------------------------------

        if (
            totalPixels > MAX_PIXELS ||
            canvas.width > MAX_SIZE ||
            canvas.height > MAX_SIZE
        ) {

            const pixelScale =
                Math.sqrt(
                    MAX_PIXELS /
                    totalPixels
                );

            const sizeScale =
                Math.min(
                    MAX_SIZE /
                        canvas.width,

                    MAX_SIZE /
                        canvas.height
                );

            const scale =
                Math.min(
                    pixelScale,
                    sizeScale,
                    1
                );

            const newWidth =
                Math.max(
                    1,
                    Math.floor(
                        canvas.width *
                        scale
                    )
                );

            const newHeight =
                Math.max(
                    1,
                    Math.floor(
                        canvas.height *
                        scale
                    )
                );

            exportCanvas =
                document.createElement(
                    'canvas'
                );

            exportCanvas.width =
                newWidth;

            exportCanvas.height =
                newHeight;

            const exportCtx =
                exportCanvas.getContext(
                    '2d'
                );

            if (!exportCtx) {

                alert(
                    '无法创建导出 Canvas'
                );

                return;
            }

            exportCtx.imageSmoothingEnabled =
                true;

            exportCtx.imageSmoothingQuality =
                'high';

            exportCtx.drawImage(
                canvas,
                0,
                0,
                newWidth,
                newHeight
            );
        }

        setStatus(
            '正在生成图片文件……\n' +
            `输出尺寸：${exportCanvas.width} × ${exportCanvas.height}`
        );

        // -----------------------------------------------------
        // 第一种方式：toBlob
        // -----------------------------------------------------

        try {

            exportCanvas.toBlob(
                function (blob) {

                    if (!blob) {

                        console.warn(
                            'toBlob 返回空值，尝试备用模式'
                        );

                        exportWithDataURL(
                            exportCanvas,
                            mime,
                            extension
                        );

                        return;
                    }

                    try {

                        saveBlob(
                            blob,
                            extension
                        );

                        setStatus(
                            '图片生成成功！\n' +
                            `文件格式：${extension.toUpperCase()}\n` +
                            `输出尺寸：${exportCanvas.width} × ${exportCanvas.height}`
                        );

                    } catch (error) {

                        console.error(
                            'Blob 下载失败：',
                            error
                        );

                        exportWithDataURL(
                            exportCanvas,
                            mime,
                            extension
                        );
                    }

                },
                mime,
                0.95
            );

        } catch (error) {

            console.error(
                'toBlob 执行失败：',
                error
            );

            // -------------------------------------------------
            // 第二种方式：DataURL
            // -------------------------------------------------

            exportWithDataURL(
                exportCanvas,
                mime,
                extension
            );
        }
    }

    // =========================================================
    // 打开面板
    // =========================================================

    function openPanel() {

        if (
            document.getElementById(
                PANEL_ID
            )
        ) {

            return;
        }

        const overlay =
            create(
                'div',
                {
                    id: 'xaw-overlay'
                }
            );

        const panel =
            create(
                'div',
                {
                    id: PANEL_ID
                }
            );

        panel.innerHTML = `

            <h2>
                🖼️ X Avatar Wall
            </h2>

            <label>
                选择 XAvatarWall JSON
            </label>

            <input
                id="xaw-json"
                type="file"
                accept=".json,application/json"
            >

            <label>
                标题
            </label>

            <input
                id="xaw-title"
                type="text"
                value="X Avatar Wall"
                placeholder="输入头像墙标题"
            >

            <label>
                排序方式
            </label>

            <select id="xaw-sort">

                <option value="order">
                    原始顺序
                </option>

                <option value="username-asc">
                    用户名 A → Z
                </option>

                <option value="username-desc">
                    用户名 Z → A
                </option>

                <option value="time-new">
                    时间 新 → 旧
                </option>

                <option value="time-old">
                    时间 旧 → 新
                </option>

                <option value="random">
                    随机
                </option>

            </select>

            <div class="xaw-row">

                <div>

                    <label>
                        背景颜色
                    </label>

                    <input
                        id="xaw-bg"
                        type="color"
                        value="#ffffff"
                    >

                </div>

                <div>

                    <label>
                        标题颜色
                    </label>

                    <input
                        id="xaw-title-color"
                        type="color"
                        value="#111111"
                    >

                </div>

            </div>

            <div class="xaw-row">

                <div>

                    <label>
                        标题大小
                    </label>

                    <input
                        id="xaw-title-size"
                        type="number"
                        value="32"
                        min="10"
                        max="200"
                    >

                </div>

                <div>

                    <label>
                        头像大小
                    </label>

                    <input
                        id="xaw-avatar-size"
                        type="number"
                        value="160"
                        min="20"
                        max="1000"
                    >

                </div>

            </div>

            <div class="xaw-row">

                <div>

                    <label>
                        每行头像数量
                    </label>

                    <input
                        id="xaw-columns"
                        type="number"
                        value="8"
                        min="1"
                        max="100"
                    >

                </div>

                <div>

                    <label>
                        头像间距
                    </label>

                    <input
                        id="xaw-gap"
                        type="number"
                        value="12"
                        min="0"
                        max="200"
                    >

                </div>

            </div>

            <label>
                导出分辨率
            </label>

            <select id="xaw-scale">

                <option value="1">
                    1×
                </option>

                <option value="2" selected>
                    2×
                </option>

                <option value="3">
                    3×
                </option>

                <option value="4">
                    4×
                </option>

            </select>

            <label>
                图片格式
            </label>

            <select id="xaw-format">

                <option
                    value="jpg"
                    selected
                >
                    JPG
                </option>

                <option value="png">
                    PNG
                </option>

            </select>

            <div class="xaw-buttons">

                <button
                    id="xaw-generate"
                    class="xaw-btn xaw-primary"
                >
                    生成头像墙
                </button>

                <button
                    id="xaw-close"
                    class="xaw-btn xaw-secondary"
                >
                    关闭
                </button>

            </div>

            <div class="xaw-buttons">

                <button
                    id="xaw-download"
                    class="xaw-btn xaw-primary"
                    disabled
                >
                    下载图片
                </button>

                <button
                    id="xaw-reset"
                    class="xaw-btn xaw-danger"
                >
                    重置
                </button>

            </div>

            <div id="xaw-status">
                请先选择 XAvatarWall JSON 文件。
            </div>

            <canvas
                id="xaw-preview"
            ></canvas>
        `;

        document.body.appendChild(
            overlay
        );

        document.body.appendChild(
            panel
        );

        let currentCanvas =
            null;

        // =====================================================
        // 关闭
        // =====================================================

        function closePanel() {

            panel.remove();
            overlay.remove();
        }

        document
            .getElementById(
                'xaw-close'
            )
            .addEventListener(
                'click',
                closePanel
            );

        overlay.addEventListener(
            'click',
            closePanel
        );

        // =====================================================
        // 重置
        // =====================================================

        document
            .getElementById(
                'xaw-reset'
            )
            .addEventListener(
                'click',
                () => {

                    document
                        .getElementById(
                            'xaw-json'
                        )
                        .value = '';

                    document
                        .getElementById(
                            'xaw-title'
                        )
                        .value =
                        'X Avatar Wall';

                    document
                        .getElementById(
                            'xaw-status'
                        )
                        .textContent =
                        '已重置，请重新选择 JSON。';

                    currentCanvas =
                        null;

                    document
                        .getElementById(
                            'xaw-download'
                        )
                        .disabled =
                        true;
                }
            );

        // =====================================================
        // 生成
        // =====================================================

        document
            .getElementById(
                'xaw-generate'
            )
            .addEventListener(
                'click',
                async () => {

                    const fileInput =
                        document.getElementById(
                            'xaw-json'
                        );

                    if (
                        !fileInput.files.length
                    ) {

                        alert(
                            '请先选择 JSON 文件'
                        );

                        return;
                    }

                    try {

                        const file =
                            fileInput.files[0];

                        const text =
                            await file.text();

                        let data =
                            parseJson(text);

                        const sortMode =
                            document
                                .getElementById(
                                    'xaw-sort'
                                )
                                .value;

                        data =
                            sortData(
                                data,
                                sortMode
                            );

                        const options = {

                            title:
                                document
                                    .getElementById(
                                        'xaw-title'
                                    )
                                    .value,

                            bgColor:
                                document
                                    .getElementById(
                                        'xaw-bg'
                                    )
                                    .value,

                            titleColor:
                                document
                                    .getElementById(
                                        'xaw-title-color'
                                    )
                                    .value,

                            titleSize:
                                Number(
                                    document
                                        .getElementById(
                                            'xaw-title-size'
                                        )
                                        .value
                                ),

                            columns:
                                Number(
                                    document
                                        .getElementById(
                                            'xaw-columns'
                                        )
                                        .value
                                ),

                            avatarSize:
                                Number(
                                    document
                                        .getElementById(
                                            'xaw-avatar-size'
                                        )
                                        .value
                                ),

                            gap:
                                Number(
                                    document
                                        .getElementById(
                                            'xaw-gap'
                                        )
                                        .value
                                ),

                            scale:
                                Number(
                                    document
                                        .getElementById(
                                            'xaw-scale'
                                        )
                                        .value
                                ),

                            format:
                                document
                                    .getElementById(
                                        'xaw-format'
                                    )
                                    .value
                        };

                        // -------------------------------------------------
                        // 参数保护
                        // -------------------------------------------------

                        options.columns =
                            Math.max(
                                1,
                                Math.min(
                                    100,
                                    options.columns
                                )
                            );

                        options.avatarSize =
                            Math.max(
                                20,
                                Math.min(
                                    1000,
                                    options.avatarSize
                                )
                            );

                        options.gap =
                            Math.max(
                                0,
                                Math.min(
                                    200,
                                    options.gap
                                )
                            );

                        options.scale =
                            Math.max(
                                1,
                                Math.min(
                                    4,
                                    options.scale
                                )
                            );

                        // -------------------------------------------------
                        // 生成
                        // -------------------------------------------------

                        currentCanvas =
                            await generateWall(
                                data,
                                options
                            );

                        // -------------------------------------------------
                        // 预览
                        // -------------------------------------------------

                        const preview =
                            document.getElementById(
                                'xaw-preview'
                            );

                        const previewCtx =
                            preview.getContext(
                                '2d'
                            );

                        const maxPreviewWidth =
                            500;

                        const ratio =
                            Math.min(
                                1,
                                maxPreviewWidth /
                                currentCanvas.width
                            );

                        preview.width =
                            Math.max(
                                1,
                                Math.floor(
                                    currentCanvas.width *
                                    ratio
                                )
                            );

                        preview.height =
                            Math.max(
                                1,
                                Math.floor(
                                    currentCanvas.height *
                                    ratio
                                )
                            );

                        previewCtx.clearRect(
                            0,
                            0,
                            preview.width,
                            preview.height
                        );

                        previewCtx.drawImage(
                            currentCanvas,
                            0,
                            0,
                            preview.width,
                            preview.height
                        );

                        document
                            .getElementById(
                                'xaw-download'
                            )
                            .disabled =
                            false;

                    } catch (error) {

                        console.error(
                            error
                        );

                        setStatus(
                            '生成失败：\n' +
                            error.message
                        );
                    }
                }
            );

        // =====================================================
        // 下载
        // =====================================================

        document
            .getElementById(
                'xaw-download'
            )
            .addEventListener(
                'click',
                () => {

                    if (!currentCanvas) {

                        alert(
                            '请先生成头像墙'
                        );

                        return;
                    }

                    const format =
                        document
                            .getElementById(
                                'xaw-format'
                            )
                            .value;

                    downloadCanvas(
                        currentCanvas,
                        format
                    );
                }
            );
    }

    // =========================================================
    // 悬浮按钮
    // =========================================================

    function createButton() {

        if (
            document.getElementById(
                BUTTON_ID
            )
        ) {

            return;
        }

        const button =
            create(
                'button',
                {
                    id: BUTTON_ID,
                    text: '🖼️ 头像墙'
                }
            );

        button.addEventListener(
            'click',
            openPanel
        );

        document.body.appendChild(
            button
        );
    }

    // =========================================================
    // 初始化
    // =========================================================

    function init() {

        createButton();

        /*
         * X 是 SPA。
         * 页面切换以后按钮可能被移除，
         * 所以定期检查。
         */

        setInterval(
            () => {

                if (
                    !document.getElementById(
                        BUTTON_ID
                    )
                ) {

                    createButton();
                }

            },
            3000
        );
    }

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();
    }

})();
