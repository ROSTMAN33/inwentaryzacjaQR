'use strict';

/**
 * Detects the likely type of a QR code's content string.
 * @param {string} text
 * @returns {'URL'|'Email'|'Phone'|'Text'}
 */
function detectContentType(text) {
  if (/^https?:\/\//i.test(text)) return 'URL';
  if (/^mailto:/i.test(text) || /\S+@\S+\.\S+/.test(text)) return 'Email';
  if (/^tel:/i.test(text) || /^\+?[\d\s\-().]{7,}$/.test(text.trim())) return 'Phone';
  return 'Text';
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function safeStorageGet(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

const Storage = (() => {
  const RECORDS_KEY = 'assetsnap-records-v1';

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function prefs() {
    return isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences
      ? window.Capacitor.Plugins.Preferences
      : null;
  }

  async function getItem(key) {
    const plugin = prefs();
    if (plugin) {
      const { value } = await plugin.get({ key });
      return value;
    }
    return safeStorageGet(key, null); // fallback for browser/live-server testing
  }

  async function setItem(key, value) {
    const plugin = prefs();
    if (plugin) {
      await plugin.set({ key, value });
      return;
    }
    safeStorageSet(key, value);
  }

  async function removeItem(key) {
    const plugin = prefs();
    if (plugin) {
      await plugin.remove({ key });
      return;
    }
    try { window.localStorage.removeItem(key); } catch (err) { /* ignore */ }
  }

  return {
    async loadRecords() {
      try {
        const raw = await getItem(RECORDS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.error('Failed to load saved scans:', err);
        return [];
      }
    },
    async saveRecords(records) {
      try {
        await setItem(RECORDS_KEY, JSON.stringify(records));
      } catch (err) {
        console.error('Failed to save scans:', err);
      }
    },
    async clearRecords() {
      try {
        await removeItem(RECORDS_KEY);
      } catch (err) {
        console.error('Failed to clear saved scans:', err);
      }
    },
    async getPreference(key) {
      try {
        return await getItem(key);
      } catch (err) {
        return null;
      }
    },
    async setPreference(key, value) {
      try {
        await setItem(key, value);
      } catch (err) {
        console.error('Failed to save preference:', err);
      }
    },
  };
})();


const INVENTORY_FIELD_DEFS = [
  { key: 'firstName',       labels: ['first name', 'firstname', 'imię'] },
  { key: 'lastName',        labels: ['last name', 'lastname', 'surname', 'nazwisko'] },
  { key: 'categoryName',    labels: ['category name', 'category'] },
  { key: 'assignedTo',      labels: ['assigned to', 'user', 'employee'] },
  { key: 'dateChecked',     labels: ['date checked'] },
  { key: 'site',            labels: ['site'] },
  { key: 'brand',           labels: ['brand'] },
  { key: 'model',           labels: ['model'] },
  { key: 'ram',             labels: ['ram'] },
  { key: 'disk',            labels: ['disk'] },
  { key: 'processor',       labels: ['processor'] },
  { key: 'operatingSystem', labels: ['operating system', 'os'] },
  { key: 'serialNumber',    labels: ['serial number', 'serial no', 'serial'] },
  { key: 'productKey',      labels: ['product key', 'product-key', 'productkey'] },
  { key: 'assetNumber',     labels: ['asset number', 'asset no', 'asset id'] },
  { key: 'purchasedYear',   labels: ['purchased year', 'purchase year'] },
  { key: 'purchaseType',    labels: ['purchase type'] },
  { key: 'price',           labels: ['price'] },
  { key: 'status',          labels: ['status'] },
  { key: 'warranty',        labels: ['warranty'] },
  { key: 'location',        labels: ['location', 'site location'] },
  { key: 'account',         labels: ['account'] },
  { key: 'comment',         labels: ['comment', 'comments'] },
];

const INVENTORY_EDITABLE_FIELDS = INVENTORY_FIELD_DEFS.map((def) => def.key);

const COLUMN_CONFIG_KEY = 'inventory-visible-columns-v1';
const BASE_COLUMN_KEYS = ['firstName', 'lastName', 'categoryName', 'serialNumber'];
const COLUMN_LABELS = {
  firstName: 'Imię', lastName: 'Nazwisko', categoryName: 'Wybrany sprzęt',
  assignedTo: 'Użytkownik (stare wpisy)', dateChecked: 'Data spisu',
  site: 'Oddział', brand: 'Marka', model: 'Model', ram: 'RAM', disk: 'Dysk',
  processor: 'Procesor', operatingSystem: 'System operacyjny',
  serialNumber: 'SN', productKey: 'Klucz produktu',
  assetNumber: 'Numer inwentarzowy', purchasedYear: 'Rok zakupu',
  purchaseType: 'Typ zakupu', price: 'Cena', status: 'Status', warranty: 'Gwarancja',
  location: 'Lokalizacja', account: 'Konto', comment: 'Uwagi',
};
let visibleColumnKeys = [];
let customColumnDefs = [];

function getColumnDefinition(key) {
  const standard = INVENTORY_FIELD_DEFS.find((def) => def.key === key);
  if (standard) return { key, label: COLUMN_LABELS[key] || key };
  return customColumnDefs.find((def) => def.key === key) || null;
}

function getActiveColumnDefinitions() {
  return [...BASE_COLUMN_KEYS, ...visibleColumnKeys]
    .map(getColumnDefinition)
    .filter(Boolean);
}

const INVENTORY_LABEL_TO_KEY = (() => {
  const map = {};
  INVENTORY_FIELD_DEFS.forEach((def) => def.labels.forEach((l) => { map[l.toLowerCase()] = def.key; }));
  return map;
})();

function buildInventoryLabelRegex() {
  const allLabels = [];
  INVENTORY_FIELD_DEFS.forEach((def) => def.labels.forEach((l) => allLabels.push(l)));
  const escaped = allLabels
    .sort((a, b) => b.length - a.length)
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})\\s*:\\s*`, 'gi');
}

function parseFullInventoryMetadata(text) {
  const result = {};
  INVENTORY_FIELD_DEFS.forEach((def) => { result[def.key] = ''; });

  const raw = String(text || '');
  if (!raw) return result;

  const regex = buildInventoryLabelRegex();
  const matches = [...raw.matchAll(regex)];

  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1].toLowerCase();
    const key = INVENTORY_LABEL_TO_KEY[label];
    if (!key) continue;

    const startIdx = matches[i].index + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const value = raw.slice(startIdx, endIdx).replace(/\s+/g, ' ').trim();
    if (value) result[key] = value;
  }

  return result;
}

/**
 * Formats a Date as "YYYY-MM-DD HH:MM:SS" local time.
 * @param {Date} date
 * @returns {string}
 */
function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Builds an export filename like "QuriousSight_08_25_2026_12.csv"
 * @param {string} extension - 'csv' or 'pdf'
 * @param {number} recordCount - number of scans included in the export
 * @returns {string}
 */
function buildExportFilename(extension, recordCount) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const yyyy = now.getFullYear();
  return `QuriousSight_${mm}_${dd}_${yyyy}_${recordCount}.${extension}`;
}

/**
 * NOTE: In Capacitor, replace this with Filesystem.writeFile() + Share.share()
 *
 * @param {string} filename
 * @param {string|Uint8Array} content
 * @param {string} mimeType
 */

function triggerDownload(filename, content, mimeType) {
  const blob   = content instanceof Uint8Array
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: mimeType });
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href  = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}


const DataStore = (() => {
  let records = [];
  let nextId  = 1;

  function persist() {
    Storage.saveRecords(records);
  }

  return {
    async init() {
      records = await Storage.loadRecords();
      let migratedLegacyNames = false;
      records.forEach((record) => {
        if ((!record.firstName || !record.lastName) && record.assignedTo) {
          const parts = String(record.assignedTo).trim().split(/\s+/);
          if (!record.firstName) record.firstName = parts.shift() || '';
          if (!record.lastName) record.lastName = parts.join(' ');
          migratedLegacyNames = true;
        }
      });
      if (migratedLegacyNames) Storage.saveRecords(records);
      nextId = records.reduce((max, r) => Math.max(max, r.id + 1), 1);
      return [...records];
    },

    add(content, sourceFormat) {
      const now = Date.now();

      if (records.some(r => r.content === content)) {
        return null;
      }

      const inventory = parseFullInventoryMetadata(content);
      const hasInventory = Object.values(inventory).some((v) => v);
      const firstName = document.getElementById('firstNameInput')?.value.trim() || '';
      const lastName = document.getElementById('lastNameInput')?.value.trim() || '';
      const equipmentType = document.getElementById('equipmentType')?.value.trim() || '';
      if (firstName) inventory.firstName = firstName;
      if (lastName) inventory.lastName = lastName;
      if (firstName || lastName) inventory.assignedTo = [firstName, lastName].filter(Boolean).join(' ');
      if (equipmentType) inventory.categoryName = equipmentType;
      if (!inventory.serialNumber) inventory.serialNumber = content.trim();

      const record = {
        id:          nextId++,
        content,
      type:        ['QR Code', 'Barcode', 'Wpis ręczny'].includes(sourceFormat)
          ? sourceFormat
          : (hasInventory ? 'IT Asset' : detectContentType(content)),
        ...inventory,
        timestamp:   formatTimestamp(new Date(now)),
        timestampMs: now,
      };
      records.push(record);
      persist();
      return record;
    },

    remove(id) {
      records = records.filter((r) => r.id !== id);
      persist();
    },

    update(id, field, value) {
      const allowedFields = INVENTORY_EDITABLE_FIELDS;
      const isCustomField = customColumnDefs.some((def) => def.key === field);
      if (!allowedFields.includes(field) && !isCustomField) return null;

      const record = records.find((r) => r.id === id);
      if (!record) return null;

      record[field] = value;
      persist();
      return record;
    },

    clear() {
      records = [];
      Storage.clearRecords();
    },

    getAll() {
      return [...records];
    },

    count() {
      return records.length;
    },
  };
})();


const BarcodeReader = (() => {
  let reader = null;

  function getReader() {
    if (reader) return reader;
    if (typeof ZXing === 'undefined') return null;

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.ITF,
      ZXing.BarcodeFormat.CODABAR,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);
    return reader;
  }

  /**
   * Attempts to decode a 1D barcode from ImageData.
   * @param {ImageData} imageData
   * @returns {string|null}
   */
  function decode(imageData) {
    const r = getReader();
    if (!r) return null;

    // ZXing logs an internal console.warn for every format it tries and fails
    // on each frame — expected noise, not a real error. Suppress it briefly
    // just for the duration of this call so it doesn't drown out real logs.
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      // ImageData.data is RGBA (4 bytes per pixel), but RGBLuminanceSource
      // expects one luminance value per pixel or packed 32-bit pixels. Passing
      // the RGBA byte array directly makes it interpret the first quarter of
      // the frame as unrelated pixels, which prevents 1D barcode decoding.
      const luminance = new Uint8ClampedArray(imageData.width * imageData.height);
      for (let pixel = 0, source = 0; pixel < luminance.length; pixel += 1, source += 4) {
        luminance[pixel] = Math.round(
          imageData.data[source] * 0.299 +
          imageData.data[source + 1] * 0.587 +
          imageData.data[source + 2] * 0.114
        );
      }
      const luminanceSource = new ZXing.RGBLuminanceSource(luminance, imageData.width, imageData.height);
      const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
      const result = r.decode(binaryBitmap);
      return result ? result.getText() : null;
    } catch (err) {
      return null; // no barcode found in this frame — normal, not an error
    } finally {
      console.warn = originalWarn;
      r.reset();
    }
  }

  return { decode };
})();

const QRScanner = (() => {
  let stream      = null;
  let animFrameId = null;
  let scanning    = false;
  let onDecodeCb  = null; 
  let activeTrack = null;
  let controlsInfo = { torch: false, zoom: null };
  let torchEnabled = false;

  const video  = document.getElementById('cameraVideo');
  const canvas = document.getElementById('qrCanvas');
  const ctx    = canvas.getContext('2d', { willReadFrequently: true });

  /**
   * @param {Function} onDecode 
   */
  async function start(onDecode, _isRetry) {
    if (scanning) return;
    onDecodeCb = onDecode;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
          advanced: [{ focusMode: 'continuous' }],
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      activeTrack = stream.getVideoTracks()[0] || null;
      controlsInfo = { torch: false, zoom: null };
      torchEnabled = false;
      if (activeTrack?.getCapabilities) {
        const capabilities = activeTrack.getCapabilities();
        if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          activeTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }
        controlsInfo.torch = capabilities.torch === true;
        if (capabilities.zoom && Number.isFinite(capabilities.zoom.max) && capabilities.zoom.max > capabilities.zoom.min) {
          controlsInfo.zoom = { min: capabilities.zoom.min, max: capabilities.zoom.max, step: capabilities.zoom.step || 0.1, value: activeTrack.getSettings?.().zoom || capabilities.zoom.min };
        }
      }
      scanning = true;
      _loop();
      return { ...controlsInfo, torchEnabled };
    } catch (err) {
      // On Android, the very first permission grant can resolve a beat
      // after the WebView reports it. Auto-retry once instead of making
      // the user tap Start again.
      if (!_isRetry && (err.name === 'NotAllowedError' || err.name === 'NotReadableError')) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return start(onDecode, true);
      }
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow access and try again.'
        : `Camera error: ${err.message}`;
      throw new Error(msg);
    }
  }

  /** Stops the camera and decode loop. */
  function stop() {
    scanning = false;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    activeTrack = null;
    controlsInfo = { torch: false, zoom: null };
    torchEnabled = false;
    video.srcObject = null;
    video.load();
  }

  function getControls() { return { ...controlsInfo, torchEnabled }; }

  async function setTorch(enabled) {
    if (!activeTrack || !controlsInfo.torch) return false;
    await activeTrack.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
    torchEnabled = Boolean(enabled);
    return true;
  }

  async function setZoom(value) {
    if (!activeTrack || !controlsInfo.zoom) return false;
    const zoom = Math.max(controlsInfo.zoom.min, Math.min(controlsInfo.zoom.max, Number(value)));
    await activeTrack.applyConstraints({ advanced: [{ zoom }] });
    controlsInfo.zoom.value = zoom;
    return true;
  }

  /** Internal: requestAnimationFrame decode loop. */
  let frameCount = 0;

  function _loop() {
    if (!scanning) return;

    if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Alternate the decoders: each gets a fresh frame at about 15 fps on a
      // 30 fps camera, keeping the phone responsive while checking barcodes
      // more often than the old every-third-frame schedule.
      if (frameCount % 2 === 0) {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: frameCount % 10 === 0 ? 'attemptBoth' : 'dontInvert',
        });
        if (code && typeof onDecodeCb === 'function') onDecodeCb(code.data, 'QR Code');
      } else {
        const barcodeText = BarcodeReader.decode(imageData);
        if (barcodeText && typeof onDecodeCb === 'function') onDecodeCb(barcodeText, 'Barcode');
      }
      frameCount += 1;
    }

    animFrameId = requestAnimationFrame(_loop);
  }

  /**
   * Decodes a QR code from a File (image upload).
   * @param {File} file
   * @param {Function} onDecode - Called with (text: string) on success.
   * @param {Function} onError  - Called with (message: string) on failure.
   */
function decodeFromFile(file, onDecode, onError) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale large phone photos to max 800px width/height to prevent memory crash
        const maxDim = 800;
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width  = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code      = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code) {
          onDecode(code.data, 'QR Code');
          return;
        }
        const barcodeText = BarcodeReader.decode(imageData);
        if (barcodeText) {
          onDecode(barcodeText, 'Barcode');
          return;
        }
        onError('No QR code or barcode found in the image. Please try another image.');
      };
      img.onerror = () => onError('Could not load the selected image file.');
      img.src = e.target.result;
    };
    reader.onerror = () => onError('Could not read the selected file.');
    reader.readAsDataURL(file);
  }

  return { start, stop, decodeFromFile, getControls, setTorch, setZoom };
})();


const Exporter = (() => {

  const CSV_TEMPLATE_FIELDS = [
    { header: 'category_name',    key: 'categoryName' },
    { header: 'assigned_to',      key: 'assignedTo' },
    { header: 'date_checked',     key: 'dateChecked' },
    { header: 'site',             key: 'site' },
    { header: 'brand',            key: 'brand' },
    { header: 'model',            key: 'model' },
    { header: 'ram',              key: 'ram' },
    { header: 'disk',             key: 'disk' },
    { header: 'processor',        key: 'processor' },
    { header: 'operating_system', key: 'operatingSystem' },
    { header: 'serial_number',    key: 'serialNumber' },
    { header: 'product_key',      key: 'productKey' },
    { header: 'asset_number',     key: 'assetNumber' },
    { header: 'purchased_year',   key: 'purchasedYear' },
    { header: 'purchase_type',    key: 'purchaseType' },
    { header: 'price',            key: 'price' },
    { header: 'status',           key: 'status' },
    { header: 'warranty',         key: 'warranty' },
    { header: 'location',         key: 'location' },
    { header: 'account',          key: 'account' },
    { header: 'comment',          key: 'comment' },
  ];

  const EXPORT_HEADERS = {
    firstName: 'imię', lastName: 'nazwisko', categoryName: 'wybór_sprzętu',
    serialNumber: 'SN', type: 'typ_kodu',
  };

  function selectedExportFields() {
    return [
      ...getActiveColumnDefinitions().map((def) => ({
        header: EXPORT_HEADERS[def.key] || def.label,
        key: def.key,
      })),
      { header: EXPORT_HEADERS.type, key: 'type' },
    ];
  }

  function buildCSV(records) {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const fields = selectedExportFields();
    const header = fields.map((f) => f.header);
    const rows = records.map((r) => fields.map((f) => esc(r[f.key])));

    const content = [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const filename = buildExportFilename('csv', records.length);
    return { filename, content, contentType: 'text/csv' };
  }

  const PDF_TEMPLATE_FIELDS = [
    { header: '#',           key: 'id' },
    { header: 'Category',    key: 'categoryName' },
    { header: 'Assigned To', key: 'assignedTo' },
    { header: 'Checked',     key: 'dateChecked' },
    { header: 'Site',        key: 'site' },
    { header: 'Brand',       key: 'brand' },
    { header: 'Model',       key: 'model' },
    { header: 'RAM',         key: 'ram' },
    { header: 'Disk',        key: 'disk' },
    { header: 'Processor',   key: 'processor' },
    { header: 'OS',          key: 'operatingSystem' },
    { header: 'Serial No.',  key: 'serialNumber' },
    { header: 'Product Key', key: 'productKey' },
    { header: 'Asset No.',   key: 'assetNumber' },
    { header: 'Purchased',   key: 'purchasedYear' },
    { header: 'Purch. Type', key: 'purchaseType' },
    { header: 'Price',       key: 'price' },
    { header: 'Status',      key: 'status' },
    { header: 'Warranty',    key: 'warranty' },
    { header: 'Location',    key: 'location' },
    { header: 'Account',     key: 'account' },
    { header: 'Comment',     key: 'comment' },
  ];

  function buildPDF(records) {
    const { jsPDF } = window.jspdf;
    const fields = [{ header: '#', key: 'id' }, ...selectedExportFields()];
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFillColor(8, 15, 37);
    doc.rect(0, 0, 297, 297, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(224, 197, 143);
    doc.text('QR Scanner — Scan Report', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(217, 203, 194);
    doc.text(`Generated: ${formatTimestamp(new Date())}   |   Total entries: ${records.length}`, 14, 25);

    doc.setDrawColor(224, 197, 143);
    doc.setLineWidth(0.4);
    doc.line(14, 28, 283, 28);

    doc.autoTable({
      startY: 32,
      head: [fields.map((f) => f.header)],
      body: records.map((r) => fields.map((f) => r[f.key] || '')),
      styles: {
        font: 'helvetica', fontSize: 6.5, cellPadding: 2,
        fillColor: [17, 34, 80], textColor: [245, 240, 233],
        lineColor: [60, 80, 125], lineWidth: 0.3,
      },
      headStyles: { fillColor: [60, 80, 125], textColor: [224, 197, 143], fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [22, 40, 90] },
      margin: { left: 6, right: 6 },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 140, 130);
      doc.text(`Page ${i} of ${pageCount}  —  QR Scanner App`, 297 / 2, doc.internal.pageSize.height - 6, { align: 'center' });
    }

    const filename = buildExportFilename('pdf', records.length);
    return { filename, doc, contentType: 'application/pdf' };
  }

  function buildJSON(records) {
    const payload = records.map((r) => {
      const obj = {};
      selectedExportFields().forEach((field) => { obj[field.header] = r[field.key] || ''; });
      obj.timestamp = r.timestamp || '';
      return obj;
    });
    const content = JSON.stringify(payload, null, 2);
    const filename = buildExportFilename('json', records.length);
    return { filename, content, contentType: 'application/json' };
  }

  function buildXML(records) {
    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const rows = records.map((r) => {
      const fields = selectedExportFields()
        .map((def) => `    <${def.key}>${esc(r[def.key])}</${def.key}>`)
        .join('\n');
      return `  <record id="${r.id}">\n${fields}\n    <timestamp>${esc(r.timestamp)}</timestamp>\n  </record>`;
    }).join('\n');
    const content = `<?xml version="1.0" encoding="UTF-8"?>\n<inventory>\n${rows}\n</inventory>`;
    const filename = buildExportFilename('xml', records.length);
    return { filename, content, contentType: 'application/xml' };
  }

  function buildXLSX(records) {
    const fields = selectedExportFields();
    const header = fields.map((f) => f.header);
    const rows = records.map((r) => fields.map((f) => r[f.key] || ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const filename = buildExportFilename('xlsx', records.length);
    return {
      filename,
      base64Data,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  return { buildCSV, buildPDF, buildJSON, buildXML, buildXLSX };
})();


const FileExport = (() => {
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    return isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.FileSharer
      ? window.Capacitor.Plugins.FileSharer
      : null;
  }

  function fallbackDownload(filename, base64Data, contentType) {
    const clean = base64Data.replace(/^data:.*;base64,/, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    triggerDownload(filename, bytes, contentType);
  }

  return {
    async save({ filename, base64Data, contentType }) {
      const FileSharer = plugin();
      if (FileSharer) {
        await FileSharer.save({
          filename,
          contentType,
          base64Data,
          android: { saveDirectory: 'downloads', relativePath: 'Download/QuriousSight' },
        });
        return;
      }
      fallbackDownload(filename, base64Data, contentType); // browser/live-server testing
    },

    async share({ filename, base64Data, contentType }) {
      const FileSharer = plugin();
      if (FileSharer) {
        await FileSharer.share({ filename, contentType, base64Data });
        return;
      }
      fallbackDownload(filename, base64Data, contentType); // no native share sheet in a browser
    },
  };
})();


const UIManager = (() => {

  // ── Element Cache ──────────────────────────────────────────────────
  const els = {
    startBtn:        document.getElementById('startBtn'),
    stopBtn:         document.getElementById('stopBtn'),
    browseGalleryBtn: document.getElementById('browseGalleryBtn'),
    fileInput:       document.getElementById('fileInput'),
    scanLine:        document.getElementById('scanLaser'),
    scanFlash:       document.getElementById('scanFlash'),
    statusDot:       document.getElementById('statusDot'),
    statusText:      document.getElementById('statusText'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    resultsEmpty:    document.getElementById('resultsEmpty'),
    resultsTable:    document.getElementById('resultsTable'),
    tableBody:       document.getElementById('tableBody'),
    tableHeaderRow:  document.getElementById('tableHeaderRow'),
    entryCount:      document.getElementById('entryCount'),
    columnOptions:   document.getElementById('columnOptions'),
    customColumnName: document.getElementById('customColumnName'),
    addCustomColumnBtn: document.getElementById('addCustomColumnBtn'),
    manualSerialNumber: document.getElementById('manualSerialNumber'),
    addManualScanBtn: document.getElementById('addManualScanBtn'),
    newEmployeeBtn: document.getElementById('newEmployeeBtn'),
    cameraTools: document.getElementById('cameraTools'),
    torchBtn: document.getElementById('torchBtn'),
    zoomControl: document.getElementById('zoomControl'),
    zoomSlider: document.getElementById('zoomSlider'),
    zoomValue: document.getElementById('zoomValue'),
    recentRecordsPanel: document.getElementById('recentRecordsPanel'),
    recentRecordList: document.getElementById('recentRecordList'),
    recentCount: document.getElementById('recentCount'),
    showAllRecordsBtn: document.getElementById('showAllRecordsBtn'),
    clearAllBtn:     document.getElementById('clearAllBtn'),
    exportCsvBtn:    document.getElementById('exportCsvBtn'),
    exportPdfBtn:    document.getElementById('exportPdfBtn'),
    toastContainer:  document.getElementById('toastContainer'),
    themeToggle:     document.getElementById('themeToggle'),
    themeToggleLabel: document.getElementById('themeToggleLabel'),
    exportChoiceModal: document.getElementById('exportChoiceModal'),
    exportChoiceTitle: document.getElementById('exportChoiceTitle'),
    exportSaveBtn:     document.getElementById('exportSaveBtn'),
    exportShareBtn:    document.getElementById('exportShareBtn'),
    exportCancelBtn:   document.getElementById('exportCancelBtn'),
    exportXlsxBtn:     document.getElementById('exportXlsxBtn'),
    exportWebhookBtn:  document.getElementById('exportWebhookBtn'),
    exportXmlBtn:      document.getElementById('exportXmlBtn'),
    exportJsonBtn:     document.getElementById('exportJsonBtn'),
    webhookModal:      document.getElementById('webhookModal'),
    webhookUrlInput:   document.getElementById('webhookUrlInput'),
    webhookSendBtn:    document.getElementById('webhookSendBtn'),
    webhookCancelBtn:  document.getElementById('webhookCancelBtn'),
    exportJsonBtn:     document.getElementById('exportJsonBtn'),

    // Tabs & Viewports
    tabCameraMode:    document.getElementById('tabCameraMode'),
    tabGalleryMode:   document.getElementById('tabGalleryMode'),
    cameraViewport:   document.getElementById('cameraViewport'),
    galleryViewport:  document.getElementById('galleryViewport'),
    uploadDropzone:   document.getElementById('uploadDropzone'),
    galleryPreviewWrapper: document.getElementById('galleryPreviewWrapper'),
    galleryPreviewImg: document.getElementById('galleryPreviewImg'),
    removePhotoBtn:   document.getElementById('removePhotoBtn'),

    // Permission Modal
    permissionModal:  document.getElementById('permissionModal'),
    grantAccessBtn:   document.getElementById('grantAccessBtn'),
    skipAccessBtn:    document.getElementById('skipAccessBtn'),
  };

  // ── Status ─────────────────────────────────────────────────────────
  function setStatus(state, text) {
    const { statusDot, statusText } = els;
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
  }

  // ── Camera Visibility ──────────────────────────────────────────────
  function showCamera(show) {
    if (show) {
      els.cameraPlaceholder.classList.add('hidden');
      els.scanLine.classList.add('active');
    } else {
      els.cameraPlaceholder.classList.remove('hidden');
      els.scanLine.classList.remove('active');
    }
  }

  // ── Scan Flash ─────────────────────────────────────────────────────
  function triggerScanFlash() {
    if (!els.scanFlash) return;
    els.scanFlash.classList.remove('active');
    void els.scanFlash.offsetWidth; // force reflow so the animation restarts cleanly
    els.scanFlash.classList.add('active');
  }

  // ── Button States ──────────────────────────────────────────────────
  function setButtonState(scanning) {
    els.startBtn.disabled  = scanning;
    els.stopBtn.disabled   = !scanning;
    if (els.browseGalleryBtn) {
      els.browseGalleryBtn.disabled = scanning;
    }
  }

  // ── Tab Management ─────────────────────────────────────────────────
  function switchTab(mode) {
    if (mode === 'camera') {
      els.tabCameraMode.classList.add('active');
      els.tabGalleryMode.classList.remove('active');
      els.cameraViewport.classList.remove('hidden');
      els.galleryViewport.classList.add('hidden');
      els.startBtn.style.display = '';
      els.stopBtn.style.display = '';
      document.getElementById('modeLabelText').textContent = 'Podgląd aparatu';
      document.getElementById('statusBadge').classList.remove('hidden');
    } 

    else {
      els.tabCameraMode.classList.remove('active');
      els.tabGalleryMode.classList.add('active');
      els.cameraViewport.classList.add('hidden');
      els.galleryViewport.classList.remove('hidden');
      els.startBtn.style.display = 'none';
      els.stopBtn.style.display = 'none';
      document.getElementById('modeLabelText').textContent = 'Skanuj ze zdjęcia';
      document.getElementById('statusBadge').classList.add('hidden');
    }
  }

  // ── Gallery Management ─────────────────────────────────────────────
  function showGalleryPreview(src) {
    const dropzoneContent = document.getElementById('dropzoneContent');
    dropzoneContent.classList.add('hidden');
    els.galleryPreviewWrapper.classList.remove('hidden');
    els.galleryPreviewImg.src = src;
  }

  function clearGalleryPreview() {
    const dropzoneContent = document.getElementById('dropzoneContent');
    dropzoneContent.classList.remove('hidden');
    els.galleryPreviewWrapper.classList.add('hidden');
    els.galleryPreviewImg.src = '';
    els.fileInput.value = '';
  }

  // ── Table Row ──────────────────────────────────────────────────────
  function addTableRow(record, onDelete, onEdit) {
    const typeClass = `type-${String(record.type || '').toLowerCase().replace(/\s+/g, '-')}`;
    const tr = document.createElement('tr');
    tr.dataset.id = record.id;

    const idCell = document.createElement('td');
    idCell.textContent = record.id;
    idCell.title = record.content;
    idCell.dataset.label = '#';
    tr.appendChild(idCell);

    getActiveColumnDefinitions().forEach(({ key: field, label }) => {
      const td = document.createElement('td');
      td.className = 'td-editable';
      td.contentEditable = 'true';
      td.spellcheck = false;
      td.dataset.field = field;
      td.dataset.label = label;
      td.title = 'Click to edit';

      let currentValue = record[field];

      function renderValue(v) {
        const trimmed = String(v || '').trim();
        if (trimmed) {
          td.textContent = trimmed;
          td.classList.remove('td-empty');
        } else {
          td.textContent = '—';
          td.classList.add('td-empty');
        }
      }

      renderValue(currentValue);

      td.addEventListener('focus', () => {
        if (td.classList.contains('td-empty')) {
          td.textContent = '';
        }
      });

      function commit() {
        const newValue = td.textContent.trim();
        currentValue = newValue;
        renderValue(currentValue);
        if (typeof onEdit === 'function') {
          onEdit(record.id, field, newValue);
        }
      }

      td.addEventListener('blur', commit);
      td.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          td.blur();
        }
        if (e.key === 'Escape') {
          renderValue(currentValue);
          td.blur();
        }
      });

      tr.appendChild(td);
    });

    const typeTd = document.createElement('td');
    const typeBadge = document.createElement('span');
    typeBadge.className = `type-badge ${typeClass}`;
    typeBadge.textContent = record.type || 'Text';
    typeTd.appendChild(typeBadge);
    typeTd.dataset.label = 'Typ kodu';
    tr.appendChild(typeTd);

    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-row-delete';
    delBtn.title = 'Delete row';
    delBtn.dataset.id = record.id;
    delBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      </svg>`;
    delBtn.addEventListener('click', () => {
      tr.style.opacity = '0';
      tr.style.transition = 'opacity 0.25s';
      setTimeout(() => { tr.remove(); onDelete(record.id); }, 250);
    });
    actionTd.appendChild(delBtn);
    actionTd.dataset.label = 'Akcja';
    tr.appendChild(actionTd);

    els.tableBody.appendChild(tr);
  }

  // ── Show / Hide Table ──────────────────────────────────────────────
  function refreshTableVisibility(count) {
    const empty = count === 0;
    els.resultsEmpty.style.display = empty ? '' : 'none';
    els.resultsTable.style.display = empty ? 'none' : '';
    const remainder = count % 10;
    const word = count === 1 ? 'pozycja' : (remainder >= 2 && remainder <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'pozycje' : 'pozycji');
    els.entryCount.textContent = `${count} ${word}`;
  }

    // ── Feedback (chime + vibration) ─────────────────────────────────────
  let audioCtx = null;

  function playTone(freq, startOffset) {
    const now = audioCtx.currentTime + startOffset;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playChime(type = 'info') {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      if (type === 'duplicate') {
        // Two quick identical blips — a distinct "already got this one"
        // rhythm, recognizable by ear without looking at the screen.
        playTone(660, 0);
        playTone(660, 0.14);
        return;
      }

      const freqMap = { success: 880, error: 300, info: 620 };
      playTone(freqMap[type] || 620, 0);
    } catch (err) { /* audio unavailable/blocked — fail silently */ }
  }

  function vibrateDevice(type = 'info') {
    try {
      if (!('vibrate' in navigator)) return;
      const patterns = {
        error: [40, 60, 40],
        duplicate: [25, 90, 25],
      };
      navigator.vibrate(patterns[type] || 35);
    } catch (err) { /* vibration unavailable — fail silently */ }
  }

  // ── Toast ──────────────────────────────────────────────────────────
    const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', duplicate: '🔁' };

  function showToast(message, type = 'info', durationMs = 3200) {
    playChime(type);
    vibrateDevice(type);

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = TOAST_ICONS[type] || '💬';

    const text = document.createElement('span');
    text.textContent = message; // scanned QR/barcode content is untrusted — never innerHTML this

    el.appendChild(icon);
    el.appendChild(text);
    els.toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 280);
    }, durationMs);
  }

  function hidePermissionModal() {
    if (els.permissionModal) {
      els.permissionModal.classList.add('hidden');
    }
  }

  return { 
    els, 
    setStatus, 
    showCamera, 
    setButtonState, 
    addTableRow, 
    refreshTableVisibility, 
    showToast,
    switchTab,
    showGalleryPreview,
    clearGalleryPreview,
    hidePermissionModal,
    triggerScanFlash
  };
})();


const App = (() => {

  const { 
    els, 
    setStatus, 
    showCamera, 
    setButtonState, 
    addTableRow, 
    refreshTableVisibility, 
    showToast,
    switchTab,
    showGalleryPreview,
    clearGalleryPreview,
    hidePermissionModal,
    triggerScanFlash
  } = UIManager;

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const isDark = theme === 'dark';
    if (els.themeToggle && els.themeToggleLabel) {
      els.themeToggleLabel.textContent = isDark ? 'Dark' : 'Light';
      els.themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    safeStorageSet('assetsnap-theme', theme);
  }

  const savedTheme = safeStorageGet('assetsnap-theme', 'dark');
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');

  function renderTableHeader() {
    const row = els.tableHeaderRow;
    if (!row) return;
    row.replaceChildren();
    const addHeader = (label) => {
      const th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
    };
    addHeader('#');
    getActiveColumnDefinitions().forEach((def) => addHeader(def.label));
    addHeader('Typ kodu');
    addHeader('Akcja');
  }

  function appendRecordRow(record) {
    addTableRow(
      record,
      (id) => {
        DataStore.remove(id);
        refreshTableVisibility(DataStore.count());
        renderRecentRecords();
      },
      (id, field, value) => { DataStore.update(id, field, value); renderRecentRecords(); }
    );
  }

  function renderRecentRecords() {
    if (!els.recentRecordList || !els.recentRecordsPanel) return;
    const records = DataStore.getAll();
    els.recentRecordList.replaceChildren();
    if (!records.length) {
      els.recentRecordsPanel.classList.add('hidden');
      return;
    }
    const recent = records.slice(-4).reverse();
    els.recentCount.textContent = String(records.length);
    recent.forEach((record) => {
      const card = document.createElement('article');
      card.className = 'recent-record';
      const top = document.createElement('div');
      top.className = 'recent-record-top';
      const person = document.createElement('strong');
      person.textContent = [record.firstName, record.lastName].filter(Boolean).join(' ') || 'Bez przypisanej osoby';
      const equipment = document.createElement('span');
      equipment.className = 'recent-equipment';
      equipment.textContent = record.categoryName || 'Sprzęt';
      top.append(person, equipment);

      const serial = document.createElement('div');
      serial.className = 'recent-serial';
      serial.textContent = record.serialNumber || record.content || 'Brak SN';

      const details = document.createElement('div');
      details.className = 'recent-extra-fields';
      getActiveColumnDefinitions()
        .filter((def) => !['firstName', 'lastName', 'categoryName', 'serialNumber'].includes(def.key) && record[def.key])
        .forEach((def) => {
          const line = document.createElement('span');
          line.textContent = `${def.label}: ${record[def.key]}`;
          details.appendChild(line);
        });

      const footer = document.createElement('div');
      footer.className = 'recent-record-footer';
      const kind = document.createElement('span');
      kind.textContent = record.type === 'Wpis ręczny' ? 'Wpis ręczny' : (record.type === 'Barcode' ? 'Kod kreskowy' : 'QR');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'recent-edit-link';
      edit.textContent = 'Edytuj';
      edit.addEventListener('click', () => {
        const row = els.tableBody.querySelector(`tr[data-id="${record.id}"]`);
        document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => row?.querySelector('.td-editable')?.focus(), 350);
      });
      footer.append(kind, edit);
      card.append(top, serial);
      if (details.childElementCount) card.append(details);
      card.append(footer);
      els.recentRecordList.appendChild(card);
    });
    els.recentRecordsPanel.classList.remove('hidden');
  }

  function updateCameraControls(capabilities = QRScanner.getControls()) {
    if (!els.cameraTools) return;
    els.torchBtn.classList.toggle('hidden', !capabilities.torch);
    els.torchBtn.disabled = !capabilities.torch;
    els.torchBtn.textContent = capabilities.torch
      ? (capabilities.torchEnabled ? 'Wyłącz latarkę' : 'Włącz latarkę')
      : 'Latarka niedostępna';
    if (capabilities.zoom) {
      els.zoomSlider.min = String(capabilities.zoom.min);
      els.zoomSlider.max = String(capabilities.zoom.max);
      els.zoomSlider.step = String(capabilities.zoom.step);
      els.zoomSlider.value = String(capabilities.zoom.value);
      els.zoomValue.textContent = `${Number(capabilities.zoom.value).toFixed(1)}×`;
      els.zoomControl.classList.remove('hidden');
    } else {
      els.zoomControl.classList.add('hidden');
    }
    els.cameraTools.classList.toggle('hidden', !capabilities.torch && !capabilities.zoom);
  }

  function hideCameraControls() {
    els.cameraTools?.classList.add('hidden');
  }

  function renderAllRows() {
    renderTableHeader();
    els.tableBody.replaceChildren();
    DataStore.getAll().forEach(appendRecordRow);
    refreshTableVisibility(DataStore.count());
    renderRecentRecords();
  }

  async function saveColumnConfiguration() {
    await Storage.setPreference(COLUMN_CONFIG_KEY, JSON.stringify({
      visibleColumnKeys,
      customColumnDefs,
    }));
  }

  function renderCustomColumnOptions() {
    els.columnOptions.replaceChildren();
    if (customColumnDefs.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'column-settings-help';
      hint.textContent = 'Nie dodano jeszcze własnych kolumn.';
      els.columnOptions.appendChild(hint);
      return;
    }

    customColumnDefs.forEach((def) => {
      const label = document.createElement('label');
      label.className = 'column-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = visibleColumnKeys.includes(def.key);
      checkbox.addEventListener('change', async () => {
        visibleColumnKeys = checkbox.checked
          ? [...new Set([...visibleColumnKeys, def.key])]
          : visibleColumnKeys.filter((key) => key !== def.key);
        await saveColumnConfiguration();
        renderAllRows();
      });
      const text = document.createElement('span');
      text.textContent = def.label;
      label.append(checkbox, text);
      els.columnOptions.appendChild(label);
    });
  }

  async function loadColumnConfiguration() {
    const raw = await Storage.getPreference(COLUMN_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        customColumnDefs = Array.isArray(config.customColumnDefs)
          ? config.customColumnDefs.filter((def) => /^custom_[a-z0-9_]+$/i.test(def.key) && typeof def.label === 'string')
          : [];
        const customKeys = new Set(customColumnDefs.map((def) => def.key));
        visibleColumnKeys = Array.isArray(config.visibleColumnKeys)
          ? [...new Set(config.visibleColumnKeys.filter((key) => customKeys.has(key)))]
          : [];
      } catch (error) {
        console.warn('Could not restore column preferences:', error);
      }
    }
    renderCustomColumnOptions();
    renderTableHeader();
  }

  async function addCustomColumn() {
    const label = els.customColumnName.value.trim();
    if (!label) {
      showToast('Wpisz nazwę nowej kolumny.', 'error');
      return;
    }
    if (customColumnDefs.some((def) => def.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      showToast('Kolumna o takiej nazwie już istnieje.', 'error');
      return;
    }
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    customColumnDefs.push({ key, label });
    visibleColumnKeys.push(key);
    els.customColumnName.value = '';
    renderCustomColumnOptions();
    await saveColumnConfiguration();
    renderAllRows();
    showToast(`Dodano kolumnę „${label}”.`, 'success');
  }

  els.addCustomColumnBtn?.addEventListener('click', addCustomColumn);
  els.customColumnName?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCustomColumn();
  });
  els.addManualScanBtn?.addEventListener('click', () => {
    const input = els.manualSerialNumber;
    const serial = input.value.trim();
    if (!serial) {
      showToast('Wpisz numer seryjny.', 'error');
      return;
    }
    if (handleDecode(serial, 'Wpis ręczny')) {
      input.value = '';
      input.focus();
    }
  });
  els.manualSerialNumber?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') els.addManualScanBtn.click();
  });
  els.newEmployeeBtn?.addEventListener('click', () => {
    QRScanner.stop();
    showCamera(false);
    setButtonState(false);
    document.getElementById('firstNameInput').value = '';
    document.getElementById('lastNameInput').value = '';
    document.getElementById('equipmentType').value = '';
    els.manualSerialNumber.value = '';
    hideCameraControls();
    setStatus('', 'Gotowy');
    document.getElementById('firstNameInput').focus();
    showToast('Formularz wyczyszczony. Zapisane pozycje pozostały w spisie.', 'info');
  });

  els.showAllRecordsBtn?.addEventListener('click', () => document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  els.torchBtn?.addEventListener('click', async () => {
    try {
      await QRScanner.setTorch(!QRScanner.getControls().torchEnabled);
      updateCameraControls(QRScanner.getControls());
    } catch (error) {
      showToast('Nie udało się włączyć latarki w tym aparacie.', 'error');
    }
  });
  els.zoomSlider?.addEventListener('change', async () => {
    try {
      await QRScanner.setZoom(els.zoomSlider.value);
      els.zoomValue.textContent = `${Number(els.zoomSlider.value).toFixed(1)}×`;
    } catch (error) {
      showToast('Ten aparat nie pozwala zmienić przybliżenia.', 'error');
    }
  });

  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  let lastDuplicateAlert = { text: '', ts: 0 };
  const DUPLICATE_ALERT_COOLDOWN_MS = 2500;

  function notifyDuplicate(text) {
    const now = Date.now();
    const stillCoolingDown =
      lastDuplicateAlert.text === text && (now - lastDuplicateAlert.ts) < DUPLICATE_ALERT_COOLDOWN_MS;
    if (stillCoolingDown) return; // same code still sitting in the camera frame — don't spam

    lastDuplicateAlert = { text, ts: now };
    triggerScanFlash();
    showToast('Ten numer jest już na liście.', 'duplicate', 2800);
  }


  /** Called every time a QR code is successfully decoded. */
  function handleDecode(text, sourceFormat) {
    if (typeof text !== 'string' || !text.trim()) return null;

    const firstNameInput = document.getElementById('firstNameInput');
    const lastNameInput = document.getElementById('lastNameInput');
    const typeInput = document.getElementById('equipmentType');
    if (!firstNameInput?.value.trim() || !lastNameInput?.value.trim() || !typeInput?.value.trim()) {
      showToast('Najpierw wpisz imię i nazwisko oraz wybierz sprzęt.', 'error');
      return null;
    }

    const record = DataStore.add(text, sourceFormat);
    if (!record) {
      notifyDuplicate(text);
      return null;
    }

    triggerScanFlash();

    appendRecordRow(record);
    refreshTableVisibility(DataStore.count());
    renderRecentRecords();

    setStatus('success', `${sourceFormat || 'Kod'}: ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`);
    showToast(`${sourceFormat === 'Wpis ręczny' ? 'Dodano SN' : `Odczytano ${sourceFormat === 'Barcode' ? 'kod kreskowy' : (sourceFormat || 'kod')}`}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`, 'success');

    // Briefly flash the status back to scanning after 2s if in camera mode
    if (els.tabCameraMode.classList.contains('active') && els.startBtn.disabled) {
      setTimeout(() => setStatus('scanning', 'Skanowanie aktywne'), 2000);
    } else {
      setTimeout(() => setStatus('', 'Gotowy'), 2000);
    }

    return record;
  }

  // ── Handle App Backgrounding (prevents frozen camera on resume) ────
  let wasScanningBeforeBackground = false;

  document.addEventListener('visibilitychange', () => {
    const cameraCurrentlyActive =
      els.tabCameraMode.classList.contains('active') && els.startBtn.disabled;

    if (document.visibilityState === 'hidden') {
      if (cameraCurrentlyActive) {
        // Android can suspend or revoke the camera stream while backgrounded,
        // which leaves the video frozen on its last frame on return.
        // Releasing it cleanly now lets us re-acquire a fresh stream instead
        // of fighting a stale one.
        wasScanningBeforeBackground = true;
        QRScanner.stop();
        hideCameraControls();
        showCamera(false);
        setButtonState(false);
        setStatus('', 'Paused');
      }
    } else if (document.visibilityState === 'visible' && wasScanningBeforeBackground) {
      wasScanningBeforeBackground = false;
      setStatus('scanning', 'Wznawiam aparat…');
      QRScanner.start(handleDecode)
        .then((controls) => {
          updateCameraControls(controls);
          showCamera(true);
          setButtonState(true);
          setStatus('scanning', 'Skanowanie aktywne');
        })
        .catch((err) => {
          setStatus('error', err.message);
          showToast(err.message, 'error', 5000);
        });
    }
  });

  // ── Permission Modal Events ────────────────────────────────────────
  if (els.grantAccessBtn) {
    els.grantAccessBtn.addEventListener('click', async () => {
      hidePermissionModal();
      setStatus('scanning', 'Uruchamiam aparat…');
      try {
        const controls = await QRScanner.start(handleDecode);
        updateCameraControls(controls);
        showCamera(true);
        setButtonState(true);
        setStatus('scanning', 'Skanowanie aktywne');
      } catch (err) {
        setStatus('error', err.message);
        showToast(err.message, 'error', 5000);
      }
    });
  }

  if (els.skipAccessBtn) {
    els.skipAccessBtn.addEventListener('click', () => {
      hidePermissionModal();
      switchTab('gallery');
    });
  }

  // ── Tab Switching ──────────────────────────────────────────────────
  els.tabCameraMode.addEventListener('click', () => {
    switchTab('camera');
    setStatus('', 'Gotowy');
  });

  els.tabGalleryMode.addEventListener('click', () => {
    // Stop camera stream if active
    QRScanner.stop();
    hideCameraControls();
    showCamera(false);
    setButtonState(false);
    switchTab('gallery');
    setStatus('', 'Gotowy');
  });

  // ── Start Camera ───────────────────────────────────────────────────
  els.startBtn.addEventListener('click', async () => {
    setStatus('scanning', 'Uruchamiam aparat…');
    try {
      const controls = await QRScanner.start(handleDecode);
      updateCameraControls(controls);
      showCamera(true);
      setButtonState(true);
      setStatus('scanning', 'Skanowanie aktywne');
    } catch (err) {
      setStatus('error', err.message);
      showToast(err.message, 'error', 5000);
    }
  });

  // ── Stop Camera ────────────────────────────────────────────────────
  els.stopBtn.addEventListener('click', () => {
    QRScanner.stop();
    showCamera(false);
    setButtonState(false);
    hideCameraControls();
    setStatus('', 'Gotowy');
  });

  // ── Upload Image Events & Drag-and-Drop ────────────────────────────
  els.browseGalleryBtn.addEventListener('click', () => els.fileInput.click());

  // Helper to process and scan image file
  function processAndScanFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select or drop a valid image file.', 'error');
      return;
    }

    setStatus('', 'Processing image…');

    const reader = new FileReader();
    reader.onload = (e) => {
      // Display the preview image in the viewport
      showGalleryPreview(e.target.result);

      // Perform full-image scan immediately
      QRScanner.decodeFromFile(
        file,
        (text, sourceFormat) => {
          const record = handleDecode(text, sourceFormat);
          if (record) {
            setStatus('success', sourceFormat === 'Barcode' ? 'Barcode read from image.' : 'QR code read from image.');
            showToast(sourceFormat === 'Barcode' ? 'Barcode read successfully!' : 'QR code read successfully!', 'success');
          } else {
            setStatus('', 'Gotowy');
          }
        },
        (errMsg) => {
          setStatus('error', errMsg);
          showToast(errMsg, 'error', 4500);
        }
      );
    };
    reader.readAsDataURL(file);
  }

  // Handle file input selection
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processAndScanFile(file);
    }
  });

  // Drag and Drop event handling on the dropzone
  const dropzone = els.uploadDropzone;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
      processAndScanFile(file);
    }
  }, false);

  // Clear photo preview
  els.removePhotoBtn.addEventListener('click', () => {
    clearGalleryPreview();
    setStatus('', 'Gotowy');
  });

  // ── Clear All ──────────────────────────────────────────────────────
  els.clearAllBtn.addEventListener('click', () => {
    DataStore.clear();
    els.tableBody.innerHTML = '';
    refreshTableVisibility(0);
    renderRecentRecords();
    showToast('Wyczyszczono spis.', 'info');
  });

  // ── Export Choice Flow ─────────────────────────────────────────────
  let pendingExport = null; // 'csv' | 'pdf'

  const EXPORT_FORMAT_LABELS = {
    csv: 'Export CSV',
    pdf: 'Export PDF',
    xlsx: 'Export Excel',
    json: 'Export JSON',
    xml: 'Export XML',
  };

  function openExportChoice(format) {
    if (DataStore.count() === 0) {
      showToast('No data to export. Scan some QR codes first!', 'error');
      return;
    }
    pendingExport = format;
    els.exportChoiceTitle.textContent = EXPORT_FORMAT_LABELS[format] || 'Export Data';
    els.exportChoiceModal.classList.remove('hidden');
  }

  function closeExportChoice() {
    pendingExport = null;
    els.exportChoiceModal.classList.add('hidden');
  }

  function prepareExportPayload(format) {
    const records = DataStore.getAll();
    if (format === 'csv') {
      const { filename, content, contentType } = Exporter.buildCSV(records);
      return { filename, contentType, base64Data: utf8ToBase64(content) };
    }
    if (format === 'json') {
      const { filename, content, contentType } = Exporter.buildJSON(records);
      return { filename, contentType, base64Data: utf8ToBase64(content) };
    }
    if (format === 'xml') {
      const { filename, content, contentType } = Exporter.buildXML(records);
      return { filename, contentType, base64Data: utf8ToBase64(content) };
    }
    if (format === 'xlsx') {
      if (typeof XLSX === 'undefined') {
        showToast('XLSX library not bundled yet — see setup notes.', 'error', 4500);
        return null;
      }
      return Exporter.buildXLSX(records);
    }
    if (!window.jspdf) {
      showToast('PDF library not loaded. Check your internet connection.', 'error');
      return null;
    }
    const { filename, doc, contentType } = Exporter.buildPDF(records);
    return { filename, contentType, base64Data: doc.output('datauristring') };
  }

  els.exportCsvBtn.addEventListener('click', () => openExportChoice('csv'));
  els.exportPdfBtn.addEventListener('click', () => openExportChoice('pdf'));
  els.exportXlsxBtn.addEventListener('click', () => openExportChoice('xlsx'));
  els.exportXmlBtn.addEventListener('click', () => openExportChoice('xml'));
  els.exportJsonBtn.addEventListener('click', () => openExportChoice('json'));
  els.exportCancelBtn.addEventListener('click', closeExportChoice);

  els.exportSaveBtn.addEventListener('click', async () => {
    const format = pendingExport;
    closeExportChoice();
    const payload = prepareExportPayload(format);
    if (!payload) return;
    try {
      await FileExport.save(payload);
      showToast(`Saved to Downloads: ${payload.filename}`, 'success');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    }
  });

  els.exportShareBtn.addEventListener('click', async () => {
    const format = pendingExport;
    closeExportChoice();
    const payload = prepareExportPayload(format);
    if (!payload) return;
    try {
      await FileExport.share(payload);
    } catch (err) {
      showToast(`Share failed: ${err.message}`, 'error');
    }
  });

    // ── Webhook Export Flow ────────────────────────────────────────────
  const WEBHOOK_URL_KEY = 'assetsnap-webhook-url';

  async function openWebhookModal() {
    if (DataStore.count() === 0) {
      showToast('No data to send. Scan some QR codes first!', 'error');
      return;
    }
    const savedUrl = await Storage.getPreference(WEBHOOK_URL_KEY);
    els.webhookUrlInput.value = savedUrl || '';
    els.webhookModal.classList.remove('hidden');
  }

  function closeWebhookModal() {
    els.webhookModal.classList.add('hidden');
  }

  els.exportWebhookBtn.addEventListener('click', openWebhookModal);
  els.webhookCancelBtn.addEventListener('click', closeWebhookModal);

  els.webhookSendBtn.addEventListener('click', async () => {
    const url = els.webhookUrlInput.value.trim();
    if (!url) {
      showToast('Enter a webhook URL first.', 'error');
      return;
    }
    closeWebhookModal();
    await Storage.setPreference(WEBHOOK_URL_KEY, url);

    const records = DataStore.getAll();
    const { content } = Exporter.buildJSON(records);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      showToast(`Sent ${records.length} record${records.length === 1 ? '' : 's'} to webhook.`, 'success');
    } catch (err) {
      showToast(`Webhook send failed: ${err.message}`, 'error', 5000);
    }
  });

  // ── Initial UI State / Restore Previous Session ─────────────────────
  (async () => {
    setStatus('', 'Loading saved scans…');
    await loadColumnConfiguration();
    const restored = await DataStore.init();

    restored.forEach(appendRecordRow);

    refreshTableVisibility(DataStore.count());
    renderRecentRecords();
    setStatus('', 'Gotowy');

    if (restored.length > 0) {
      showToast(
        `Restored ${restored.length} scan${restored.length === 1 ? '' : 's'} from your last session.`,
        'info',
        3800
      );
    }
  })();

})();
