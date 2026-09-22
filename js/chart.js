/**
 * ==============================================================================
 * MAESTRO COOLER - REALTIME TEMPERATURE CHART
 * Lightweight zero-dependency Canvas chart for rendering cold plate thermal trend.
 * High-DPI crisp rendering, neon cyan gradient curve, and dynamic auto-scaling.
 * ==============================================================================
 */

export class TemperatureChart {
  /**
   * @param {HTMLCanvasElement} canvasElement 
   * @param {number} maxDataPoints 
   */
  constructor(canvasElement, maxDataPoints = 30) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.maxDataPoints = maxDataPoints;
    this.data = []; // Array of { temp: number, time: string, timestamp: number }

    this._initCanvas();
    window.addEventListener('resize', () => this._handleResize());
  }

  _initCanvas() {
    this._handleResize();
  }

  _handleResize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.width = rect.width || 320;
    this.height = rect.height || 140;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  /**
   * Add a new temperature reading and re-render.
   * @param {number} tempCelsius 
   */
  addReading(tempCelsius) {
    if (typeof tempCelsius !== 'number' || isNaN(tempCelsius)) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    this.data.push({
      temp: tempCelsius,
      time: timeStr,
      timestamp: Date.now()
    });

    if (this.data.length > this.maxDataPoints) {
      this.data.shift();
    }

    this.render();
  }

  /**
   * Clear all recorded data points.
   */
  reset() {
    this.data = [];
    this.render();
  }

  /**
   * Get min, max, avg statistics.
   */
  getStats() {
    if (this.data.length === 0) {
      return { min: null, max: null, avg: null, count: 0 };
    }
    const temps = this.data.map(d => d.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const sum = temps.reduce((acc, v) => acc + v, 0);
    const avg = sum / temps.length;

    return {
      min: min.toFixed(1),
      max: max.toFixed(1),
      avg: avg.toFixed(1),
      count: temps.length
    };
  }

  /**
   * Render chart with neon glowing curve and grid.
   */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear background
    ctx.clearRect(0, 0, w, h);

    const padLeft = 32;
    const padRight = 14;
    const padTop = 14;
    const padBottom = 22;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    if (this.data.length < 2) {
      // Draw idle placeholder message
      ctx.fillStyle = '#4a5568';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.data.length === 1 ? 'Merekam data...' : 'Menunggu data telemetri...', w / 2, h / 2);
      return;
    }

    // Determine scale
    const temps = this.data.map(d => d.temp);
    let minTemp = Math.min(...temps);
    let maxTemp = Math.max(...temps);

    // Add padding to range
    if (maxTemp - minTemp < 4) {
      minTemp = Math.floor(minTemp - 2);
      maxTemp = Math.ceil(maxTemp + 2);
    } else {
      minTemp = Math.floor(minTemp - 1);
      maxTemp = Math.ceil(maxTemp + 1);
    }

    const tempRange = maxTemp - minTemp;

    // 1. Draw subtle horizontal grid lines and Y-axis labels
    const gridSteps = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = minTemp + (tempRange * (i / gridSteps));
      const yPos = padTop + plotH - (plotH * (i / gridSteps));

      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();

      ctx.fillText(`${Math.round(yVal)}°`, padLeft - 6, yPos);
    }

    // 2. Map data points to coordinates
    const points = this.data.map((d, i) => {
      const x = padLeft + (plotW * (i / (this.maxDataPoints - 1)));
      const normY = (d.temp - minTemp) / tempRange;
      const y = padTop + plotH - (plotH * Math.min(1, Math.max(0, normY)));
      return { x, y, temp: d.temp };
    });

    // 3. Draw gradient area fill under the curve
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
    gradient.addColorStop(0.7, 'rgba(0, 162, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 162, 255, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padTop + plotH);
    ctx.lineTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + curr.y) / 2);
    }
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(lastPoint.x, padTop + plotH);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // 4. Draw glowing stroke line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + curr.y) / 2);
    }
    ctx.lineTo(lastPoint.x, lastPoint.y);

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // 5. Draw pulse highlight circle on latest point
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 6.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}
