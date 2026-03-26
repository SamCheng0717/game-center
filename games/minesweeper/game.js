// games/minesweeper/game.js

export const MODES = Object.freeze({ REVEAL: 'reveal', FLAG: 'flag', QUESTION: 'question' });
export const STATES = Object.freeze({ IDLE: 'idle', PLAYING: 'playing', WON: 'won', LOST: 'lost' });

export class MinesweeperGame {
  constructor(rows, cols, mineCount) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mineCount;
    this.state = STATES.IDLE;
    this.mode  = MODES.REVEAL;
    this.cursor = -1; // 位置模式光标索引，-1 = 无
    this.elapsed = 0; // 已用秒数
    this._timerInterval = null;
    this._firstClick = true;
    this._minesReady = false;
    this.cells = Array.from({ length: rows * cols }, () => ({
      mine: false, revealed: false, flagged: false, questioned: false, neighborCount: 0
    }));
  }

  // === 索引/坐标转换 ===
  idx(r, c) { return r * this.cols + c; }
  row(i) { return Math.floor(i / this.cols); }
  col(i) { return i % this.cols; }

  getNeighborIndices(i) {
    const r = this.row(i), c = this.col(i);
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          result.push(this.idx(nr, nc));
        }
      }
    }
    return result;
  }

  // === 地雷生成 ===
  _placeMines(safeIdx) {
    const safeSet = new Set([safeIdx, ...this.getNeighborIndices(safeIdx)]);
    const candidates = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (!safeSet.has(i)) candidates.push(i);
    }

    // Generate-and-Test：最多尝试 MAX_ATTEMPTS 次，找到"纯逻辑可解"的布局
    const MAX_ATTEMPTS = 100;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Fisher-Yates shuffle
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      // 重置并放置地雷
      this.cells.forEach(c => { c.mine = false; });
      candidates.slice(0, this.mineCount).forEach(i => { this.cells[i].mine = true; });
      this._calcNeighbors();
      // 最后一次不管可解与否都直接用
      if (attempt === MAX_ATTEMPTS - 1 || this._isSolvable(safeIdx)) break;
    }

    this._minesReady = true;
  }

  /**
   * 约束传播求解器：从 firstIdx 开始模拟推理，判断棋盘是否无需猜测即可解完。
   * 算法：BFS 展开空格 → 反复应用两条约束规则直到无新推断：
   *   1. 剩余雷数 == 0 → 所有未知邻格安全
   *   2. 剩余雷数 == 未知邻格数 → 所有未知邻格是雷
   */
  _isSolvable(firstIdx) {
    const N = this.cells.length;
    // 0 = 未知, 1 = 已知安全, 2 = 已知是雷
    const st = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (this.cells[i].mine) st[i] = 2;

    // 迭代 BFS 揭开安全格（模拟空格自动展开）
    const revealBFS = (start) => {
      if (st[start] !== 0) return;
      const q = [start];
      st[start] = 1;
      let h = 0;
      while (h < q.length) {
        const cur = q[h++];
        if (this.cells[cur].neighborCount === 0) {
          for (const j of this.getNeighborIndices(cur)) {
            if (st[j] === 0) { st[j] = 1; q.push(j); }
          }
        }
      }
    };

    revealBFS(firstIdx);

    // 约束传播：反复扫描直到无新推断
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (st[i] !== 1) continue;
        const nb = this.getNeighborIndices(i);
        let unknown = 0, mines = 0;
        for (const j of nb) {
          if (st[j] === 0) unknown++;
          else if (st[j] === 2) mines++;
        }
        if (unknown === 0) continue;
        const rem = this.cells[i].neighborCount - mines;
        if (rem === 0) {
          for (const j of nb) if (st[j] === 0) { revealBFS(j); changed = true; }
        } else if (rem === unknown) {
          for (const j of nb) if (st[j] === 0) { st[j] = 2; changed = true; }
        }
      }
    }

    for (let i = 0; i < N; i++) if (st[i] === 0) return false;
    return true;
  }

  /** 测试专用：手动指定地雷位置
   *  ⚠️ 仅在 /tests/ 路径下调用，生产游戏 UI 中严禁使用
   */
  _placeMinesManual(mineIndices) {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/tests/')) {
      throw new Error('_placeMinesManual is for testing only');
    }
    mineIndices.forEach(i => { this.cells[i].mine = true; });
    this._calcNeighbors();
    this._minesReady = true;
    if (this.state === STATES.IDLE) this.state = STATES.PLAYING;
  }

  _calcNeighbors() {
    this.cells.forEach((cell, i) => {
      if (cell.mine) return;
      cell.neighborCount = this.getNeighborIndices(i).filter(j => this.cells[j].mine).length;
    });
  }

  // === 游戏动作 ===
  reveal(i) {
    if (this.state === STATES.WON || this.state === STATES.LOST) return;
    if (this.cells[i].flagged) return;

    if (this._firstClick) {
      this._firstClick = false;
      this.state = STATES.PLAYING;
      if (!this._minesReady) this._placeMines(i);
      this._startTimer();
    }

    if (this.cells[i].revealed) {
      // 已揭开格子：若周围旗帜数等于 neighborCount，自动揭开周围未旗格（和弦操作）
      const neighbors = this.getNeighborIndices(i);
      const flagCount = neighbors.filter(j => this.cells[j].flagged).length;
      if (flagCount === this.cells[i].neighborCount) {
        neighbors.forEach(j => { if (!this.cells[j].flagged) this._revealOne(j); });
      }
      return;
    }

    this._revealOne(i);
  }

  _revealOne(i) {
    if (this.cells[i].revealed || this.cells[i].flagged) return;
    this.cells[i].revealed = true;
    this.cells[i].questioned = false;

    if (this.cells[i].mine) {
      this.state = STATES.LOST;
      this._stopTimer();
      this._revealAllMines();
      return;
    }

    if (this.cells[i].neighborCount === 0) {
      this._bfsReveal(i);
    }

    this._checkWin();
  }

  /** 迭代 BFS 展开（避免 64x64 时栈溢出）*/
  _bfsReveal(startIdx) {
    const queue = [startIdx];
    const visited = new Set([startIdx]);
    while (queue.length > 0) {
      const curr = queue.shift();
      this.getNeighborIndices(curr).forEach(j => {
        if (visited.has(j) || this.cells[j].revealed || this.cells[j].flagged || this.cells[j].mine) return;
        visited.add(j);
        this.cells[j].revealed = true;
        if (this.cells[j].neighborCount === 0) queue.push(j);
      });
    }
  }

  _revealAllMines() {
    this.cells.forEach(cell => { if (cell.mine) cell.revealed = true; });
  }

  _checkWin() {
    const allNonMinesRevealed = this.cells.every(c => c.mine || c.revealed);
    if (allNonMinesRevealed) {
      this.state = STATES.WON;
      this._stopTimer();
      // 胜利时自动标记所有地雷
      this.cells.forEach(c => { if (c.mine) c.flagged = true; });
    }
  }

  toggleFlag(i) {
    if (this.state !== STATES.PLAYING) return;
    if (this.cells[i].revealed) return;
    if (!this.cells[i].flagged && this.remainingMines <= 0) return; // 旗帜数量上限
    this.cells[i].flagged = !this.cells[i].flagged;
    if (this.cells[i].flagged) this.cells[i].questioned = false;
  }

  toggleQuestion(i) {
    if (this.state !== STATES.PLAYING) return;
    if (this.cells[i].revealed || this.cells[i].flagged) return;
    this.cells[i].questioned = !this.cells[i].questioned;
  }

  setMode(mode) { this.mode = mode; }
  setCursor(i) { this.cursor = i; }

  // === 计时器 ===
  _startTimer() {
    if (this._timerInterval !== null) return; // 防止重复启动
    this._timerInterval = setInterval(() => { this.elapsed++; }, 1000);
  }
  _stopTimer() {
    clearInterval(this._timerInterval);
    this._timerInterval = null;
  }
  /** 从持久化恢复后调用，仅在 PLAYING 状态下恢复计时 */
  resumeTimer() { if (this.state === STATES.PLAYING) this._startTimer(); }

  // === 计算属性 ===
  get remainingMines() {
    return this.mineCount - this.cells.filter(c => c.flagged).length;
  }

  // === 持久化 ===
  toJSON() {
    return JSON.stringify({
      rows: this.rows, cols: this.cols, mineCount: this.mineCount,
      state: this.state, mode: this.mode, cursor: this.cursor,
      elapsed: this.elapsed, firstClick: this._firstClick,
      minesReady: this._minesReady,
      cells: this.cells
    });
  }

  static fromJSON(json) {
    const d = JSON.parse(json);
    const g = new MinesweeperGame(d.rows, d.cols, d.mineCount);
    g.state = d.state; g.mode = d.mode; g.cursor = d.cursor;
    g.elapsed = d.elapsed; g._firstClick = d.firstClick;
    g._minesReady = d.minesReady; g.cells = d.cells;
    return g;
  }

  reset() {
    this._stopTimer();
    this.cells = Array.from({ length: this.rows * this.cols }, () => ({
      mine: false, revealed: false, flagged: false, questioned: false, neighborCount: 0
    }));
    this.state = STATES.IDLE; this.mode = MODES.REVEAL;
    this.cursor = -1; this.elapsed = 0;
    this._firstClick = true; this._minesReady = false;
  }
}
