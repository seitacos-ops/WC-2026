import { useState, useCallback, useEffect, useRef } from 'react'
import { dbLoad, dbSave, dbSubscribe } from './firebase'

// ── Stadium Audio Engine ─────────────────────────────────
class StadiumAudio {
  constructor() {
    this.ctx = null
    this.playing = false
    this.nodes = []
    this.volume = 0.5
  }

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  master() {
    const g = this.ctx.createGain()
    g.gain.value = this.volume
    g.connect(this.ctx.destination)
    return g
  }

  // ── ホワイトノイズ（群衆のざわめき）
  crowd(duration = 999) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.18
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lpf = this.ctx.createBiquadFilter()
    lpf.type = 'lowpass'; lpf.frequency.value = 800
    const hpf = this.ctx.createBiquadFilter()
    hpf.type = 'highpass'; hpf.frequency.value = 120
    const gain = this.ctx.createGain()
    gain.gain.value = 1
    // うねり（波打つ感じ）
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.12; lfoGain.gain.value = 0.3
    lfo.connect(lfoGain); lfoGain.connect(gain.gain)
    lfo.start()
    src.connect(hpf); hpf.connect(lpf); lpf.connect(gain); gain.connect(this.master())
    src.start()
    this.nodes.push(src, lfo)
    return src
  }

  // ── チャント（繰り返しリズム）
  chant() {
    const freqs = [220, 220, 330, 220, 165]
    const times = [0, 0.5, 1.0, 1.5, 2.2]
    const repeat = () => {
      if (!this.playing) return
      freqs.forEach((f, i) => {
        const t = this.ctx.currentTime + times[i]
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'; osc.frequency.value = f
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.06, t + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
        osc.connect(gain); gain.connect(this.master())
        osc.start(t); osc.stop(t + 0.4)
      })
      this.chantTimer = setTimeout(repeat, 3200)
    }
    repeat()
  }

  // ── ドラム（ビート）
  drum() {
    const kick = (t) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.frequency.setValueAtTime(160, t)
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.15)
      gain.gain.setValueAtTime(0.5, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.connect(gain); gain.connect(this.master())
      osc.start(t); osc.stop(t + 0.35)
    }
    const snare = (t) => {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05))
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      const gain = this.ctx.createGain(); gain.gain.value = 0.18
      src.connect(gain); gain.connect(this.master())
      src.start(t)
    }
    const pattern = () => {
      if (!this.playing) return
      const now = this.ctx.currentTime
      const bpm = 128; const beat = 60 / bpm
      kick(now); kick(now + beat * 2)
      snare(now + beat); snare(now + beat * 3)
      this.drumTimer = setTimeout(pattern, beat * 4 * 1000)
    }
    pattern()
  }

  // ── 優勝ファンファーレ（結果ページ）
  fanfare() {
    this.init()
    // 歓声
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const env = Math.min(i / (this.ctx.sampleRate * 0.3), 1) * Math.exp(-i / (this.ctx.sampleRate * 0.8))
      d[i] = (Math.random() * 2 - 1) * env * 0.5
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf
    const gain = this.ctx.createGain(); gain.gain.value = 1
    src.connect(gain); gain.connect(this.ctx.destination); src.start()
    // ファンファーレ旋律（勝利っぽいメロディ）
    const melody = [
      [523,0],[523,0.2],[523,0.4],[659,0.6],[784,0.9],
      [784,1.1],[784,1.3],[1047,1.6],[784,2.0],[659,2.3],[523,2.7]
    ]
    melody.forEach(([freq, when]) => {
      const t = this.ctx.currentTime + when
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc.connect(g); g.connect(this.ctx.destination)
      osc.start(t); osc.stop(t + 0.4)
    })
    this.whistle(0); this.whistle(0.5)
  }

  // ── 大歓声（優勝確定）
  bigRoar() {
    this.init()
    // 巨大な歓声
    for (let wave = 0; wave < 3; wave++) {
      const delay = wave * 0.8
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        const env = Math.min(i / (this.ctx.sampleRate * 0.15), 1) * Math.exp(-i / (this.ctx.sampleRate * (1.5 + wave * 0.3)))
        d[i] = (Math.random() * 2 - 1) * env * (0.8 - wave * 0.1)
      }
      const src = this.ctx.createBufferSource(); src.buffer = buf
      const lpf = this.ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1400
      const gain = this.ctx.createGain(); gain.gain.value = 1
      src.connect(lpf); lpf.connect(gain); gain.connect(this.ctx.destination)
      src.start(this.ctx.currentTime + delay)
    }
    // ホイッスル5連発
    [0, 0.5, 1.0, 2.2, 2.8].forEach(t => this.whistle(t))
    // ファンファーレ的な音
    const fanfareNotes = [523, 659, 784, 1047, 784, 1047]
    const fanfareTimes = [1.5, 1.7, 1.9, 2.1, 2.4, 2.6]
    fanfareNotes.forEach((freq, i) => {
      const t = this.ctx.currentTime + fanfareTimes[i]
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.15, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(gain); gain.connect(this.ctx.destination)
      osc.start(t); osc.stop(t + 0.4)
    })
  }

  // ── ホイッスル
  whistle(when = 0) {
    const t = this.ctx.currentTime + when
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'; osc.frequency.value = 2600
    osc.frequency.setValueAtTime(2600, t)
    osc.frequency.linearRampToValueAtTime(2800, t + 0.08)
    osc.frequency.linearRampToValueAtTime(2500, t + 0.35)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
    gain.gain.setValueAtTime(0.22, t + 0.25)
    gain.gain.linearRampToValueAtTime(0, t + 0.45)
    osc.connect(gain); gain.connect(this.master())
    osc.start(t); osc.stop(t + 0.5)
  }

  // ── 歓声（ゴール！）
  roar() {
    this.init()
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2.5, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const env = Math.min(i / (this.ctx.sampleRate * 0.2), 1) * Math.exp(-i / (this.ctx.sampleRate * 1.2))
      d[i] = (Math.random() * 2 - 1) * env * 0.7
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf
    const lpf = this.ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1200
    const gain = this.ctx.createGain(); gain.gain.value = 1
    src.connect(lpf); lpf.connect(gain); gain.connect(this.master())
    src.start()
    // ホイッスル × 3
    this.whistle(0); this.whistle(0.6); this.whistle(1.1)
  }

  start() {
    this.init()
    if (this.playing) return
    this.playing = true
    this._everStarted = true
    this.crowd()
    setTimeout(() => { if (this.playing) this.chant() }, 800)
    setTimeout(() => { if (this.playing) this.drum() }, 400)
  }

  stop() {
    this.playing = false
    clearTimeout(this.chantTimer)
    clearTimeout(this.drumTimer)
    this.nodes.forEach(n => { try { n.stop() } catch {} })
    this.nodes = []
  }

  setVolume(v) {
    this.volume = v
  }
}

const stadiumAudio = new StadiumAudio()

// ── Audio Player Component ────────────────────────────────
function AudioPlayer() {
  const [on, setOn] = useState(false)
  const [vol, setVol] = useState(0.5)
  const [showVol, setShowVol] = useState(false)

  const toggle = () => {
    if (on) {
      stadiumAudio.stop()
      setOn(false)
    } else {
      stadiumAudio.start()
      setOn(true)
    }
  }

  const changeVol = (v) => {
    setVol(v)
    stadiumAudio.setVolume(v)
  }

  const goal = () => stadiumAudio.roar()

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {/* ボリュームスライダー */}
      {showVol && on && (
        <div style={{
          background: 'rgba(13,21,38,0.95)', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 14, padding: '12px 14px', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '.08em', fontWeight: 600 }}>🔊 VOLUME</div>
          <input type="range" min="0" max="1" step="0.05" value={vol}
            onChange={e => changeVol(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }}
          />
          <button onClick={goal} style={{
            background: 'linear-gradient(135deg,var(--gold),var(--gold2))', border: 'none',
            borderRadius: 8, padding: '7px', cursor: 'pointer', fontSize: 13,
            fontFamily: 'inherit', fontWeight: 700, color: '#0a0a0a',
          }}>⚽ GOAL！歓声</button>
        </div>
      )}

      {/* メインボタン */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {on && (
          <button onClick={() => setShowVol(!showVol)} style={{
            width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(0,212,255,0.3)',
            background: 'rgba(13,21,38,0.9)', color: 'var(--blue)', cursor: 'pointer',
            fontSize: 16, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🎚️</button>
        )}
        <button onClick={toggle} style={{
          width: 52, height: 52, borderRadius: '50%', border: `2px solid ${on ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
          background: on ? 'rgba(255,215,0,0.15)' : 'rgba(13,21,38,0.9)',
          color: on ? 'var(--gold)' : 'var(--text2)', cursor: 'pointer',
          fontSize: 22, backdropFilter: 'blur(8px)', transition: 'all .25s',
          boxShadow: on ? '0 0 24px rgba(255,215,0,0.3)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {on ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  )
}

// ── Admin password ────────────────────────────────────────
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Samuraiblue'

// ── Teams: WC 2026 official 48 nations ───────────────────
const TEAMS = [
  { id:'MEX', name:'メキシコ',              en:'Mexico',         flag:'🇲🇽', region:'グループA' },
  { id:'RSA', name:'南アフリカ',            en:'South Africa',   flag:'🇿🇦', region:'グループA' },
  { id:'KOR', name:'韓国',                  en:'South Korea',    flag:'🇰🇷', region:'グループA' },
  { id:'CZE', name:'チェコ',               en:'Czech Republic', flag:'🇨🇿', region:'グループA' },
  { id:'CAN', name:'カナダ',               en:'Canada',         flag:'🇨🇦', region:'グループB' },
  { id:'BIH', name:'ボスニア・ヘルツェゴビナ',en:'Bosnia & Herz.',flag:'🇧🇦', region:'グループB' },
  { id:'QAT', name:'カタール',             en:'Qatar',          flag:'🇶🇦', region:'グループB' },
  { id:'SUI', name:'スイス',               en:'Switzerland',    flag:'🇨🇭', region:'グループB' },
  { id:'BRA', name:'ブラジル',             en:'Brazil',         flag:'🇧🇷', region:'グループC' },
  { id:'MAR', name:'モロッコ',             en:'Morocco',        flag:'🇲🇦', region:'グループC' },
  { id:'HAI', name:'ハイチ',               en:'Haiti',          flag:'🇭🇹', region:'グループC' },
  { id:'SCO', name:'スコットランド',       en:'Scotland',       flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', region:'グループC' },
  { id:'USA', name:'アメリカ',             en:'United States',  flag:'🇺🇸', region:'グループD' },
  { id:'PAR', name:'パラグアイ',           en:'Paraguay',       flag:'🇵🇾', region:'グループD' },
  { id:'AUS', name:'オーストラリア',       en:'Australia',      flag:'🇦🇺', region:'グループD' },
  { id:'TUR', name:'トルコ',               en:'Türkiye',        flag:'🇹🇷', region:'グループD' },
  { id:'GER', name:'ドイツ',               en:'Germany',        flag:'🇩🇪', region:'グループE' },
  { id:'CUW', name:'キュラソー',           en:'Curaçao',        flag:'🇨🇼', region:'グループE' },
  { id:'CIV', name:'コートジボワール',     en:'Ivory Coast',    flag:'🇨🇮', region:'グループE' },
  { id:'ECU', name:'エクアドル',           en:'Ecuador',        flag:'🇪🇨', region:'グループE' },
  { id:'NED', name:'オランダ',             en:'Netherlands',    flag:'🇳🇱', region:'グループF' },
  { id:'JPN', name:'日本',                 en:'Japan',          flag:'🇯🇵', region:'グループF' },
  { id:'SWE', name:'スウェーデン',         en:'Sweden',         flag:'🇸🇪', region:'グループF' },
  { id:'TUN', name:'チュニジア',           en:'Tunisia',        flag:'🇹🇳', region:'グループF' },
  { id:'BEL', name:'ベルギー',             en:'Belgium',        flag:'🇧🇪', region:'グループG' },
  { id:'EGY', name:'エジプト',             en:'Egypt',          flag:'🇪🇬', region:'グループG' },
  { id:'IRN', name:'イラン',               en:'Iran',           flag:'🇮🇷', region:'グループG' },
  { id:'NZL', name:'ニュージーランド',     en:'New Zealand',    flag:'🇳🇿', region:'グループG' },
  { id:'ESP', name:'スペイン',             en:'Spain',          flag:'🇪🇸', region:'グループH' },
  { id:'CPV', name:'カーボベルデ',         en:'Cape Verde',     flag:'🇨🇻', region:'グループH' },
  { id:'KSA', name:'サウジアラビア',       en:'Saudi Arabia',   flag:'🇸🇦', region:'グループH' },
  { id:'URU', name:'ウルグアイ',           en:'Uruguay',        flag:'🇺🇾', region:'グループH' },
  { id:'FRA', name:'フランス',             en:'France',         flag:'🇫🇷', region:'グループI' },
  { id:'SEN', name:'セネガル',             en:'Senegal',        flag:'🇸🇳', region:'グループI' },
  { id:'IRQ', name:'イラク',               en:'Iraq',           flag:'🇮🇶', region:'グループI' },
  { id:'NOR', name:'ノルウェー',           en:'Norway',         flag:'🇳🇴', region:'グループI' },
  { id:'ARG', name:'アルゼンチン',         en:'Argentina',      flag:'🇦🇷', region:'グループJ' },
  { id:'ALG', name:'アルジェリア',         en:'Algeria',        flag:'🇩🇿', region:'グループJ' },
  { id:'AUT', name:'オーストリア',         en:'Austria',        flag:'🇦🇹', region:'グループJ' },
  { id:'JOR', name:'ヨルダン',             en:'Jordan',         flag:'🇯🇴', region:'グループJ' },
  { id:'POR', name:'ポルトガル',           en:'Portugal',       flag:'🇵🇹', region:'グループK' },
  { id:'COD', name:'コンゴ民主共和国',     en:'DR Congo',       flag:'🇨🇩', region:'グループK' },
  { id:'UZB', name:'ウズベキスタン',       en:'Uzbekistan',     flag:'🇺🇿', region:'グループK' },
  { id:'COL', name:'コロンビア',           en:'Colombia',       flag:'🇨🇴', region:'グループK' },
  { id:'ENG', name:'イングランド',         en:'England',        flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', region:'グループL' },
  { id:'CRO', name:'クロアチア',           en:'Croatia',        flag:'🇭🇷', region:'グループL' },
  { id:'GHA', name:'ガーナ',               en:'Ghana',          flag:'🇬🇭', region:'グループL' },
  { id:'PAN', name:'パナマ',               en:'Panama',         flag:'🇵🇦', region:'グループL' },
]


// ── Squad Data ───────────────────────────────────────────
const SQUADS = {
  MEX: [
    {pos:'GK',name:'ギジェルモ・オチョア',club:'AELリマソル'},{pos:'GK',name:'アレックス・パディージャ',club:'アスレティック・ビルバオ'},{pos:'GK',name:'ラウール・ランヘル',club:'グアダラハラ'},
    {pos:'DF',name:'ヘスス・ガジャルド',club:'トルーカ'},{pos:'DF',name:'セサル・モンテス',club:'ロコモティフ'},{pos:'DF',name:'ホルヘ・サンチェス',club:'PAOK'},{pos:'DF',name:'ジュリアン・アラウホ',club:'セルティック'},{pos:'DF',name:'ヨハン・バスケス',club:'ジェノア'},
    {pos:'MF',name:'エドソン・アルバレス',club:'フェネルバフチェ'},{pos:'MF',name:'オルベリン・ピネダ',club:'AEKアテネ'},{pos:'MF',name:'ルイス・チャベス',club:'ディナモ'},{pos:'MF',name:'オベド・バルガス',club:'アトレティコ・マドリード'},{pos:'MF',name:'アルバロ・フィダルゴ',club:'レアル・ベティス'},
    {pos:'FW',name:'ラウール・ヒメネス',club:'フラム'},{pos:'FW',name:'サンティアゴ・ヒメネス',club:'ミラン'},{pos:'FW',name:'セサル・ウエルタ',club:'アンデルレヒト'}
  ],
  RSA: [
    {pos:'GK',name:'ロンウェン・ウィリアムズ',club:'マメロディ・サンダウンズ'},{pos:'GK',name:'リカルド・ゴス',club:'シウェレレ'},
    {pos:'DF',name:'ブラッドリー・クロス',club:'カイザー・チーフス'},{pos:'DF',name:'クリショ・ムダウ',club:'マメロディ・サンダウンズ'},{pos:'DF',name:'オルウェトゥ・マカンヤ',club:'フィラデルフィア'},{pos:'DF',name:'サムケレ・カビニ',club:'モルデ'},
    {pos:'MF',name:'テボホ・モコエナ',club:'マメロディ・サンダウンズ'},{pos:'MF',name:'ジェイデン・アダムス',club:'マメロディ・サンダウンズ'},
    {pos:'FW',name:'ライル・フォスター',club:'バーンリー'},{pos:'FW',name:'タペロ・モレナ',club:'マメロディ・サンダウンズ'},{pos:'FW',name:'エヴィデンス・マクゴパ',club:'オーランド'}
  ],
  KOR: [
    {pos:'GK',name:'キム・スンギュ',club:'FC東京'},{pos:'GK',name:'ソン・ボムグン',club:'全北現代'},
    {pos:'DF',name:'キム・ミンジェ',club:'バイエルン'},{pos:'DF',name:'イェンス・カストロプ',club:'ボルシアMG'},{pos:'DF',name:'イ・ギヒョク',club:'江原'},{pos:'DF',name:'キム・テヒョン',club:'鹿島'},
    {pos:'MF',name:'イ・ガンイン',club:'パリSG'},{pos:'MF',name:'ファン・インボム',club:'フェイエノールト'},{pos:'MF',name:'ファン・ヒチャン',club:'ウルバーハンプトン'},{pos:'MF',name:'ヤン・ヒョンジュン',club:'セルティック'},
    {pos:'FW',name:'ソン・フンミン',club:'LAFC'},{pos:'FW',name:'オ・ヒョンギュ',club:'ベシクタシュ'}
  ],
  CZE: [
    {pos:'GK',name:'インジフ・スタニェク',club:'スラヴィア・プラハ'},{pos:'GK',name:'マチェイ・コヴァーシュ',club:'PSV'},
    {pos:'DF',name:'ラディスラフ・クレイチー',club:'ウォルヴァーハンプトン'},{pos:'DF',name:'ダヴィド・ジマ',club:'スラヴィア'},{pos:'DF',name:'ダヴィド・ドウデラ',club:'スラヴィア'},
    {pos:'MF',name:'トマーシュ・ソウチェク',club:'ウェストハム'},{pos:'MF',name:'パヴェル・シュルツ',club:'リヨン'},{pos:'MF',name:'ルカーシュ・プロヴォド',club:'スラヴィア'},
    {pos:'FW',name:'パトリク・シック',club:'レヴァークーゼン'},{pos:'FW',name:'アダム・ハロジェク',club:'ホッフェンハイム'}
  ],
  CAN: [
    {pos:'GK',name:'デイン・セント・クレア',club:'インテル・マイアミ'},{pos:'GK',name:'マクシム・クレポー',club:'オーランド'},
    {pos:'DF',name:'アルフォンソ・デイヴィス',club:'バイエルン・ミュンヘン'},{pos:'DF',name:'アリスター・ジョンストン',club:'セルティック'},{pos:'DF',name:'デレク・コーネリアス',club:'レンジャーズ'},
    {pos:'MF',name:'スティーヴン・エウスタキオ',club:'ポルト'},{pos:'MF',name:'タジョン・ブキャナン',club:'ビジャレアル'},{pos:'MF',name:'イスマエル・コネ',club:'サッスオーロ'},
    {pos:'FW',name:'ジョナサン・デイビッド',club:'ユヴェントス'},{pos:'FW',name:'サイル・ラリン',club:'マジョルカ'}
  ],
  BIH: [
    {pos:'GK',name:'ニコラ・ヴァシリ',club:'ザンクトパウリ'},
    {pos:'DF',name:'セアド・コラシナツ',club:'アタランタ'},{pos:'DF',name:'アマル・デディッチ',club:'ベンフィカ'},{pos:'DF',name:'タリク・ムハレモヴィッチ',club:'サッスオーロ'},
    {pos:'MF',name:'エスミル・バイラクタレヴィッチ',club:'PSV'},{pos:'MF',name:'ベンジャミン・タヒロヴィッチ',club:'ブレンビーIF'},
    {pos:'FW',name:'エルメディン・デミロヴィッチ',club:'シュトゥットガルト'},{pos:'FW',name:'エディン・ジェコ',club:'シャルケ'},{pos:'FW',name:'ハリス・タバコヴィッチ',club:'ボルシアMG'}
  ],
  QAT: [
    {pos:'GK',name:'マシャアル・バルシャム',club:'アル・サッド'},
    {pos:'DF',name:'ペドロ・ミゲル',club:'アル・サッド'},{pos:'DF',name:'ブアレム・フヒ',club:'アル・サッド'},
    {pos:'MF',name:'アブドゥルアジズ・ハテム',club:'アル・ラーヤン'},{pos:'MF',name:'ジャッセム・ガベル',club:'アル・ラーヤン'},
    {pos:'FW',name:'アクラム・アフィフ',club:'アル・サッド'},{pos:'FW',name:'アルモエズ・アリ',club:'アル・ドゥハイル'},{pos:'FW',name:'ハッサン・アル=ハイドス',club:'アル・サッド'}
  ],
  SUI: [
    {pos:'GK',name:'グレゴール・コーベル',club:'ドルトムント'},
    {pos:'DF',name:'マヌエル・アカンジ',club:'インテル'},{pos:'DF',name:'ニコ・エルベディ',club:'ボルシアMG'},{pos:'DF',name:'リカルド・ロドリゲス',club:'ベティス'},
    {pos:'MF',name:'グラニト・ジャカ',club:'サンダーランド'},{pos:'MF',name:'レモ・フロイラー',club:'ボローニャ'},{pos:'MF',name:'アルドン・ヤシャリ',club:'ミラン'},
    {pos:'FW',name:'ブレール・エンボロ',club:'レンヌ'},{pos:'FW',name:'ノア・オカフォー',club:'リーズ'}
  ],
  BRA: [
    {pos:'GK',name:'アリソン',club:'リヴァプール'},{pos:'GK',name:'エデルソン',club:'フェネルバフチェ'},
    {pos:'DF',name:'マルキーニョス',club:'パリSG'},{pos:'DF',name:'ガブリエウ・マガリャンイス',club:'アーセナル'},{pos:'DF',name:'ブレーメル',club:'ユヴェントス'},
    {pos:'MF',name:'ブルーノ・ギマランイス',club:'ニューカッスル'},{pos:'MF',name:'ルーカス・パケタ',club:'フラメンゴ'},{pos:'MF',name:'カゼミーロ',club:'マンU'},
    {pos:'FW',name:'ヴィニシウス・ジュニオール',club:'レアル・マドリー'},{pos:'FW',name:'ラフィーニャ',club:'バルセロナ'},{pos:'FW',name:'ネイマール',club:'サントス'},{pos:'FW',name:'エンドリッキ',club:'リヨン'}
  ],
  MAR: [
    {pos:'GK',name:'ヤシン・ブヌ',club:'アル・ヒラル'},
    {pos:'DF',name:'アクラフ・ハキミ',club:'パリSG'},{pos:'DF',name:'ヌサイル・マズラウィ',club:'マンU'},{pos:'DF',name:'ナイフ・アゲルド',club:'マルセイユ'},
    {pos:'MF',name:'ソフィアン・アムラバト',club:'ベティス'},{pos:'MF',name:'アゼディン・ウナヒ',club:'ジローナ'},{pos:'MF',name:'ビラル・エル・カンヌス',club:'シュトゥットガルト'},
    {pos:'FW',name:'ブラヒム・ディアス',club:'レアル・マドリー'},{pos:'FW',name:'スフィアン・ラヒミ',club:'アル・アイン'}
  ],
  HAI: [
    {pos:'GK',name:'ジョニー・プラシード',club:'バスティア'},
    {pos:'DF',name:'ジャン・ケヴィン・デュヴェルン',club:'ヘント'},{pos:'DF',name:'ハンネス・デルクロワ',club:'ルガーノ'},
    {pos:'MF',name:'ジャン・リクネル・ベルガルド',club:'ウォルバーハンプトン'},{pos:'MF',name:'ダンリー・ジャン・ジャック',club:'フィラデルフィア'},
    {pos:'FW',name:'ウィルソン・イシドール',club:'サンダーランド'},{pos:'FW',name:'デリック・エティエンヌ',club:'トロント'}
  ],
  SCO: [
    {pos:'GK',name:'アンガス・ガン',club:'ノッティンガム'},{pos:'GK',name:'クレイグ・ゴードン',club:'ハーツ'},
    {pos:'DF',name:'アンドリュー・ロバートソン',club:'リヴァプール'},{pos:'DF',name:'キーラン・ティアニー',club:'セルティック'},{pos:'DF',name:'アーロン・ヒッキー',club:'ブレントフォード'},
    {pos:'MF',name:'ジョン・マッギン',club:'アストンヴィラ'},{pos:'MF',name:'ビリー・ギルモア',club:'ナポリ'},{pos:'MF',name:'スコット・マクトミネイ',club:'ナポリ'},
    {pos:'FW',name:'チェ・アダムス',club:'トリノ'},{pos:'FW',name:'ローレンス・シャンクランド',club:'ハーツ'}
  ],
  USA: [
    {pos:'GK',name:'マット・ターナー',club:'ニューイングランド'},
    {pos:'DF',name:'アントニー・ロビンソン',club:'フラム'},{pos:'DF',name:'セルジーニョ・デスト',club:'PSV'},{pos:'DF',name:'クリス・リチャーズ',club:'クリスタル・パレス'},
    {pos:'MF',name:'クリスチャン・プリシッチ',club:'ACミラン'},{pos:'MF',name:'ウェストン・マッケニー',club:'ユヴェントス'},{pos:'MF',name:'タイラー・アダムス',club:'ボーンマス'},{pos:'MF',name:'ジオ・レイナ',club:'ボルシアMG'},
    {pos:'FW',name:'フォラリン・バログン',club:'モナコ'},{pos:'FW',name:'リカルド・ペピ',club:'PSV'},{pos:'FW',name:'ティモシー・ウェア',club:'マルセイユ'}
  ],
  PAR: [
    {pos:'GK',name:'ガストン・オルベイラ',club:'オリンピア'},
    {pos:'DF',name:'グスタボ・ゴメス',club:'パルメイラス'},{pos:'DF',name:'ジュニオール・アロンソ',club:'アトレチコ・ミネイロ'},
    {pos:'MF',name:'ミゲル・アルミロン',club:'アトランタ・ユナイテッド'},{pos:'MF',name:'ディエゴ・ゴメス',club:'ブライトン'},
    {pos:'FW',name:'フリオ・エンシソ',club:'ストラスブール'},{pos:'FW',name:'アントニオ・サナブリア',club:'クレモネーゼ'},{pos:'FW',name:'ラモン・ソサ',club:'パルメイラス'}
  ],
  AUS: [
    {pos:'GK',name:'マシュー・ライアン',club:'レバンテ'},
    {pos:'DF',name:'ハリー・ソウター',club:'レスター'},{pos:'DF',name:'アレッサンドロ・チルカティ',club:'パルマ'},{pos:'DF',name:'ジョーディ・ボス',club:'フェイエノールト'},
    {pos:'MF',name:'ジャクソン・アーバイン',club:'ザンクト・パウリ'},
    {pos:'FW',name:'マシュー・レッキー',club:'メルボルン'},{pos:'FW',name:'クリスティアン・ヴォルパト',club:'サッスオーロ'},{pos:'FW',name:'テテ・イェンギ',club:'FC町田ゼルビア'}
  ],
  TUR: [
    {pos:'GK',name:'メルト・ギュノク',club:'フェネルバフチェ'},
    {pos:'DF',name:'メリフ・デミラル',club:'アル・アハリ'},{pos:'DF',name:'チャーラル・ソユンジュ',club:'フェネルバフチェ'},{pos:'DF',name:'フェルディ・カドゥオール',club:'ブライトン'},
    {pos:'MF',name:'ハカン・チャルハノール',club:'インテル'},{pos:'MF',name:'サリフ・エズジャン',club:'ドルトムント'},{pos:'MF',name:'オルクン・コクチュ',club:'ベシクタシュ'},
    {pos:'FW',name:'アルダ・ギュレル',club:'レアル・マドリード'},{pos:'FW',name:'ケナン・ユルドゥズ',club:'ユヴェントス'}
  ],
  GER: [
    {pos:'GK',name:'マヌエル・ノイアー',club:'バイエルン・ミュンヘン'},
    {pos:'DF',name:'アントニオ・リュディガー',club:'レアル・マドリード'},{pos:'DF',name:'ヨシュア・キミッヒ',club:'バイエルン'},{pos:'DF',name:'ニコ・シュロッターベック',club:'ドルトムント'},
    {pos:'MF',name:'ジャマル・ムシアラ',club:'バイエルン'},{pos:'MF',name:'カイ・ハヴェルツ',club:'アーセナル'},{pos:'MF',name:'レオン・ゴレツカ',club:'バイエルン'},
    {pos:'FW',name:'フロリアン・ヴィルツ',club:'リヴァプール'},{pos:'FW',name:'レロイ・サネ',club:'ガラタサライ'},{pos:'FW',name:'ニック・ヴォルテマデ',club:'ニューカッスル'}
  ],
  CUW: [
    {pos:'GK',name:'エロイ・ローム',club:'マイアミFC'},
    {pos:'DF',name:'アルマンド・オビスポ',club:'PSV'},{pos:'DF',name:'ロション・ファン・エイマ',club:'RKC'},
    {pos:'MF',name:'レアンドロ・バクーナ',club:'ウードゥル'},{pos:'MF',name:'ジュニーニョ・バクーナ',club:'フォレンダム'},
    {pos:'FW',name:'タヒス・チョン',club:'シェフィールドU'},{pos:'FW',name:'ユルゲン・ロカディア',club:'マイアミFC'}
  ],
  CIV: [
    {pos:'GK',name:'アルバン・ラフォン',club:'パナシナイコス'},
    {pos:'DF',name:'ウスマン・ディオマンデ',club:'スポルティング'},{pos:'DF',name:'ウィルフリード・シンゴ',club:'ガラタサライ'},{pos:'DF',name:'オディロン・コスヌ',club:'アタランタ'},
    {pos:'MF',name:'セコ・フォファナ',club:'ポルト'},{pos:'MF',name:'イブラヒム・サンガレ',club:'ノッティンガム'},{pos:'MF',name:'フランク・ケシエ',club:'アル・アハリ'},
    {pos:'FW',name:'アマド・ディアロ',club:'マンU'},{pos:'FW',name:'シモン・アディングラ',club:'モナコ'},{pos:'FW',name:'アンジュ＝ヨアン・ボニー',club:'インテル'}
  ],
  ECU: [
    {pos:'GK',name:'エルナン・ガリンデス',club:'ウラカン'},
    {pos:'DF',name:'ピエロ・インカピエ',club:'アーセナル'},{pos:'DF',name:'ウィリアン・パチョ',club:'パリSG'},{pos:'DF',name:'ペルビス・エストゥピニャン',club:'ACミラン'},
    {pos:'MF',name:'モイセス・カイセド',club:'チェルシー'},{pos:'MF',name:'ケンドリー・パエス',club:'リバープレート'},
    {pos:'FW',name:'エネル・バレンシア',club:'パチューカ'},{pos:'FW',name:'アントニー・バレンシア',club:'ロイヤル・アントワープ'}
  ],
  NED: [
    {pos:'GK',name:'バルト・フェルブルッヘン',club:'ブライトン'},{pos:'GK',name:'マルク・フレッケン',club:'レヴァークーゼン'},
    {pos:'DF',name:'フィルジル・ファン・ダイク',club:'リヴァプール'},{pos:'DF',name:'ナタン・アケ',club:'マンC'},{pos:'DF',name:'デンゼル・ダンフリース',club:'インテル'},{pos:'DF',name:'ユリエン・ティンバー',club:'アーセナル'},
    {pos:'MF',name:'フレンキー・デ・ヨング',club:'バルセロナ'},{pos:'MF',name:'ライアン・フラーフェンベルフ',club:'リヴァプール'},{pos:'MF',name:'トゥーン・コープマイネルス',club:'ユヴェントス'},
    {pos:'FW',name:'コーディ・ガクポ',club:'リヴァプール'},{pos:'FW',name:'メンフィス・デパイ',club:'コリンチャンス'}
  ],
  JPN: [
    {pos:'GK',name:'鈴木彩艶',club:'パルマ'},{pos:'GK',name:'大迫敬介',club:'サンフレッチェ広島'},{pos:'GK',name:'早川友基',club:'鹿島アントラーズ'},
    {pos:'DF',name:'冨安健洋',club:'アヤックス'},{pos:'DF',name:'板倉滉',club:'アヤックス'},{pos:'DF',name:'伊藤洋輝',club:'バイエルン・ミュンヘン'},{pos:'DF',name:'菅原由勢',club:'ヴェルダー・ブレーメン'},{pos:'DF',name:'谷口彰悟',club:'シント＝トロイデン'},{pos:'DF',name:'渡辺剛',club:'フェイエノールト'},{pos:'DF',name:'瀬古歩夢',club:'ル・アーブル'},{pos:'DF',name:'長友佑都',club:'FC東京'},
    {pos:'MF',name:'久保建英',club:'レアル・ソシエダ'},{pos:'MF',name:'遠藤航',club:'リヴァプール'},{pos:'MF',name:'鎌田大地',club:'クリスタル・パレス'},{pos:'MF',name:'堂安律',club:'フランクフルト'},{pos:'MF',name:'田中碧',club:'リーズ'},{pos:'MF',name:'伊東純也',club:'ゲンク'},{pos:'MF',name:'佐野海舟',club:'マインツ'},{pos:'MF',name:'中村敬斗',club:'スタッド・ランス'},{pos:'MF',name:'鈴木唯人',club:'フライブルク'},
    {pos:'FW',name:'前田大然',club:'セルティック'},{pos:'FW',name:'上田綺世',club:'フェイエノールト'},{pos:'FW',name:'小川航基',club:'NECナイメヘン'},{pos:'FW',name:'後藤啓介',club:'シント＝トロイデン'},{pos:'FW',name:'塩貝健人',club:'ヴォルフスブルク'}
  ],
  SWE: [
    {pos:'GK',name:'ヤコブ・ヴィデル・ゼッテルストレーム',club:'ダービー'},
    {pos:'DF',name:'ヴィクトル・リンデレフ',club:'アストンヴィラ'},{pos:'DF',name:'イサク・ヒエン',club:'アタランタ'},{pos:'DF',name:'ガブリエル・グズムンドソン',club:'リーズ'},
    {pos:'MF',name:'ヤシン・アヤリ',club:'ブライトン'},{pos:'MF',name:'ルーカス・ベリヴァル',club:'トッテナム'},
    {pos:'FW',name:'アレクサンデル・イサク',club:'リヴァプール'},{pos:'FW',name:'ヴィクトル・ギェケレシュ',club:'アーセナル'},{pos:'FW',name:'アントニー・エランガ',club:'ニューカッスル'}
  ],
  TUN: [
    {pos:'GK',name:'アイメン・ダハメン',club:'CSスファクシアン'},
    {pos:'DF',name:'モンタサル・タルビ',club:'ロリアン'},{pos:'DF',name:'オマル・レキク',club:'NKマリボル'},
    {pos:'MF',name:'ハンニバル・メイブリ',club:'バーンリー'},{pos:'MF',name:'ラニ・ケディラ',club:'ウニオン・ベルリン'},
    {pos:'FW',name:'ハリル・アヤリ',club:'パリSG'},{pos:'FW',name:'エリアス・アシュリ',club:'コペンハーゲン'}
  ],
  BEL: [
    {pos:'GK',name:'ティボー・クルトワ',club:'レアル・マドリード'},
    {pos:'DF',name:'ゼノ・デバスト',club:'スポルティング'},{pos:'DF',name:'ティモシー・カスターニュ',club:'フラム'},{pos:'DF',name:'アルトゥール・テアテ',club:'フランクフルト'},
    {pos:'MF',name:'ケビン・デ・ブライネ',club:'ナポリ'},{pos:'MF',name:'アマドゥ・オナナ',club:'アストンヴィラ'},{pos:'MF',name:'ユーリ・ティーレマンス',club:'アストンヴィラ'},
    {pos:'FW',name:'ロメル・ルカク',club:'ナポリ'},{pos:'FW',name:'シャルル・デ・ケテラエル',club:'アタランタ'},{pos:'FW',name:'ジェレミー・ドク',club:'マンC'}
  ],
  EGY: [
    {pos:'GK',name:'モハメド・エル・シェナウィ',club:'アル・アハリ'},
    {pos:'DF',name:'ヤセル・イブラヒム',club:'アル・アハリ'},{pos:'DF',name:'モハメド・ハニー',club:'アル・アハリ'},
    {pos:'MF',name:'モハメド・サラー',club:'リヴァプール'},{pos:'MF',name:'マハムード・"トレゼゲ"',club:'アル・アハリ'},
    {pos:'FW',name:'オマル・マルムシュ',club:'マンC'}
  ],
  IRN: [
    {pos:'GK',name:'アリレザ・ベイランヴァンド',club:'トラークトゥール'},
    {pos:'DF',name:'エフサン・ハジサフィ',club:'セパハン'},{pos:'DF',name:'ミラド・モハマディ',club:'ペルセポリス'},
    {pos:'MF',name:'アリレザ・ジャハンバクシュ',club:'デンデル'},{pos:'MF',name:'サマン・ゴドス',club:'アル・イテハド'},
    {pos:'FW',name:'メフディ・タレミ',club:'オリンピアコス'},{pos:'FW',name:'メフディ・ガエディ',club:'アル・ナスル'}
  ],
  NZL: [
    {pos:'GK',name:'マックス・クロコム',club:'ミルウォール'},
    {pos:'DF',name:'マイケル・ボクソール',club:'ミネソタ'},{pos:'DF',name:'リベラト・カカーチェ',club:'レクサム'},
    {pos:'MF',name:'ジョー・ベル',club:'ヴァイキング'},{pos:'MF',name:'ライアン・トーマス',club:'PECズウォレ'},
    {pos:'FW',name:'クリス・ウッド',club:'ノッティンガム'}
  ],
  ESP: [
    {pos:'GK',name:'ウナイ・シモン',club:'アトレティック'},{pos:'GK',name:'ダビド・ラヤ',club:'アーセナル'},
    {pos:'DF',name:'マルク・ククレジャ',club:'チェルシー'},{pos:'DF',name:'パウ・クバルシ',club:'バルセロナ'},{pos:'DF',name:'アレックス・グリマルド',club:'レヴァークーゼン'},
    {pos:'MF',name:'ペドリ',club:'バルセロナ'},{pos:'MF',name:'ロドリ',club:'マンC'},{pos:'MF',name:'ダニ・オルモ',club:'バルセロナ'},
    {pos:'FW',name:'ラミン・ヤマル',club:'バルセロナ'},{pos:'FW',name:'ニコ・ウィリアムズ',club:'アスレティック'},{pos:'FW',name:'ミケル・オヤルサバル',club:'ソシエダ'}
  ],
  CPV: [
    {pos:'GK',name:'ヴォジーニャ',club:'チャヴェス'},
    {pos:'DF',name:'ローガン・コスタ',club:'ビジャレアル'},{pos:'DF',name:'スティーヴン・モレイラ',club:'コロンバス'},
    {pos:'MF',name:'ジャミロ・モンテイロ',club:'PECズウォレ'},
    {pos:'FW',name:'ジョバネ・カブラル',club:'エストレラ・アマドーラ'},{pos:'FW',name:'ヌーノ・ダ・コスタ',club:'バシャクシェヒル'}
  ],
  KSA: [
    {pos:'GK',name:'モハメド・アル・オワイス',club:'アル・ウラー'},
    {pos:'DF',name:'サウード・アブドゥルハミド',club:'RCランス'},{pos:'DF',name:'ハッサーン・タムバクティ',club:'アル・ヒラル'},
    {pos:'MF',name:'サレム・アル・ドサリ',club:'アル・ヒラル'},{pos:'MF',name:'モハメド・カンノ',club:'アル・ヒラル'},
    {pos:'FW',name:'フィラース・アル・ブライカーン',club:'アル・アハリ'},{pos:'FW',name:'サレー・アル・シェフリ',club:'アル・イテハド'}
  ],
  URU: [
    {pos:'GK',name:'フェルナンド・ムスレラ',club:'エストゥディアンテス'},
    {pos:'DF',name:'ロナルド・アラウホ',club:'バルセロナ'},{pos:'DF',name:'ホセ・マリア・ヒメネス',club:'アトレティコ・マドリー'},{pos:'DF',name:'マティアス・オリベラ',club:'ナポリ'},
    {pos:'MF',name:'フェデリコ・バルベルデ',club:'レアル・マドリード'},{pos:'MF',name:'ロドリゴ・ベンタンクール',club:'トッテナム'},{pos:'MF',name:'マヌエル・ウガルテ',club:'マンU'},
    {pos:'FW',name:'ダルウィン・ヌニェス',club:'アル・ヒラル'},{pos:'FW',name:'ファクンド・ペリストリ',club:'パナシナイコス'}
  ],
  FRA: [
    {pos:'GK',name:'マイク・メニャン',club:'ACミラン'},
    {pos:'DF',name:'ウィリアン・サリバ',club:'アーセナル'},{pos:'DF',name:'イブラヒマ・コナテ',club:'リヴァプール'},{pos:'DF',name:'テオ・エルナンデス',club:'アル・ヒラル'},{pos:'DF',name:'ジュール・クンデ',club:'バルセロナ'},
    {pos:'MF',name:'オーレリアン・チュアメニ',club:'レアル・マドリード'},{pos:'MF',name:'エンゴロ・カンテ',club:'フェネルバフチェ'},{pos:'MF',name:'アドリアン・ラビオ',club:'ACミラン'},
    {pos:'FW',name:'キリアン・エンバペ',club:'レアル・マドリード'},{pos:'FW',name:'ウスマン・デンベレ',club:'パリSG'},{pos:'FW',name:'マイケル・オリーセ',club:'バイエルン'}
  ],
  SEN: [
    {pos:'GK',name:'エドゥアール・メンディ',club:'アル・アハリ'},
    {pos:'DF',name:'カリドゥ・クリバリ',club:'アル・ヒラル'},{pos:'DF',name:'ママドゥ・サール',club:'チェルシー'},
    {pos:'MF',name:'パプ・マタル・サール',club:'トッテナム'},{pos:'MF',name:'イドゥリサ・ゲイエ',club:'エヴァートン'},{pos:'MF',name:'ラミン・カマラ',club:'モナコ'},
    {pos:'FW',name:'サディオ・マネ',club:'アル・ナスル'},{pos:'FW',name:'ニコラス・ジャクソン',club:'バイエルン'},{pos:'FW',name:'イスマイラ・サール',club:'クリスタル・パレス'}
  ],
  IRQ: [
    {pos:'GK',name:'ジャラル・ハッサン',club:'アル・ザウラー'},
    {pos:'DF',name:'レビン・スラカ',club:'ポートFC'},{pos:'DF',name:'メルカス・ドスキ',club:'プルゼニ'},
    {pos:'MF',name:'ジダン・アーマー・イクバル',club:'ユトレヒト'},{pos:'MF',name:'マルコ・ファルジ',club:'ヴェネツィア'},
    {pos:'FW',name:'アリ・アル・ハマディ',club:'ルートン'},{pos:'FW',name:'モハナド・アリ',club:'ディッバ'}
  ],
  NOR: [
    {pos:'GK',name:'エリアン・ニュラン',club:'セビージャ'},
    {pos:'DF',name:'ユリアン・リエルソン',club:'ドルトムント'},{pos:'DF',name:'クリストフェル・アイエル',club:'ブレントフォード'},
    {pos:'MF',name:'マルティン・ウーデゴール',club:'アーセナル'},{pos:'MF',name:'サンデル・ベルゲ',club:'フラム'},{pos:'MF',name:'アントニオ・ヌサ',club:'ライプツィヒ'},
    {pos:'FW',name:'アーリング・ハーランド',club:'マンC'},{pos:'FW',name:'アレクサンデル・セルロート',club:'アトレティコ'}
  ],
  ARG: [
    {pos:'GK',name:'エミリアーノ・マルティネス',club:'アストンヴィラ'},
    {pos:'DF',name:'クリスティアン・ロメロ',club:'トッテナム'},{pos:'DF',name:'リサンドロ・マルティネス',club:'マンU'},{pos:'DF',name:'ニコラス・オタメンディ',club:'ベンフィカ'},
    {pos:'MF',name:'アレクシス・マック・アリスター',club:'リヴァプール'},{pos:'MF',name:'エンソ・フェルナンデス',club:'チェルシー'},{pos:'MF',name:'ロドリゴ・デ・パウル',club:'インテル・マイアミ'},
    {pos:'FW',name:'リオネル・メッシ',club:'インテル・マイアミ'},{pos:'FW',name:'フリアン・アルバレス',club:'アトレティコ・マドリー'},{pos:'FW',name:'ラウタロ・マルティネス',club:'インテル'}
  ],
  ALG: [
    {pos:'GK',name:'メルヴィン・マスティル',club:'スタッド・ニヨン'},
    {pos:'DF',name:'ラミ・ベンセバイニ',club:'ドルトムント'},{pos:'DF',name:'ラヤン・アイト＝ヌーリ',club:'マンC'},
    {pos:'MF',name:'イブラヒム・マザ',club:'レヴァークーゼン'},{pos:'MF',name:'ファレス・シャイビ',club:'フランクフルト'},
    {pos:'FW',name:'リヤド・マフレズ',club:'アル・アハリ'},{pos:'FW',name:'アミーヌ・グイリ',club:'マルセイユ'}
  ],
  AUT: [
    {pos:'GK',name:'パトリック・ペンツ',club:'ブレンビー'},
    {pos:'DF',name:'ダヴィド・アラバ',club:'レアル・マドリー'},{pos:'DF',name:'ケヴィン・ダンソ',club:'トッテナム'},{pos:'DF',name:'シュテファン・ポッシュ',club:'マインツ'},
    {pos:'MF',name:'マルセル・ザビッツァー',club:'ドルトムント'},{pos:'MF',name:'コンラート・ライマー',club:'バイエルン'},{pos:'MF',name:'クリストフ・バウムガルトナー',club:'ライプツィヒ'},
    {pos:'FW',name:'マルコ・アルナウトヴィッチ',club:'ツルヴェナ・ズヴェズダ'},{pos:'FW',name:'ミヒャエル・グレゴリッチュ',club:'アウクスブルク'}
  ],
  JOR: [
    {pos:'GK',name:'ヤジード・アブレイラ',club:'アル・フセイン'},
    {pos:'DF',name:'ヤザン・アル・アラブ',club:'FCソウル'},{pos:'DF',name:'アブダッラー・ナシブ',club:'アル・ザウラー'},
    {pos:'MF',name:'アメル・ジャモス',club:'アル・ザウラー'},
    {pos:'FW',name:'ムサ・アル・ターマリ',club:'レンヌ'},{pos:'FW',name:'モハメド・アブズライク',club:'ラジャ'}
  ],
  POR: [
    {pos:'GK',name:'ディオゴ・コスタ',club:'ポルト'},
    {pos:'DF',name:'ルベン・ディアス',club:'マンC'},{pos:'DF',name:'ヌーノ・メンデス',club:'パリSG'},{pos:'DF',name:'ジョアン・カンセロ',club:'バルセロナ'},
    {pos:'MF',name:'ブルーノ・フェルナンデス',club:'マンU'},{pos:'MF',name:'ベルナルド・シウバ',club:'マンC'},{pos:'MF',name:'ジョアン・ネヴェス',club:'パリSG'},
    {pos:'FW',name:'クリスティアーノ・ロナウド',club:'アル・ナスル'},{pos:'FW',name:'ラファエウ・レオン',club:'ミラン'},{pos:'FW',name:'ペドロ・ネト',club:'チェルシー'}
  ],
  COD: [
    {pos:'GK',name:'リオネル・ムパシ',club:'ル・アーヴル'},
    {pos:'DF',name:'シャンセル・ムベンバ',club:'リール'},{pos:'DF',name:'アーロン・ワン＝ビサカ',club:'ウェストハム'},
    {pos:'MF',name:'ンガラエル・ムカウ',club:'リール'},{pos:'MF',name:'ノア・サディキ',club:'サンダーランド'},
    {pos:'FW',name:'ヨアヌ・ウィサ',club:'ニューカッスル'},{pos:'FW',name:'セドリック・バカンブ',club:'レアル・ベティス'}
  ],
  UZB: [
    {pos:'GK',name:'ウトキル・ユスポフ',club:'ナフバホール'},
    {pos:'DF',name:'アブドゥコディル・フサノフ',club:'マンC'},{pos:'DF',name:'ルスタム・アシュルマトフ',club:'エステグラル'},
    {pos:'MF',name:'ジャロリディン・マシャリポフ',club:'エステグラル'},{pos:'MF',name:'アボスベク・ファイズラエフ',club:'バシャクシェヒル'},
    {pos:'FW',name:'エルドル・ショムロドフ',club:'バシャクシェヒル'},{pos:'FW',name:'イゴール・セルゲエフ',club:'ペルセポリス'}
  ],
  COL: [
    {pos:'GK',name:'ダビド・オスピナ',club:'アトレティコ・ナシオナル'},
    {pos:'DF',name:'ダニエル・ムニョス',club:'クリスタル・パレス'},{pos:'DF',name:'ジョン・ルクミ',club:'ボローニャ'},
    {pos:'MF',name:'ハメス・ロドリゲス',club:'ミネソタ'},{pos:'MF',name:'リチャルド・リオス',club:'ベンフィカ'},{pos:'MF',name:'ジェフェルソン・レルマ',club:'クリスタル・パレス'},
    {pos:'FW',name:'ルイス・ディアス',club:'バイエルン'},{pos:'FW',name:'クチョ・エルナンデス',club:'べティス'}
  ],
  ENG: [
    {pos:'GK',name:'ジョーダン・ピックフォード',club:'エヴァートン'},
    {pos:'DF',name:'リース・ジェームズ',club:'チェルシー'},{pos:'DF',name:'ジョン・ストーンズ',club:'マンC'},{pos:'DF',name:'マーク・グエイ',club:'マンC'},
    {pos:'MF',name:'ジュード・ベリンガム',club:'レアル・マドリード'},{pos:'MF',name:'デクラン・ライス',club:'アーセナル'},{pos:'MF',name:'コビー・メイヌー',club:'マンU'},
    {pos:'FW',name:'ハリー・ケイン',club:'バイエルン'},{pos:'FW',name:'ブカヨ・サカ',club:'アーセナル'},{pos:'FW',name:'マーカス・ラッシュフォード',club:'バルセロナ'}
  ],
  CRO: [
    {pos:'GK',name:'ドミニク・リヴァコヴィッチ',club:'ディナモ・ザグレブ'},
    {pos:'DF',name:'ヨシュコ・グヴァルディオル',club:'マンC'},{pos:'DF',name:'ドゥイェ・チャレタ＝ツァル',club:'レアル・ソシエダ'},
    {pos:'MF',name:'ルカ・モドリッチ',club:'ACミラン'},{pos:'MF',name:'マテオ・コヴァチッチ',club:'マンC'},{pos:'MF',name:'マリオ・パシャリッチ',club:'アタランタ'},
    {pos:'FW',name:'アンドレイ・クラマリッチ',club:'ホッフェンハイム'},{pos:'FW',name:'イヴァン・ペリシッチ',club:'PSV'}
  ],
  GHA: [
    {pos:'GK',name:'ローレンス・アティ＝ジギ',club:'ザンクト・ガレン'},
    {pos:'DF',name:'アリドゥ・セイドゥ',club:'レンヌ'},{pos:'DF',name:'アブドゥル・ラーマン・ババ',club:'PAOK'},
    {pos:'MF',name:'トーマス・パーテイ',club:'ビジャレアル'},{pos:'MF',name:'カマルディーン・スレマナ',club:'アタランタ'},
    {pos:'FW',name:'イニャキ・ウィリアムズ',club:'アスレチック・ビルバオ'},{pos:'FW',name:'アントワーヌ・セメンヨ',club:'マンC'}
  ],
  PAN: [
    {pos:'GK',name:'オルランド・モスケラ',club:'アル・フェイハ'},
    {pos:'DF',name:'アミル・ムリージョ',club:'ベジクタシュ'},{pos:'DF',name:'フィデル・エスコバル',club:'サプリサ'},
    {pos:'MF',name:'アニバル・ゴドイ',club:'サンディエゴ'},{pos:'MF',name:'アダルベルト・カラスキージャ',club:'UNAMプマース'},
    {pos:'FW',name:'イスマエル・ディアス',club:'レオン'},{pos:'FW',name:'セシリオ・ウォーターマン',club:'コンセプシオン'}
  ],
}

// ── Schedule Data 公式（日本時間JST/ベトナム時間ICT）──────
// JST = UTC+9, ICT = JST - 2時間
const SCHEDULE = [
  // ========== グループステージ 第1節 ==========
  // 6/12(金)
  {group:'グループA', date:'2026-06-12', timeJST:'04:00', timeVN:'02:00', home:'MEX', away:'RSA', venue:'エスタディオ・アステカ (Mexico City)', stage:'グループステージ 第1節'},
  {group:'グループB', date:'2026-06-12', timeJST:'04:00', timeVN:'02:00', home:'CAN', away:'BIH', venue:'BMO フィールド (Toronto)', stage:'グループステージ 第1節'},
  // 6/13(土)
  {group:'グループB', date:'2026-06-13', timeJST:'04:00', timeVN:'02:00', home:'QAT', away:'SUI', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第1節'},
  {group:'グループC', date:'2026-06-13', timeJST:'07:00', timeVN:'05:00', home:'BRA', away:'MAR', venue:'メットライフ・スタジアム (New York)', stage:'グループステージ 第1節'},
  {group:'グループD', date:'2026-06-13', timeJST:'10:00', timeVN:'08:00', home:'USA', away:'PAR', venue:'SoFi スタジアム (Los Angeles)', stage:'グループステージ 第1節'},
  {group:'グループC', date:'2026-06-13', timeJST:'10:00', timeVN:'08:00', home:'HAI', away:'SCO', venue:'ジレット・スタジアム (Foxborough)', stage:'グループステージ 第1節'},
  // 6/14(日)
  {group:'グループE', date:'2026-06-14', timeJST:'02:00', timeVN:'00:00', home:'GER', away:'CUW', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第1節'},
  {group:'グループF', date:'2026-06-14', timeJST:'05:00', timeVN:'03:00', home:'NED', away:'JPN', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第1節'},
  {group:'グループD', date:'2026-06-14', timeJST:'08:00', timeVN:'06:00', home:'AUS', away:'TUR', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第1節'},
  {group:'グループE', date:'2026-06-14', timeJST:'11:00', timeVN:'09:00', home:'CIV', away:'ECU', venue:'エスタディオ BBVA (Monterrey)', stage:'グループステージ 第1節'},
  {group:'グループF', date:'2026-06-14', timeJST:'13:00', timeVN:'11:00', home:'SWE', away:'TUN', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第1節'},
  // 6/15(月)
  {group:'グループF', date:'2026-06-15', timeJST:'05:00', timeVN:'03:00', home:'JPN', away:'TUN', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第1節'},
  {group:'グループE', date:'2026-06-15', timeJST:'08:00', timeVN:'06:00', home:'NED', away:'SWE', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第1節'},
  // 6/16(月)
  {group:'グループH', date:'2026-06-16', timeJST:'01:00', timeVN:'23:00', home:'ESP', away:'CPV', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'グループステージ 第1節'},
  {group:'グループG', date:'2026-06-16', timeJST:'04:00', timeVN:'02:00', home:'BEL', away:'EGY', venue:'ルーメン・フィールド (Seattle)', stage:'グループステージ 第1節'},
  {group:'グループH', date:'2026-06-16', timeJST:'07:00', timeVN:'05:00', home:'KSA', away:'URU', venue:'ハードロック・スタジアム (Miami)', stage:'グループステージ 第1節'},
  {group:'グループG', date:'2026-06-16', timeJST:'10:00', timeVN:'08:00', home:'IRN', away:'NZL', venue:'SoFi スタジアム (Los Angeles)', stage:'グループステージ 第1節'},
  // 6/17(火)
  {group:'グループI', date:'2026-06-17', timeJST:'04:00', timeVN:'02:00', home:'FRA', away:'SEN', venue:'メットライフ・スタジアム (New York)', stage:'グループステージ 第1節'},
  {group:'グループJ', date:'2026-06-17', timeJST:'07:00', timeVN:'05:00', home:'IRQ', away:'NOR', venue:'ジレット・スタジアム (Foxborough)', stage:'グループステージ 第1節'},
  {group:'グループI', date:'2026-06-17', timeJST:'10:00', timeVN:'08:00', home:'AUT', away:'JOR', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第1節'},
  {group:'グループJ', date:'2026-06-17', timeJST:'13:00', timeVN:'11:00', home:'ARG', away:'ALG', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第1節'},
  // 6/18(水)
  {group:'グループK', date:'2026-06-18', timeJST:'02:00', timeVN:'00:00', home:'POR', away:'COD', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第1節'},
  {group:'グループL', date:'2026-06-18', timeJST:'05:00', timeVN:'03:00', home:'ENG', away:'CRO', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第1節'},
  {group:'グループL', date:'2026-06-18', timeJST:'08:00', timeVN:'06:00', home:'GHA', away:'PAN', venue:'BMO フィールド (Toronto)', stage:'グループステージ 第1節'},
  {group:'グループK', date:'2026-06-18', timeJST:'11:00', timeVN:'09:00', home:'UZB', away:'COL', venue:'エスタディオ・アステカ (Mexico City)', stage:'グループステージ 第1節'},

  // ========== グループステージ 第2節 ==========
  // 6/19(木)
  {group:'グループA', date:'2026-06-19', timeJST:'01:00', timeVN:'23:00', home:'CZE', away:'RSA', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'グループステージ 第2節'},
  {group:'グループB', date:'2026-06-19', timeJST:'04:00', timeVN:'02:00', home:'SUI', away:'BIH', venue:'SoFi スタジアム (Los Angeles)', stage:'グループステージ 第2節'},
  {group:'グループB', date:'2026-06-19', timeJST:'07:00', timeVN:'05:00', home:'CAN', away:'QAT', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第2節'},
  {group:'グループA', date:'2026-06-19', timeJST:'10:00', timeVN:'08:00', home:'MEX', away:'KOR', venue:'エスタディオ AKRON (Guadalajara)', stage:'グループステージ 第2節'},
  // 6/20(土)
  {group:'グループF', date:'2026-06-20', timeJST:'02:00', timeVN:'00:00', home:'NED', away:'SWE', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第2節'},
  {group:'グループD', date:'2026-06-20', timeJST:'04:00', timeVN:'02:00', home:'USA', away:'AUS', venue:'ルーメン・フィールド (Seattle)', stage:'グループステージ 第2節'},
  {group:'グループE', date:'2026-06-20', timeJST:'05:00', timeVN:'03:00', home:'GER', away:'CUW', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'グループステージ 第2節'},
  {group:'グループC', date:'2026-06-20', timeJST:'07:00', timeVN:'05:00', home:'SCO', away:'MAR', venue:'ジレット・スタジアム (Foxborough)', stage:'グループステージ 第2節'},
  {group:'グループC', date:'2026-06-20', timeJST:'09:30', timeVN:'07:30', home:'BRA', away:'HAI', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第2節'},
  {group:'グループD', date:'2026-06-20', timeJST:'12:00', timeVN:'10:00', home:'TUR', away:'PAR', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第2節'},
  // 6/21(日)
  {group:'グループF', date:'2026-06-21', timeJST:'02:00', timeVN:'00:00', home:'NED', away:'TUN', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第2節'},
  {group:'グループE', date:'2026-06-21', timeJST:'05:00', timeVN:'03:00', home:'ECU', away:'CUW', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'グループステージ 第2節'},
  {group:'グループG', date:'2026-06-21', timeJST:'09:00', timeVN:'07:00', home:'BEL', away:'NZL', venue:'エスタディオ BBVA (Monterrey)', stage:'グループステージ 第2節'},
  {group:'グループF', date:'2026-06-21', timeJST:'13:00', timeVN:'11:00', home:'JPN', away:'SWE', venue:'エスタディオ BBVA (Monterrey)', stage:'グループステージ 第2節'},
  // 6/22(月)
  {group:'グループH', date:'2026-06-22', timeJST:'01:00', timeVN:'23:00', home:'ESP', away:'KSA', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'グループステージ 第2節'},
  {group:'グループG', date:'2026-06-22', timeJST:'04:00', timeVN:'02:00', home:'BEL', away:'IRN', venue:'SoFi スタジアム (Los Angeles)', stage:'グループステージ 第2節'},
  {group:'グループH', date:'2026-06-22', timeJST:'07:00', timeVN:'05:00', home:'URU', away:'CPV', venue:'ハードロック・スタジアム (Miami)', stage:'グループステージ 第2節'},
  {group:'グループG', date:'2026-06-22', timeJST:'10:00', timeVN:'08:00', home:'NZL', away:'EGY', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第2節'},

  // ========== グループステージ 第3節 ==========
  // 6/23(火)
  {group:'グループJ', date:'2026-06-23', timeJST:'02:00', timeVN:'00:00', home:'ARG', away:'AUT', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第3節'},
  {group:'グループI', date:'2026-06-23', timeJST:'06:00', timeVN:'04:00', home:'FRA', away:'IRQ', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第3節'},
  {group:'グループI', date:'2026-06-23', timeJST:'09:00', timeVN:'07:00', home:'NOR', away:'SEN', venue:'メットライフ・スタジアム (New York)', stage:'グループステージ 第3節'},
  {group:'グループJ', date:'2026-06-23', timeJST:'12:00', timeVN:'10:00', home:'JOR', away:'ALG', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第3節'},
  // 6/24(水)
  {group:'グループK', date:'2026-06-24', timeJST:'02:00', timeVN:'00:00', home:'POR', away:'UZB', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第3節'},
  {group:'グループL', date:'2026-06-24', timeJST:'05:00', timeVN:'03:00', home:'ENG', away:'GHA', venue:'ジレット・スタジアム (Foxborough)', stage:'グループステージ 第3節'},
  {group:'グループK', date:'2026-06-24', timeJST:'11:00', timeVN:'09:00', home:'COL', away:'COD', venue:'エスタディオ AKRON (Guadalajara)', stage:'グループステージ 第3節'},
  {group:'グループL', date:'2026-06-24', timeJST:'08:00', timeVN:'06:00', home:'PAN', away:'CRO', venue:'BMO フィールド (Toronto)', stage:'グループステージ 第3節'},
  // 6/25(木)
  {group:'グループB', date:'2026-06-25', timeJST:'04:00', timeVN:'02:00', home:'SUI', away:'CAN', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第3節'},
  {group:'グループA', date:'2026-06-25', timeJST:'04:00', timeVN:'02:00', home:'BIH', away:'QAT', venue:'ルーメン・フィールド (Seattle)', stage:'グループステージ 第3節'},
  {group:'グループB', date:'2026-06-25', timeJST:'07:00', timeVN:'05:00', home:'MAR', away:'HAI', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'グループステージ 第3節'},
  {group:'グループC', date:'2026-06-25', timeJST:'07:00', timeVN:'05:00', home:'SCO', away:'BRA', venue:'ハードロック・スタジアム (Miami)', stage:'グループステージ 第3節'},
  {group:'グループC', date:'2026-06-25', timeJST:'10:00', timeVN:'08:00', home:'CZE', away:'MEX', venue:'エスタディオ・アステカ (Mexico City)', stage:'グループステージ 第3節'},
  {group:'グループA', date:'2026-06-25', timeJST:'10:00', timeVN:'08:00', home:'RSA', away:'KOR', venue:'エスタディオ BBVA (Monterrey)', stage:'グループステージ 第3節'},
  // 6/26(金)
  {group:'グループE', date:'2026-06-26', timeJST:'05:00', timeVN:'03:00', home:'CUW', away:'COL', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第3節'},
  {group:'グループF', date:'2026-06-26', timeJST:'05:00', timeVN:'03:00', home:'ECU', away:'GER', venue:'メットライフ・スタジアム (New York)', stage:'グループステージ 第3節'},
  {group:'グループD', date:'2026-06-26', timeJST:'08:00', timeVN:'06:00', home:'TUN', away:'NED', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'グループステージ 第3節'},
  {group:'グループE', date:'2026-06-26', timeJST:'08:00', timeVN:'06:00', home:'JPN', away:'SWE', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第3節'},
  {group:'グループD', date:'2026-06-26', timeJST:'11:00', timeVN:'09:00', home:'TUR', away:'USA', venue:'SoFi スタジアム (Los Angeles)', stage:'グループステージ 第3節'},
  {group:'グループF', date:'2026-06-26', timeJST:'11:00', timeVN:'09:00', home:'PAR', away:'AUS', venue:"Levi's スタジアム (San Francisco)", stage:'グループステージ 第3節'},
  // 6/27(土)
  {group:'グループF', date:'2026-06-27', timeJST:'04:00', timeVN:'02:00', home:'NOR', away:'FRA', venue:'ジレット・スタジアム (Foxborough)', stage:'グループステージ 第3節'},
  {group:'グループI', date:'2026-06-27', timeJST:'04:00', timeVN:'02:00', home:'SEN', away:'IRQ', venue:'BMO フィールド (Toronto)', stage:'グループステージ 第3節'},
  {group:'グループH', date:'2026-06-27', timeJST:'09:00', timeVN:'07:00', home:'CPV', away:'KSA', venue:'NRG スタジアム (Houston)', stage:'グループステージ 第3節'},
  {group:'グループH', date:'2026-06-27', timeJST:'09:00', timeVN:'07:00', home:'URU', away:'ESP', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第3節'},
  {group:'グループG', date:'2026-06-27', timeJST:'12:00', timeVN:'10:00', home:'NZL', away:'BEL', venue:'BC プレイス (Vancouver)', stage:'グループステージ 第3節'},
  {group:'グループG', date:'2026-06-27', timeJST:'12:00', timeVN:'10:00', home:'EGY', away:'IRN', venue:'ルーメン・フィールド (Seattle)', stage:'グループステージ 第3節'},
  // 6/28(日)
  {group:'グループI', date:'2026-06-28', timeJST:'06:00', timeVN:'04:00', home:'ENG', away:'PAN', venue:'メットライフ・スタジアム (New York)', stage:'グループステージ 第3節'},
  {group:'グループJ', date:'2026-06-28', timeJST:'06:00', timeVN:'04:00', home:'CRO', away:'GHA', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'グループステージ 第3節'},
  {group:'グループK', date:'2026-06-28', timeJST:'08:30', timeVN:'06:30', home:'COL', away:'POR', venue:'ハードロック・スタジアム (Miami)', stage:'グループステージ 第3節'},
  {group:'グループL', date:'2026-06-28', timeJST:'08:30', timeVN:'06:30', home:'UZB', away:'COD', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'グループステージ 第3節'},
  {group:'グループJ', date:'2026-06-28', timeJST:'11:00', timeVN:'09:00', home:'ALG', away:'AUT', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'グループステージ 第3節'},
  {group:'グループJ', date:'2026-06-28', timeJST:'11:00', timeVN:'09:00', home:'JOR', away:'ARG', venue:'AT&T スタジアム (Arlington)', stage:'グループステージ 第3節'},
  // 6/29(月)
  {group:'ラウンド32', date:'2026-06-29', timeJST:'04:00', timeVN:'02:00', home:'A2位', away:'B2位', venue:'SoFi スタジアム (Los Angeles)', stage:'Round 32'},

  // ========== Round 32（ラウンド32）==========
  // 6/29(月)
  {group:'ラウンド32', date:'2026-06-29', timeJST:'04:00', timeVN:'02:00', home:'A2位', away:'B2位', venue:'SoFi スタジアム (Los Angeles)', stage:'Round 32', ro:'R32'},
  // 6/30(火)
  {group:'ラウンド32', date:'2026-06-30', timeJST:'02:00', timeVN:'00:00', home:'C1位', away:'F2位', venue:'NRG スタジアム (Houston)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-06-30', timeJST:'05:30', timeVN:'03:30', home:'E1位', away:'3位(BCDF)', venue:'ジレット・スタジアム (Foxborough)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-06-30', timeJST:'10:00', timeVN:'08:00', home:'F1位', away:'C2位', venue:'エスタディオ BBVA (Monterrey)', stage:'Round 32', ro:'R32'},
  // 7/1(水)
  {group:'ラウンド32', date:'2026-07-01', timeJST:'02:00', timeVN:'00:00', home:'E2位', away:'I2位', venue:'AT&T スタジアム (Arlington)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-01', timeJST:'06:00', timeVN:'04:00', home:'I1位', away:'3位(CDGH)', venue:'メットライフ・スタジアム (New York)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-01', timeJST:'10:00', timeVN:'08:00', home:'A1位', away:'3位(CDEF)', venue:'エスタディオ・アステカ (Mexico City)', stage:'Round 32', ro:'R32'},
  // 7/2(木)
  {group:'ラウンド32', date:'2026-07-02', timeJST:'01:00', timeVN:'23:00', home:'L1位', away:'3位(EHIJ)', venue:'BC プレイス (Vancouver)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-02', timeJST:'05:00', timeVN:'03:00', home:'G1位', away:'3位(AKLM)', venue:'ルーメン・フィールド (Seattle)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-02', timeJST:'09:00', timeVN:'07:00', home:'D1位', away:'3位(BIJL)', venue:'リーバイス・スタジアム (San Francisco)', stage:'Round 32', ro:'R32'},
  // 7/3(金)
  {group:'ラウンド32', date:'2026-07-03', timeJST:'03:00', timeVN:'01:00', home:'H1位', away:'J2位', venue:'SoFi スタジアム (Los Angeles)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-03', timeJST:'08:00', timeVN:'06:00', home:'K2位', away:'L2位', venue:'BMO フィールド (Toronto)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-03', timeJST:'12:00', timeVN:'10:00', home:'B1位', away:'3位(FGJK)', venue:'BC プレイス (Vancouver)', stage:'Round 32', ro:'R32'},
  // 7/4(土)
  {group:'ラウンド32', date:'2026-07-04', timeJST:'03:00', timeVN:'01:00', home:'D2位', away:'G2位', venue:'AT&T スタジアム (Arlington)', stage:'Round 32', ro:'R32'},
  {group:'ラウンド32', date:'2026-07-04', timeJST:'10:30', timeVN:'08:30', home:'K1位', away:'3位(ADEJ)', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'Round 32', ro:'R32'},

  // ========== Round 16（ラウンド16）==========
  // 7/5(日)
  {group:'ラウンド16', date:'2026-07-05', timeJST:'02:00', timeVN:'00:00', home:'R32③勝者', away:'R32④勝者', venue:'NRG スタジアム (Houston)', stage:'Round 16', ro:'R16'},
  {group:'ラウンド16', date:'2026-07-05', timeJST:'07:00', timeVN:'05:00', home:'R32①勝者', away:'R32②勝者', venue:'リンカーン・ファイナンシャル・フィールド (Philadelphia)', stage:'Round 16', ro:'R16'},
  // 7/6(月)
  {group:'ラウンド16', date:'2026-07-06', timeJST:'05:00', timeVN:'03:00', home:'R32⑨勝者', away:'R32⑩勝者', venue:'メットライフ・スタジアム (New York)', stage:'Round 16', ro:'R16'},
  {group:'ラウンド16', date:'2026-07-06', timeJST:'09:00', timeVN:'07:00', home:'R32⑪勝者', away:'R32⑫勝者', venue:'エスタディオ・アステカ (Mexico City)', stage:'Round 16', ro:'R16'},
  // 7/7(火)
  {group:'ラウンド16', date:'2026-07-07', timeJST:'04:00', timeVN:'02:00', home:'R32⑤勝者', away:'R32⑥勝者', venue:'AT&T スタジアム (Arlington)', stage:'Round 16', ro:'R16'},
  {group:'ラウンド16', date:'2026-07-07', timeJST:'09:00', timeVN:'07:00', home:'R32⑦勝者', away:'R32⑧勝者', venue:'ルーメン・フィールド (Seattle)', stage:'Round 16', ro:'R16'},
  // 7/8(水)
  {group:'ラウンド16', date:'2026-07-08', timeJST:'01:00', timeVN:'23:00', home:'R32⑬勝者', away:'R32⑭勝者', venue:'ハードロック・スタジアム (Miami)', stage:'Round 16', ro:'R16'},
  {group:'ラウンド16', date:'2026-07-08', timeJST:'05:00', timeVN:'03:00', home:'R32⑮勝者', away:'R32⑯勝者', venue:'BC プレイス (Vancouver)', stage:'Round 16', ro:'R16'},

  // ========== 準々決勝 ==========
  // 7/10(金)
  {group:'準々決勝', date:'2026-07-10', timeJST:'05:00', timeVN:'03:00', home:'R16-S勝者', away:'R16-T勝者', venue:'ジレット・スタジアム (Foxborough)', stage:'準々決勝', ro:'QF'},
  // 7/11(土)
  {group:'準々決勝', date:'2026-07-11', timeJST:'04:00', timeVN:'02:00', home:'R16-U勝者', away:'R16-V勝者', venue:'SoFi スタジアム (Los Angeles)', stage:'準々決勝', ro:'QF'},
  // 7/12(日)
  {group:'準々決勝', date:'2026-07-12', timeJST:'06:00', timeVN:'04:00', home:'R16-W勝者', away:'R16-X勝者', venue:'ハードロック・スタジアム (Miami)', stage:'準々決勝', ro:'QF'},
  {group:'準々決勝', date:'2026-07-12', timeJST:'10:00', timeVN:'08:00', home:'R16-Y勝者', away:'R16-Z勝者', venue:'アロウヘッド・スタジアム (Kansas City)', stage:'準々決勝', ro:'QF'},

  // ========== 準決勝 ==========
  // 7/15(火)
  {group:'準決勝', date:'2026-07-15', timeJST:'04:00', timeVN:'02:00', home:'QFα勝者', away:'QFβ勝者', venue:'AT&T スタジアム (Arlington)', stage:'準決勝', ro:'SF'},
  // 7/16(水)
  {group:'準決勝', date:'2026-07-16', timeJST:'04:00', timeVN:'02:00', home:'QFγ勝者', away:'QFδ勝者', venue:'メルセデス・ベンツ・スタジアム (Atlanta)', stage:'準決勝', ro:'SF'},

  // ========== 3位決定戦・決勝 ==========
  // 7/19(土)
  {group:'3位決定戦', date:'2026-07-19', timeJST:'06:00', timeVN:'04:00', home:'SF敗者1', away:'SF敗者2', venue:'ハードロック・スタジアム (Miami)', stage:'3位決定戦', ro:'3RD'},
  // 7/20(日) 決勝
  {group:'🏆 決勝', date:'2026-07-20', timeJST:'04:00', timeVN:'02:00', home:'SF勝者1', away:'SF勝者2', venue:'メットライフ・スタジアム (New York)', stage:'🏆 決勝', ro:'FINAL'},
]



const UNIT_OPTIONS = [10000,50000,100000,200000,500000]
const LOTS_OPTIONS = [1,2,3,4,5,6,7,8,9,10]
const GROUPS = ['グループA','グループB','グループC','グループD','グループE','グループF','グループG','グループH','グループI','グループJ','グループK','グループL']

const INIT_STATE = {
  settings:{ unit:10000, feeRate:10 },
  participants:[],
  winner:null,
  status:'open',
  eliminated:[],
  participantPasswords:{}, // { name: hashedPassword }
}

const fmt = n => n.toLocaleString('ja-JP') + ' WCT'
const fmtOdds = n => n.toFixed(2) + 'x'
const WC_START = new Date('2026-06-11T19:00:00-05:00')

// ── Helpers ──────────────────────────────────────────────
function computeStats(participants) {
  const m = {}
  TEAMS.forEach(t=>{ m[t.id]={voters:0,lots:0,amount:0,names:[]} })
  participants.forEach(p=>p.bets.forEach(b=>{
    m[b.teamId].voters++; m[b.teamId].lots+=b.lots
    m[b.teamId].amount+=b.amount; m[b.teamId].names.push(p.name)
  }))
  return m
}
function computeOdds(teamStats, feeRate) {
  const totalPool = Object.values(teamStats).reduce((a,s)=>a+s.amount,0)
  const netPool = totalPool*(1-feeRate/100)
  const odds = {}
  TEAMS.forEach(t=>{ odds[t.id]=teamStats[t.id].amount>0?Math.max(1.01,netPool/teamStats[t.id].amount):null })
  return { odds, totalPool, netPool }
}
function computeWinnings(participants, winner, teamStats, feeRate) {
  if(!winner) return []
  const { netPool } = computeOdds(teamStats, feeRate)
  const ws = teamStats[winner]
  if(!ws||ws.amount===0) return []
  return participants.map(p=>{
    const bet=p.bets.find(b=>b.teamId===winner)
    if(!bet) return null
    const winAmount=Math.floor(netPool*(bet.amount/ws.amount))
    return { name:p.name, betAmount:bet.amount, lots:bet.lots, winAmount, profit:winAmount-bet.amount }
  }).filter(Boolean)
}
function exportCSV(participants, teamStats, odds, winner, feeRate) {
  const winnings = winner?computeWinnings(participants,winner,teamStats,feeRate):[]
  const rows = [['参加者名','国','口数','投票額(WCT)','倍率','当選','受取額(WCT)','損益(WCT)']]
  participants.forEach(p=>p.bets.forEach(b=>{
    const team=TEAMS.find(t=>t.id===b.teamId); const isW=winner===b.teamId
    const w=winnings.find(w=>w.name===p.name&&isW)
    rows.push([p.name,team?.name||'',b.lots,b.amount,odds[b.teamId]?.toFixed(2)||'-',isW?'✓':'',w?w.winAmount:'',w?w.profit:''])
  }))
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:'wc2026_result.csv'})
  a.click()
}

// ── CSS ──────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

:root {
  --bg:       #080C18;
  --bg2:      #0D1526;
  --bg3:      #111D35;
  --card:     #0F1A2E;
  --card2:    #141F33;
  --gold:     #FFD700;
  --gold2:    #FFA500;
  --blue:     #00D4FF;
  --green:    #00FF84;
  --red:      #FF4D6A;
  --text:     #FFFFFF;
  --text2:    #8B9EC7;
  --text3:    #4A5980;
  --border:   rgba(255,255,255,0.06);
  --border2:  rgba(0,212,255,0.2);
  --glow-gold: 0 0 40px rgba(255,215,0,0.15);
  --glow-blue: 0 0 30px rgba(0,212,255,0.2);
}

html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--text); font-family:'Barlow',sans-serif; min-height:100vh; overflow-x:hidden; }

/* Scrollbar */
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:var(--bg2); }
::-webkit-scrollbar-thumb { background:rgba(0,212,255,0.3); border-radius:2px; }

/* Noise texture overlay */
body::before {
  content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity:0.4;
}

/* HEADER */
.hdr { position:sticky; top:0; z-index:200; background:rgba(8,12,24,0.85); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); }
.hdr-inner { max-width:1200px; margin:0 auto; padding:0 20px; display:flex; align-items:center; justify-content:space-between; height:56px; }
.hdr-logo { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:18px; letter-spacing:.12em; background:linear-gradient(135deg,var(--gold),var(--blue)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.hdr-nav { display:flex; gap:2px; }
.nav-btn { background:transparent; border:none; color:var(--text2); cursor:pointer; font-family:'Barlow',sans-serif; font-size:12px; font-weight:600; letter-spacing:.06em; padding:6px 11px; border-radius:6px; transition:all .2s; white-space:nowrap; }
.nav-btn:hover { color:var(--text); background:rgba(255,255,255,0.05); }
.nav-btn.active { color:var(--gold); background:rgba(255,215,0,0.08); }
.sync-dot { width:6px; height:6px; border-radius:50%; display:inline-block; margin-right:5px; }

/* HERO */
.hero {
  position:relative; overflow:hidden;
  background:linear-gradient(160deg,#0D1526 0%,#080C18 40%,#0A1428 100%);
  padding:80px 20px 60px; text-align:center;
}
.hero::before {
  content:''; position:absolute; inset:0;
  background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(0,212,255,0.07) 0%,transparent 70%),
             radial-gradient(ellipse 60% 40% at 20% 100%,rgba(255,215,0,0.06) 0%,transparent 60%),
             radial-gradient(ellipse 40% 30% at 80% 100%,rgba(0,255,132,0.04) 0%,transparent 60%);
  pointer-events:none;
}
.hero-grid {
  position:absolute; inset:0; pointer-events:none; opacity:.15;
  background-image:linear-gradient(rgba(0,212,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.3) 1px,transparent 1px);
  background-size:60px 60px;
  -webkit-mask-image:radial-gradient(ellipse 100% 100% at 50% 0%,black 0%,transparent 80%);
}
.hero-eyebrow { font-family:'Barlow Condensed',sans-serif; font-size:11px; letter-spacing:.3em; color:var(--blue); font-weight:600; margin-bottom:16px; text-transform:uppercase; }
.hero-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:clamp(42px,9vw,96px); line-height:.92; letter-spacing:-.01em; color:#fff; margin-bottom:16px; }
.hero-title span { background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 50%,#fff 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.hero-sub { font-size:14px; color:var(--text2); letter-spacing:.15em; margin-bottom:36px; font-weight:500; }
.hero-badges { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:36px; }
.hero-badge { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid; }
.hero-badge.gold { border-color:rgba(255,215,0,.4); background:rgba(255,215,0,.08); color:var(--gold); }
.hero-badge.blue { border-color:rgba(0,212,255,.4); background:rgba(0,212,255,.08); color:var(--blue); }
.hero-badge.green { border-color:rgba(0,255,132,.4); background:rgba(0,255,132,.08); color:var(--green); }

/* COUNTDOWN */
.countdown { display:flex; gap:12px; justify-content:center; margin-bottom:48px; }
.cd-block { background:var(--card); border:1px solid var(--border2); border-radius:12px; padding:12px 16px; min-width:68px; text-align:center; box-shadow:var(--glow-blue); }
.cd-num { font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:800; color:var(--blue); line-height:1; }
.cd-label { font-size:9px; color:var(--text3); letter-spacing:.12em; margin-top:3px; text-transform:uppercase; }

/* STAT CARDS */
.stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; max-width:1200px; margin:0 auto; padding:0 20px 32px; }
.stat-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:20px; position:relative; overflow:hidden; transition:transform .2s,box-shadow .2s; }
.stat-card:hover { transform:translateY(-2px); }
.stat-card::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.03) 0%,transparent 100%); pointer-events:none; }
.stat-icon { font-size:22px; margin-bottom:10px; }
.stat-label { font-size:11px; color:var(--text2); letter-spacing:.08em; margin-bottom:4px; text-transform:uppercase; font-weight:500; }
.stat-value { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:800; color:var(--gold); line-height:1; }
.stat-card.blue .stat-value { color:var(--blue); }
.stat-card.green .stat-value { color:var(--green); }

/* PAGE WRAPPER */
.page { max-width:1200px; margin:0 auto; padding:24px 20px 60px; }
.section-title { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:24px; letter-spacing:.06em; color:#fff; margin-bottom:16px; display:flex; align-items:center; gap:10px; }
.section-title::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,var(--border2),transparent); }

/* SURVIVAL BOARD */
.survival-card { background:var(--card); border:1px solid rgba(0,255,132,0.15); border-radius:20px; padding:24px; margin-bottom:20px; }
.progress-bar { height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; margin-bottom:6px; }
.progress-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--green),#00c869); transition:width .8s cubic-bezier(.34,1.56,.64,1); }
.team-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:600; border:1.5px solid; transition:all .15s; }
.team-pill.alive { border-color:rgba(0,255,132,0.35); background:rgba(0,255,132,0.07); color:#fff; }
.team-pill.alive.jpn { border-color:rgba(0,212,255,0.4); background:rgba(0,212,255,0.1); color:var(--blue); }
.team-pill.dead { border-color:rgba(255,77,106,0.2); background:rgba(255,77,106,0.05); color:var(--text3); text-decoration:line-through; }
.participant-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; margin-bottom:6px; border:1px solid; transition:all .2s; }
.participant-row.alive { background:rgba(0,255,132,0.05); border-color:rgba(0,255,132,0.15); }
.participant-row.dead { background:rgba(255,77,106,0.04); border-color:rgba(255,77,106,0.1); }

/* POPULAR TEAMS */
.popular-item { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border); }
.popular-item:last-child { border-bottom:none; }
.pop-rank { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:800; color:var(--text3); min-width:28px; }
.pop-bar { flex:1; }
.pop-bar-bg { height:5px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; margin-top:5px; }
.pop-bar-fill { height:100%; border-radius:3px; }

/* BUTTONS */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; border-radius:10px; cursor:pointer; font-family:'Barlow',sans-serif; font-weight:700; transition:all .2s; letter-spacing:.03em; }
.btn-gold { background:linear-gradient(135deg,var(--gold),var(--gold2)); color:#0a0a0a; font-size:14px; padding:12px 24px; box-shadow:0 4px 24px rgba(255,215,0,0.25); }
.btn-gold:hover { transform:translateY(-1px); box-shadow:0 8px 32px rgba(255,215,0,0.35); }
.btn-gold:disabled { opacity:.4; cursor:not-allowed; transform:none; }
.btn-ghost { background:transparent; color:var(--text2); border:1.5px solid var(--border); font-size:13px; padding:10px 18px; }
.btn-ghost:hover { border-color:rgba(255,255,255,0.2); color:#fff; }
.btn-danger { background:rgba(255,77,106,0.1); color:var(--red); border:1.5px solid rgba(255,77,106,0.3); font-size:13px; padding:10px 18px; }
.btn-blue { background:rgba(0,212,255,0.1); color:var(--blue); border:1.5px solid rgba(0,212,255,0.3); font-size:13px; padding:10px 18px; }
.btn-blue:hover { background:rgba(0,212,255,0.18); }

/* INPUTS */
.input { background:rgba(255,255,255,0.04); border:1.5px solid var(--border); border-radius:10px; padding:12px 16px; color:#fff; font-size:15px; font-family:'Barlow',sans-serif; outline:none; width:100%; transition:border-color .2s; }
.input:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(0,212,255,0.1); }

/* CARDS */
.card { background:var(--card); border:1px solid var(--border); border-radius:18px; padding:22px; margin-bottom:14px; position:relative; overflow:hidden; }
.card::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.02) 0%,transparent 60%); pointer-events:none; }
.card.glow-gold { border-color:rgba(255,215,0,0.2); box-shadow:var(--glow-gold); }
.card.glow-blue { border-color:rgba(0,212,255,0.2); box-shadow:var(--glow-blue); }
.card.glow-green { border-color:rgba(0,255,132,0.2); }

/* TEAM GRID (vote page) */
.team-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:8px; margin-bottom:20px; }
.team-card { background:var(--card); border:2px solid var(--border); border-radius:14px; padding:10px 6px; cursor:pointer; text-align:center; transition:all .18s; position:relative; overflow:hidden; }
.team-card:hover { border-color:rgba(255,215,0,0.35); background:rgba(255,215,0,0.05); transform:translateY(-2px); }
.team-card.selected { border-color:var(--gold); background:rgba(255,215,0,0.1); box-shadow:0 0 20px rgba(255,215,0,0.2); }
.team-card.selected::after { content:'✓'; position:absolute; top:4px; right:6px; font-size:9px; font-weight:800; color:var(--gold); }
.team-card.jpn { border-color:rgba(0,212,255,0.3); }
.team-card.jpn.selected { border-color:var(--blue); background:rgba(0,212,255,0.1); box-shadow:0 0 20px rgba(0,212,255,0.2); }
.team-flag { font-size:26px; line-height:1; display:block; margin-bottom:5px; transition:transform .15s; }
.team-flag:hover { transform:scale(1.25); }
.team-hint { font-size:8px; color:rgba(0,212,255,0.5); margin-top:1px; }
.team-name { font-size:9.5px; color:var(--text2); line-height:1.2; font-weight:500; }
.team-card.selected .team-name { color:var(--gold); font-weight:700; }
.team-card.jpn.selected .team-name { color:var(--blue); }
.team-lots { font-size:10px; color:var(--gold); font-weight:800; margin-top:2px; }
.team-card.jpn.selected .team-lots { color:var(--blue); }
.team-group { font-size:8px; color:var(--text3); margin-top:2px; }

/* GROUP FILTER */
.filter-bar { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:14px; }
.filter-pill { padding:5px 12px; border-radius:20px; border:1.5px solid var(--border); background:transparent; color:var(--text2); font-size:11px; cursor:pointer; font-family:'Barlow',sans-serif; font-weight:600; transition:all .15s; }
.filter-pill.active { border-color:var(--gold); background:rgba(255,215,0,0.1); color:var(--gold); }

/* SELECTED BETS */
.bet-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
.lots-btn { padding:3px 8px; border-radius:6px; border:none; cursor:pointer; font-size:11px; font-family:'Barlow',sans-serif; font-weight:700; min-width:30px; transition:all .12s; }
.lots-btn.active { background:var(--gold); color:#0a0a0a; }
.lots-btn.inactive { background:rgba(255,255,255,0.06); color:var(--text2); }
.lots-btn:hover { opacity:.85; }

/* STATUS TABLE */
.status-table { display:flex; flex-direction:column; gap:8px; }
.status-row { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px 16px; transition:all .2s; }
.status-row:hover { border-color:var(--border2); }
.status-row.jpn { border-color:rgba(0,212,255,0.25); background:rgba(0,212,255,0.03); }
.grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin-top:10px; }
.grid4-item { text-align:center; }
.grid4-label { font-size:9px; color:var(--text3); text-transform:uppercase; letter-spacing:.08em; }
.grid4-val { font-size:13px; font-weight:700; margin-top:2px; }

/* ODDS PAGE */
.odds-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:14px; background:var(--card); border:1px solid var(--border); margin-bottom:6px; transition:all .2s; }
.odds-row:hover { border-color:var(--border2); }
.odds-val { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:800; line-height:1; }

/* ADMIN */
.admin-tab-bar { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:20px; }
.elim-group { margin-bottom:18px; }
.elim-group-title { font-size:11px; font-weight:700; letter-spacing:.1em; margin-bottom:8px; text-transform:uppercase; }
.elim-pill { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:20px; cursor:pointer; border:2px solid; font-size:11px; font-weight:600; transition:all .15s; margin:3px; }
.elim-pill.alive { border-color:rgba(0,255,132,0.35); background:rgba(0,255,132,0.07); color:#fff; }
.elim-pill.alive.jpn { border-color:rgba(0,212,255,0.4); background:rgba(0,212,255,0.1); color:var(--blue); }
.elim-pill.dead { border-color:rgba(255,77,106,0.3); background:rgba(255,77,106,0.07); color:var(--text3); opacity:.65; }
.winner-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:6px; }
.winner-card { background:var(--card2); border:2px solid var(--border); border-radius:12px; padding:8px 4px; cursor:pointer; text-align:center; transition:all .15s; }
.winner-card:hover { border-color:rgba(255,215,0,0.4); background:rgba(255,215,0,0.07); }
.winner-card.selected { border-color:var(--gold); background:rgba(255,215,0,0.12); box-shadow:0 0 20px rgba(255,215,0,0.2); }
.winner-card.jpn { border-color:rgba(0,212,255,0.3); }

/* RESULT */
.winner-hero { text-align:center; padding:40px 20px; background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(255,215,0,0.12) 0%,transparent 70%); border:1px solid rgba(255,215,0,0.2); border-radius:24px; margin-bottom:20px; }
.win-flag { font-size:80px; line-height:1; }
.win-name { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:clamp(32px,8vw,56px); color:var(--gold); margin-top:12px; }
.winners-row { display:flex; align-items:center; gap:10px; padding:14px 0; border-bottom:1px solid var(--border); }
.rank-medal { font-size:20px; min-width:28px; }

/* LOADING */
.loading { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; gap:16px; background:var(--bg); }
.spinner { width:44px; height:44px; border:3px solid rgba(0,212,255,0.15); border-top-color:var(--blue); border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg) } }
@keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
.fade-up { animation:fadeUp .4s ease both; }

/* DONE PAGE */
.done-page { text-align:center; padding:60px 20px; }
.done-icon { font-size:64px; margin-bottom:20px; }
.done-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:36px; color:var(--green); margin-bottom:8px; }

/* RESPONSIVE */
@media(max-width:600px){
  .hdr-logo { font-size:14px; }
  .nav-btn { font-size:11px; padding:5px 8px; }
  .countdown { gap:8px; }
  .cd-block { min-width:56px; padding:10px 12px; }
  .cd-num { font-size:26px; }
  .team-grid { grid-template-columns:repeat(auto-fill,minmax(76px,1fr)); gap:6px; }
}
`

// ── Countdown ─────────────────────────────────────────────
function Countdown() {
  const [t,setT]=useState({d:0,h:0,m:0,s:0})
  useEffect(()=>{
    const tick=()=>{
      const diff=WC_START-new Date()
      if(diff<=0){setT({d:0,h:0,m:0,s:0});return}
      setT({d:Math.floor(diff/864e5),h:Math.floor(diff/36e5)%24,m:Math.floor(diff/6e4)%60,s:Math.floor(diff/1e3)%60})
    }
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id)
  },[])
  return(
    <div className="countdown">
      {[['d','DAYS'],['h','HRS'],['m','MIN'],['s','SEC']].map(([k,l])=>(
        <div className="cd-block" key={k}>
          <div className="cd-num">{String(t[k]).padStart(2,'0')}</div>
          <div className="cd-label">{l}</div>
        </div>
      ))}
    </div>
  )
}

// ── Squad Modal ───────────────────────────────────────────
function SquadModal({ teamId, onClose }) {
  const team = TEAMS.find(t => t.id === teamId)
  const players = SQUADS[teamId] || []
  const byPos = { GK:[], DF:[], MF:[], FW:[] }
  players.forEach(p => { if(byPos[p.pos]) byPos[p.pos].push(p) })
  const posColor = { GK:'var(--blue)', DF:'var(--green)', MF:'var(--gold)', FW:'var(--red)' }
  const posLabel = { GK:'GK ゴールキーパー', DF:'DF ディフェンダー', MF:'MF ミッドフィルダー', FW:'FW フォワード' }
  useEffect(()=>{ document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow='' } },[])
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--bg2)',border:'1px solid rgba(0,212,255,0.25)',borderRadius:20,width:'100%',maxWidth:540,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,0.7)'}}>
        <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',background:'linear-gradient(135deg,rgba(0,212,255,0.07) 0%,transparent 100%)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontSize:48,lineHeight:1}}>{team?.flag}</span>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:'#fff'}}>{team?.name}</div>
              <div style={{fontSize:11,color:'var(--text2)',letterSpacing:'.08em'}}>{team?.en} · {team?.region}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text2)',cursor:'pointer',padding:'7px 14px',fontSize:12,fontFamily:'inherit'}}>✕ 閉じる</button>
        </div>
        <div style={{overflowY:'auto',padding:'16px 20px'}}>
          {players.length===0?<div style={{textAlign:'center',color:'var(--text3)',padding:40}}>選手データなし</div>:
            Object.entries(byPos).map(([pos,list])=>list.length===0?null:(
              <div key={pos} style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,color:posColor[pos],letterSpacing:'.12em',marginBottom:7,textTransform:'uppercase',borderLeft:`3px solid ${posColor[pos]}`,paddingLeft:8}}>{posLabel[pos]}</div>
                {list.map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',borderRadius:8,marginBottom:3,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)'}}>
                    <span style={{fontWeight:600,fontSize:13}}>{p.name}</span>
                    <span style={{fontSize:11,color:'var(--text3)',background:'rgba(255,255,255,0.05)',padding:'2px 8px',borderRadius:6}}>{p.club}</span>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Schedule Page ─────────────────────────────────────────
function SchedulePage() {
  const [groupFilter,setGroupFilter]=useState('全て')
  const [squadTeam,setSquadTeam]=useState(null)
  const stageGroups=['全て','グループステージ','ラウンド32','ラウンド16','準々決勝','準決勝','3位決定戦','🏆 決勝']
  const allGroups=stageGroups
  const filtered=groupFilter==='全て'?SCHEDULE:
    groupFilter==='グループステージ'?SCHEDULE.filter(s=>s.stage&&s.stage.includes('グループステージ')):
    SCHEDULE.filter(s=>s.group===groupFilter||s.stage===groupFilter)
  const byDate={}
  filtered.forEach(m=>{ if(!byDate[m.date])byDate[m.date]=[]; byDate[m.date].push(m) })
  const getTeam=id=>TEAMS.find(t=>t.id===id)
  const roLabel={R32:'Round 32',R16:'ラウンド16',QF:'準々決勝',SF:'準決勝','3RD':'3位決定戦',FINAL:'🏆 決勝'}

  return(
    <div className="page fade-up">
      {squadTeam&&<SquadModal teamId={squadTeam} onClose={()=>setSquadTeam(null)}/>}
      <div className="section-title">📅 試合スケジュール</div>
      <div style={{background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
        🇯🇵 <strong style={{color:'var(--gold)'}}>日本時間 (JST)</strong> と 🇻🇳 <strong style={{color:'var(--green)'}}>ベトナム時間 (ICT)</strong> を併記<br/>
        ※ 国旗をタップすると選手一覧が表示されます
      </div>
      <div className="filter-bar" style={{marginBottom:20}}>
        {allGroups.map(g=><button key={g} className={`filter-pill${groupFilter===g?' active':''}`} onClick={()=>setGroupFilter(g)}>{g}</button>)}
      </div>
      {Object.entries(byDate).map(([date,matches])=>{
        const d=new Date(date+'T00:00:00')
        const dateStr=d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})
        return(
          <div key={date} style={{marginBottom:22}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--blue)',letterSpacing:'.1em',marginBottom:10,borderBottom:'1px solid var(--border2)',paddingBottom:6}}>📅 {dateStr}</div>
            {matches.map((m,i)=>{
              const ht=getTeam(m.home); const at=getTeam(m.away); const isJPN=m.home==='JPN'||m.away==='JPN'
              return(
                <div key={i} style={{background:isJPN?'rgba(0,212,255,0.06)':'var(--card)',border:`1px solid ${isJPN?'rgba(0,212,255,0.25)':'var(--border)'}`,borderRadius:14,padding:'14px 16px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:10,color:'var(--text3)',letterSpacing:'.06em'}}>{m.stage||m.group}{m.ro?` · ${roLabel[m.ro]||m.ro}`:''}</span>
                    {isJPN&&<span style={{fontSize:10,color:'var(--blue)',fontWeight:700,border:'1px solid rgba(0,212,255,0.3)',padding:'1px 7px',borderRadius:8}}>🇯🇵 JAPAN</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div onClick={()=>ht&&setSquadTeam(ht.id)} style={{flex:1,textAlign:'right',cursor:ht?'pointer':'default'}}>
                      <div style={{fontSize:ht?28:16,lineHeight:1,marginBottom:3}}>{ht?.flag||'🏳'}</div>
                      <div style={{fontSize:12,fontWeight:700,color:ht?.id==='JPN'?'var(--blue)':'#fff'}}>{ht?.name||m.home}</div>
                    </div>
                    <div style={{textAlign:'center',minWidth:96}}>
                      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'8px 10px'}}>
                        <div style={{fontSize:15,fontWeight:800,color:'var(--gold)',fontFamily:"'Barlow Condensed',sans-serif"}}>🇯🇵 {m.timeJST}</div>
                        <div style={{fontSize:12,color:'var(--green)',marginTop:2}}>🇻🇳 {m.timeVN}</div>
                      </div>
                    </div>
                    <div onClick={()=>at&&setSquadTeam(at.id)} style={{flex:1,textAlign:'left',cursor:at?'pointer':'default'}}>
                      <div style={{fontSize:at?28:16,lineHeight:1,marginBottom:3}}>{at?.flag||'🏳'}</div>
                      <div style={{fontSize:12,fontWeight:700,color:at?.id==='JPN'?'var(--blue)':'#fff'}}>{at?.name||m.away}</div>
                    </div>
                  </div>
                  <div style={{textAlign:'center',marginTop:8,fontSize:10,color:'var(--text3)'}}>📍 {m.venue}</div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── SurvivalBoard ─────────────────────────────────────────
function SurvivalBoard({ state, stats }) {
  const elim = state.eliminated||[]
  const survived = TEAMS.filter(t=>!elim.includes(t.id))
  const dead = TEAMS.filter(t=>elim.includes(t.id))
  const pps = state.participants.map(p=>{
    const alive=p.bets.filter(b=>!elim.includes(b.teamId))
    const gone=p.bets.filter(b=>elim.includes(b.teamId))
    return {...p, alive, gone, isAlive:alive.length>0}
  }).sort((a,b)=>b.isAlive-a.isAlive)
  return(
    <div className="survival-card fade-up">
      <div className="section-title">🏟️ 勝ち残り状況</div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:8}}>
        <span style={{color:'var(--green)',fontWeight:700}}>✅ 勝ち残り {survived.length}か国</span>
        <span style={{color:'var(--red)',fontWeight:700}}>❌ 敗退 {dead.length}か国</span>
      </div>
      <div className="progress-bar" style={{marginBottom:20}}>
        <div className="progress-fill" style={{width:`${(survived.length/TEAMS.length)*100}%`}}/>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'var(--green)',letterSpacing:'.08em',marginBottom:8}}>✅ 勝ち残り中</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {survived.map(t=>{
            const hasV=stats[t.id]?.voters>0; const isJPN=t.id==='JPN'
            return(
              <div key={t.id} className={`team-pill alive${isJPN?' jpn':''}`}>
                <span style={{fontSize:15}}>{t.flag}</span>
                <span style={{fontWeight:hasV?700:500}}>{t.name}</span>
                {hasV&&<span style={{fontSize:10,color:'var(--green)',fontWeight:800}}>{stats[t.id].voters}人</span>}
              </div>
            )
          })}
        </div>
      </div>
      {dead.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--red)',letterSpacing:'.08em',marginBottom:8}}>❌ 敗退</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {dead.map(t=><div key={t.id} className="team-pill dead"><span style={{fontSize:14,filter:'grayscale(1)'}}>{t.flag}</span><span>{t.name}</span></div>)}
          </div>
        </div>
      )}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',letterSpacing:'.08em',marginBottom:8}}>👥 参加者の状況</div>
        {pps.map(p=>(
          <div key={p.name} className={`participant-row ${p.isAlive?'alive':'dead'}`}>
            <span style={{fontSize:16}}>{p.isAlive?'🟢':'🔴'}</span>
            <span style={{fontWeight:700,fontSize:13,flex:1,color:p.isAlive?'#fff':'var(--text3)'}}>{p.name}</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:3,justifyContent:'flex-end'}}>
              {p.alive.map(b=>{const t=TEAMS.find(t=>t.id===b.teamId);return <span key={b.teamId} title={t?.name} style={{fontSize:16}}>{t?.flag}</span>})}
              {p.gone.map(b=>{const t=TEAMS.find(t=>t.id===b.teamId);return <span key={b.teamId} title={`${t?.name}（敗退）`} style={{fontSize:14,filter:'grayscale(1)',opacity:.35}}>{t?.flag}</span>})}
            </div>
            <span style={{fontSize:11,fontWeight:800,color:p.isAlive?'var(--green)':'var(--red)',minWidth:44,textAlign:'right'}}>{p.isAlive?`${p.alive.length}国残`:'敗退'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page: TOP ─────────────────────────────────────────────
function TopPage({ state, setPage, syncing, lastSync, onRefresh }) {
  useEffect(() => {
    // TOPページを開いたとき、すでに音楽ONなら何もしない（ユーザー操作後のみ有効）
    // AudioPlayerのstartedフラグを参照
    if (stadiumAudio.playing) return
    // ユーザーが一度でも音楽をONにしたことがあればBGM自動再開
    if (stadiumAudio._everStarted) {
      stadiumAudio.start()
    }
  }, [])
  const stats=computeStats(state.participants)
  const {odds,totalPool,netPool}=computeOdds(stats,state.settings.feeRate)
  const topTeams=[...TEAMS].filter(t=>stats[t.id].lots>0).sort((a,b)=>stats[b.id].amount-stats[a.id].amount).slice(0,5)
  const statusMap={open:['受付中','var(--green)'],closed:['締切済み','var(--red)'],finished:['結果確定','var(--gold)']}
  const [sl,sc]=statusMap[state.status]||['—','#888']
  const timeStr=lastSync?lastSync.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'
  const totalLots=Object.values(stats).reduce((a,s)=>a+s.lots,0)

  return(
    <>
      {/* HERO */}
      <div className="hero">
        <div className="hero-grid"/>
        <div style={{position:'relative',zIndex:1}}>
          <div className="hero-eyebrow">🏆 FIFA WORLD CUP 2026 • USA • CANADA • MEXICO</div>
          <h1 className="hero-title">WORLD CUP<br/><span>2026</span><br/>TOURNAMENT<br/>PREDICTION CHALLENGE</h1>
          <p className="hero-sub">48 NATIONS · 104 MATCHES · 1 CHAMPION</p>
          <div className="hero-badges">
            <span className="hero-badge gold">
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--gold)',display:'inline-block',animation:'pulse 1.5s infinite'}}/>
              {sl}
            </span>
            <span className="hero-badge blue">💰 総額 {fmt(totalPool)}</span>
            <span className="hero-badge green">👥 {state.participants.length}人参加</span>
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:12,letterSpacing:'.06em'}}>開幕まで</div>
          <Countdown/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <span style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center'}}>
              <span className="sync-dot" style={{background:syncing?'#f59e0b':'var(--green)',boxShadow:syncing?'0 0 8px #f59e0b':'0 0 8px var(--green)',animation:syncing?'pulse .8s infinite':'none'}}/>
              {syncing?'同期中…':`最終同期 ${timeStr}`}
            </span>
            <button onClick={onRefresh} className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11}}>🔄 更新</button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid">
        {[
          [null,'👥','参加者',state.participants.length+'人'],
          ['blue','🎯','総口数',totalLots+'口'],
          ['green','💰','総投票額',fmt(totalPool)],
          [null,'✨','純分配額',fmt(netPool)],
        ].map(([cls,icon,label,val])=>(
          <div key={label} className={`stat-card${cls?' '+cls:''} fade-up`}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{val}</div>
          </div>
        ))}
      </div>

      <div className="page" style={{paddingTop:0}}>
        {/* SURVIVAL */}
        {(state.eliminated||[]).length>0&&<SurvivalBoard state={state} stats={stats}/>}

        {/* POPULAR */}
        {topTeams.length>0&&(
          <div className="card fade-up">
            <div className="section-title">🔥 人気上位チーム</div>
            {topTeams.map((team,i)=>{
              const ts=stats[team.id]; const pct=totalPool>0?ts.amount/totalPool*100:0; const isJPN=team.id==='JPN'
              const barColor=isJPN?'linear-gradient(90deg,var(--blue),#74c0fc)':i===0?'linear-gradient(90deg,var(--gold),var(--gold2))':'rgba(255,255,255,0.2)'
              return(
                <div className="popular-item" key={team.id}>
                  <div className="pop-rank">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</div>
                  <span style={{fontSize:26}}>{team.flag}</span>
                  <div className="pop-bar">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <span style={{fontSize:13,fontWeight:700,color:isJPN?'var(--blue)':'#fff'}}>{team.name}</span>
                      <span style={{fontSize:11,color:'var(--text2)'}}>{odds[team.id]?fmtOdds(odds[team.id]):'—'}</span>
                    </div>
                    <div className="pop-bar-bg">
                      <div className="pop-bar-fill" style={{width:`${pct}%`,background:barColor}}/>
                    </div>
                  </div>
                  <div style={{textAlign:'right',minWidth:60}}>
                    <div style={{fontSize:14,fontWeight:800,color:'var(--gold)'}}>{pct.toFixed(1)}%</div>
                    <div style={{fontSize:10,color:'var(--text3)'}}>{ts.voters}人</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {state.status==='open'&&<>
            <button className="btn btn-gold" style={{flex:1,padding:'14px'}} onClick={()=>setPage('register')}>⚽ 参加・投票する</button>
            <button className="btn btn-ghost" style={{flex:1,padding:'14px'}} onClick={()=>setPage('status')}>📊 投票状況を見る</button>
          </>}
          {state.status==='finished'&&<button className="btn btn-gold" style={{width:'100%',padding:'16px',fontSize:16}} onClick={()=>setPage('result')}>🏆 結果・受取額を確認</button>}
        </div>
      </div>
    </>
  )
}

// ── Page: REGISTER ────────────────────────────────────────
function RegisterPage({ state, setState }) {
  const [name,setName]=useState('')
  const [pass,setPass]=useState('')
  const [passConfirm,setPassConfirm]=useState('')
  const [passError,setPassError]=useState('')
  const [step,setStep]=useState('name') // name | pass | bet | done
  const [participant,setParticipant]=useState(null)
  const [bets,setBets]=useState([])
  const [filter,setFilter]=useState('全て')
  const [showEx,setShowEx]=useState(false)
  const [editMode,setEditMode]=useState(false)
  const [saving,setSaving]=useState(false)
  const [squadTeam,setSquadTeam]=useState(null)

  const simpleHash = s => s.split('').reduce((a,c)=>Math.imul(31,a)+c.charCodeAt(0)|0,0).toString()

  const handleStart=()=>{
    const n=name.trim(); if(!n)return
    const ex=state.participants.find(p=>p.name===n)
    const passwords=state.participantPasswords||{}
    if(ex){
      // 既存参加者 → パスワード確認が必要
      if(passwords[n]){
        setParticipant(ex)
        setEditMode(true)
        setStep('pass')
      } else {
        setParticipant(ex);setBets(ex.bets.map(b=>({teamId:b.teamId,lots:b.lots})));setEditMode(true)
        setStep('bet')
      }
    } else {
      // 新規参加者 → パスワード設定
      setParticipant({id:Date.now().toString(),name:n,bets:[]});setBets([]);setEditMode(false)
      setStep('pass')
    }
  }

  const handlePassSubmit=()=>{
    const passwords=state.participantPasswords||{}
    const n=participant?.name
    if(editMode && passwords[n]){
      // パスワード照合
      if(simpleHash(pass) !== passwords[n]){
        setPassError('パスワードが違います')
        return
      }
      setBets(participant.bets.map(b=>({teamId:b.teamId,lots:b.lots})))
      setPassError('')
      setStep('bet')
    } else {
      // 新規パスワード設定
      if(!pass){ setPassError('パスワードを入力してください'); return }
      if(pass !== passConfirm){ setPassError('パスワードが一致しません'); return }
      setPassError('')
      setStep('bet')
    }
  }
  const toggleTeam=id=>setBets(prev=>prev.find(b=>b.teamId===id)?prev.filter(b=>b.teamId!==id):[...prev,{teamId:id,lots:1}])
  const setLots=(id,lots)=>setBets(prev=>prev.map(b=>b.teamId===id?{...b,lots}:b))
  const total=bets.reduce((a,b)=>a+b.lots*state.settings.unit,0)

  const handleSave=async()=>{
    setSaving(true)
    const fb=bets.map(b=>({teamId:b.teamId,lots:b.lots,amount:b.lots*state.settings.unit}))
    const newP={...participant,bets:fb}
    await setState(s=>{
      const newParticipants=s.participants.find(p=>p.id===newP.id)?s.participants.map(p=>p.id===newP.id?newP:p):[...s.participants,newP]
      const newPasswords={...(s.participantPasswords||{})}
      if(pass && !newPasswords[newP.name]){
        // simpleHash: 新規参加者のパスワードを保存
        const h=pass.split('').reduce((a,c)=>Math.imul(31,a)+c.charCodeAt(0)|0,0).toString()
        newPasswords[newP.name]=h
      }
      return {...s,participants:newParticipants,participantPasswords:newPasswords}
    })
    setSaving(false)
    stadiumAudio.roar()
    setStep('done')
  }

  const allGroups=['全て',...GROUPS]
  const filtered=filter==='全て'?TEAMS:TEAMS.filter(t=>t.region===filter)

  if(step==='pass') return(
    <div className="page fade-up" style={{maxWidth:440}}>
      <div className="section-title">🔐 {editMode?'パスワード確認':'パスワード設定'}</div>
      <div className="card">
        {!editMode&&(
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:16,lineHeight:1.8}}>
            <strong style={{color:'var(--gold)'}}>{participant?.name}</strong> さん、はじめまして！<br/>
            自分の投票を他の人が変更できないよう、パスワードを設定してください。
          </div>
        )}
        {editMode&&(
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:16}}>
            <strong style={{color:'var(--gold)'}}>{participant?.name}</strong> さんのパスワードを入力してください。
          </div>
        )}
        <label style={{fontSize:11,color:'var(--text2)',display:'block',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase'}}>
          {editMode?'パスワード':'新しいパスワード'}
        </label>
        <input type="password" className="input" value={pass} onChange={e=>{setPass(e.target.value);setPassError('')}}
          onKeyDown={e=>e.key==='Enter'&&handlePassSubmit()}
          placeholder="パスワードを入力" autoFocus/>
        {!editMode&&(
          <>
            <label style={{fontSize:11,color:'var(--text2)',display:'block',margin:'12px 0 8px',letterSpacing:'.06em',textTransform:'uppercase'}}>パスワード（確認）</label>
            <input type="password" className="input" value={passConfirm} onChange={e=>{setPassConfirm(e.target.value);setPassError('')}}
              onKeyDown={e=>e.key==='Enter'&&handlePassSubmit()}
              placeholder="もう一度入力"/>
          </>
        )}
        {passError&&<div style={{color:'var(--red)',fontSize:12,marginTop:8,fontWeight:600}}>⚠ {passError}</div>}
        <div style={{display:'flex',gap:10,marginTop:16}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{setStep('name');setPass('');setPassConfirm('');setPassError('')}}>← 戻る</button>
          <button className="btn btn-gold" style={{flex:2}} onClick={handlePassSubmit}>
            {editMode?'ログイン →':'設定して投票へ →'}
          </button>
        </div>
        {!editMode&&(
          <div style={{fontSize:10,color:'var(--text3)',marginTop:10,lineHeight:1.6}}>
            ※ パスワードはブラウザに保存されません。忘れた場合は管理者に削除を依頼してください。
          </div>
        )}
      </div>
    </div>
  )

  if(step==='done') return(
    <div className="page done-page fade-up">
      <div className="done-icon">✅</div>
      <div className="done-title">{editMode?'投票を更新しました！':'投票完了！'}</div>
      <p style={{color:'var(--text2)',marginBottom:32}}>{participant?.name} さんの投票が全員と共有されました 🎉</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <button className="btn btn-gold" onClick={()=>{setStep('name');setName('');setBets([])}}>別の参加者を登録</button>
        <button className="btn btn-ghost" onClick={()=>{setStep('name');setName('');setBets([])}}>トップへ戻る</button>
      </div>
    </div>
  )

  if(step==='name') return(
    <div className="page fade-up">
      <div className="section-title">👤 参加者登録</div>
      <div className="card">
        <label style={{fontSize:12,color:'var(--text2)',display:'block',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>お名前</label>
        <input className="input" placeholder="例: 田中" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleStart()} autoFocus/>
        <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>※ 登録済みの名前を入力すると投票内容を編集できます</div>
        <button className="btn btn-gold" style={{marginTop:16,width:'100%',padding:'13px'}} onClick={handleStart}>投票画面へ進む →</button>
      </div>
      {state.participants.length>0&&(
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{fontWeight:700,fontSize:14}}>参加済み ({state.participants.length}人)</span>
            <button className="btn btn-ghost" style={{padding:'5px 12px',fontSize:11}} onClick={()=>setShowEx(!showEx)}>{showEx?'隠す':'一覧表示'}</button>
          </div>
          {showEx&&state.participants.map(p=>(
            <div key={p.id} onClick={()=>setName(p.name)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
              <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{p.bets.length}か国 / {fmt(p.bets.reduce((a,b)=>a+b.amount,0))}</div></div>
              <div style={{display:'flex',gap:3}}>{p.bets.slice(0,4).map(b=><span key={b.teamId} style={{fontSize:15}}>{TEAMS.find(t=>t.id===b.teamId)?.flag}</span>)}{p.bets.length>4&&<span style={{fontSize:11,color:'var(--text3)'}}>+{p.bets.length-4}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return(
    <div className="page fade-up">
      {squadTeam&&<SquadModal teamId={squadTeam} onClose={()=>setSquadTeam(null)}/>}
      <div className="section-title">⚽ {participant?.name} さんの投票</div>
      <div className="card glow-gold" style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          {[['1口単価',fmt(state.settings.unit),'var(--text2)'],['選択中',bets.length+'か国','var(--blue)'],['合計投票額',fmt(total),'var(--gold)']].map(([l,v,c])=>(
            <div key={l}><div style={{fontSize:11,color:'var(--text3)',letterSpacing:'.06em',textTransform:'uppercase'}}>{l}</div><div style={{fontWeight:800,fontSize:l==='合計投票額'?22:16,color:c,fontFamily:"'Barlow Condensed',sans-serif"}}>{v}</div></div>
          ))}
        </div>
      </div>

      {bets.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:12,color:'var(--text2)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10}}>選択中の国と口数</div>
          {bets.map(b=>{
            const team=TEAMS.find(t=>t.id===b.teamId)
            return(
              <div className="bet-row" key={b.teamId}>
                <span style={{fontSize:20}}>{team?.flag}</span>
                <span style={{flex:1,fontSize:13,fontWeight:600}}>{team?.name}</span>
                <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                  {LOTS_OPTIONS.map(lot=><button key={lot} onClick={()=>setLots(b.teamId,lot)} className={`lots-btn ${b.lots===lot?'active':'inactive'}`}>{lot}口</button>)}
                </div>
                <div style={{fontSize:12,color:'var(--gold)',minWidth:80,textAlign:'right',fontWeight:700}}>{fmt(b.lots*state.settings.unit)}</div>
                <button onClick={()=>toggleTeam(b.teamId)} style={{background:'rgba(255,77,106,0.15)',border:'none',borderRadius:6,color:'var(--red)',cursor:'pointer',padding:'4px 8px',fontSize:12}}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="filter-bar">
        {allGroups.map(g=><button key={g} className={`filter-pill${filter===g?' active':''}`} onClick={()=>setFilter(g)}>{g}</button>)}
      </div>

      <div className="team-grid">
        {filtered.map(team=>{
          const bet=bets.find(b=>b.teamId===team.id); const sel=!!bet; const isJPN=team.id==='JPN'
          return(
            <div key={team.id} className={`team-card${sel?' selected':''}${isJPN?' jpn':''}`} onClick={()=>toggleTeam(team.id)}>
              <span className="team-flag" onClick={e=>{e.stopPropagation();setSquadTeam(team.id)}} title="タップで選手一覧" style={{cursor:'zoom-in',display:'block'}}>{team.flag}</span>
              <div className="team-hint">👆 選手</div>
              <div className="team-name">{team.name}</div>
              {sel&&<div className="team-lots">{bet.lots}口</div>}
              <div className="team-group">{team.region}</div>
            </div>
          )
        })}
      </div>

      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep('name')}>← 戻る</button>
        <button className={`btn btn-gold`} style={{flex:2,fontSize:15,padding:'14px',opacity:saving||bets.length===0?.5:1}} disabled={bets.length===0||saving} onClick={handleSave}>
          {saving?'保存中…':(editMode?'更新する':'投票を確定する')+` — ${fmt(total)}`}
        </button>
      </div>
    </div>
  )
}

// ── Page: STATUS ──────────────────────────────────────────
function StatusPage({ state }) {
  const stats=computeStats(state.participants)
  const {odds,totalPool}=computeOdds(stats,state.settings.feeRate)
  const [view,setView]=useState('team')
  const [sort,setSort]=useState('amount')
  const [gf,setGf]=useState('全て')
  const active=TEAMS.filter(t=>stats[t.id].lots>0)
  const sorted=[...active].sort((a,b)=>sort==='amount'?stats[b.id].amount-stats[a.id].amount:sort==='lots'?stats[b.id].lots-stats[a.id].lots:(odds[b.id]||0)-(odds[a.id]||0))
  const filtered=gf==='全て'?sorted:sorted.filter(t=>t.region===gf)

  return(
    <div className="page fade-up">
      <div className="section-title">📊 投票状況一覧</div>
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        <button className={`btn btn-ghost${view==='team'?' btn-blue':''}`} onClick={()=>setView('team')}>🌍 国別</button>
        <button className={`btn btn-ghost${view==='person'?' btn-blue':''}`} onClick={()=>setView('person')}>👥 参加者別</button>
      </div>

      {view==='team'&&(
        <>
          <div className="filter-bar" style={{marginBottom:10}}>
            <span style={{fontSize:11,color:'var(--text3)',lineHeight:'28px'}}>並び:</span>
            {[['amount','投票額'],['lots','口数'],['odds','倍率']].map(([k,l])=><button key={k} className={`filter-pill${sort===k?' active':''}`} onClick={()=>setSort(k)}>{l}</button>)}
            <span style={{fontSize:11,color:'var(--text3)',lineHeight:'28px',marginLeft:4}}>グループ:</span>
            {['全て',...GROUPS].map(g=><button key={g} className={`filter-pill${gf===g?' active':''}`} onClick={()=>setGf(g)}>{g.replace('グループ','G')}</button>)}
          </div>
          <div className="status-table">
            {filtered.map((team,i)=>{
              const ts=stats[team.id]; const pct=totalPool>0?ts.amount/totalPool*100:0; const isJPN=team.id==='JPN'
              const elim=(state.eliminated||[]).includes(team.id)
              return(
                <div key={team.id} className={`status-row${isJPN?' jpn':''}`} style={{opacity:elim?.5:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontSize:12,color:'var(--text3)',minWidth:22}}>{i+1}.</div>
                    <span style={{fontSize:26,filter:elim?'grayscale(1)':'none'}}>{team.flag}</span>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,fontSize:14,color:elim?'var(--text3)':isJPN?'var(--blue)':'#fff',textDecoration:elim?'line-through':'none'}}>{team.name}</span>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          {elim&&<span style={{fontSize:10,color:'var(--red)',fontWeight:700,border:'1px solid rgba(255,77,106,0.3)',padding:'1px 6px',borderRadius:8}}>敗退</span>}
                          <span style={{fontSize:10,color:'var(--text3)'}}>{team.region}</span>
                        </div>
                      </div>
                      <div className="grid4">
                        {[['参加',ts.voters+'人'],['口数',ts.lots+'口'],['投票額',fmt(ts.amount)],['倍率',odds[team.id]?fmtOdds(odds[team.id]):'—']].map(([l,v])=>(
                          <div className="grid4-item" key={l}>
                            <div className="grid4-label">{l}</div>
                            <div className="grid4-val" style={{color:l==='倍率'?'var(--green)':l==='投票額'?'var(--gold)':'#fff'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{marginTop:8,height:4,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,borderRadius:2,background:isJPN?'linear-gradient(90deg,var(--blue),#74c0fc)':'linear-gradient(90deg,var(--gold),var(--gold2))'}}/>
                      </div>
                    </div>
                  </div>
                  {ts.names.length>0&&<div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:4}}>{ts.names.map((n,i)=><span key={i} style={{fontSize:11,background:'rgba(255,255,255,0.05)',borderRadius:5,padding:'2px 7px',color:'var(--text2)'}}>{n}</span>)}</div>}
                </div>
              )
            })}
            {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>まだ投票がありません</div>}
          </div>
        </>
      )}

      {view==='person'&&(
        <>
          {state.participants.length===0&&<div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>参加者がいません</div>}
          {state.participants.map(p=>{
            const total=p.bets.reduce((a,b)=>a+b.amount,0)
            const elim=state.eliminated||[]
            const hasAlive=p.bets.some(b=>!elim.includes(b.teamId))
            return(
              <div key={p.id} className="card" style={{borderColor:hasAlive?'rgba(0,255,132,0.1)':'rgba(255,77,106,0.1)',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,display:'flex',alignItems:'center',gap:6}}>{hasAlive?'🟢':'🔴'} {p.name}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{p.bets.length}か国 / {p.bets.reduce((a,b)=>a+b.lots,0)}口</div>
                  </div>
                  <div style={{color:'var(--gold)',fontWeight:800,fontSize:15,fontFamily:"'Barlow Condensed',sans-serif"}}>{fmt(total)}</div>
                </div>
                {p.bets.map(b=>{
                  const team=TEAMS.find(t=>t.id===b.teamId); const isJPN=b.teamId==='JPN'; const isDead=elim.includes(b.teamId)
                  return(
                    <div key={b.teamId} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 0',borderTop:'1px solid var(--border)',opacity:isDead?.4:1}}>
                      <span style={{fontSize:17,filter:isDead?'grayscale(1)':'none'}}>{team?.flag}</span>
                      <span style={{flex:1,fontSize:12,color:isDead?'var(--text3)':isJPN?'var(--blue)':'#fff',textDecoration:isDead?'line-through':'none'}}>{team?.name}</span>
                      {isDead&&<span style={{fontSize:9,color:'var(--red)',border:'1px solid rgba(255,77,106,0.3)',padding:'1px 5px',borderRadius:6,fontWeight:700}}>敗退</span>}
                      <span style={{fontSize:11,color:'var(--text3)'}}>{b.lots}口</span>
                      <span style={{fontSize:12,color:'var(--gold)',minWidth:88,textAlign:'right',fontWeight:700}}>{fmt(b.amount)}</span>
                      <span style={{fontSize:11,color:'var(--green)',minWidth:44,textAlign:'right'}}>{odds[b.teamId]?fmtOdds(odds[b.teamId]):'—'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Page: ODDS ────────────────────────────────────────────
function OddsPage({ state }) {
  const stats=computeStats(state.participants)
  const {odds,totalPool,netPool}=computeOdds(stats,state.settings.feeRate)
  const active=[...TEAMS].filter(t=>stats[t.id].lots>0).sort((a,b)=>(odds[a.id]||999)-(odds[b.id]||999))
  return(
    <div className="page fade-up">
      <div className="section-title">📈 倍率一覧</div>
      <div className="card glow-green" style={{marginBottom:18}}>
        <div style={{fontSize:11,color:'var(--text3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6}}>倍率の計算式</div>
        <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
          倍率 = 純分配額 ÷ その国への投票額<br/>
          手数料率 <strong style={{color:'var(--gold)'}}>{state.settings.feeRate}%</strong> 控除後の純分配額: <strong style={{color:'var(--green)'}}>{fmt(netPool)}</strong>（総額 {fmt(totalPool)}）
        </div>
      </div>
      {active.map(team=>{
        const o=odds[team.id]||1; const ts=stats[team.id]; const isJPN=team.id==='JPN'
        const oc=o>=10?'var(--green)':o>=5?'#86efac':o>=2?'var(--gold)':'var(--red)'
        const elim=(state.eliminated||[]).includes(team.id)
        return(
          <div key={team.id} className="odds-row" style={{borderColor:isJPN?'rgba(0,212,255,0.2)':'var(--border)',opacity:elim?.4:1}}>
            <span style={{fontSize:22,filter:elim?'grayscale(1)':'none'}}>{team.flag}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:isJPN?'var(--blue)':'#fff'}}>{team.name}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{ts.lots}口 / {fmt(ts.amount)}</div>
            </div>
            {elim&&<span style={{fontSize:9,color:'var(--red)',border:'1px solid rgba(255,77,106,0.3)',padding:'2px 7px',borderRadius:8,fontWeight:700}}>敗退</span>}
            <div style={{textAlign:'right'}}>
              <div className="odds-val" style={{color:oc}}>{fmtOdds(o)}</div>
              <div style={{fontSize:10,color:'var(--text3)'}}>{o>=10?'超高倍率':o>=5?'高倍率':o>=2?'中倍率':'低倍率'}</div>
            </div>
          </div>
        )
      })}
      {active.length===0&&<div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>まだ投票がありません</div>}
    </div>
  )
}

// ── Page: ADMIN ───────────────────────────────────────────
function AdminPage({ state, setState }) {
  const [pass,setPass]=useState('')
  const [auth,setAuth]=useState(false)
  const [tab,setTab]=useState('settings')
  const [saving,setSaving]=useState(false)
  const stats=computeStats(state.participants)
  const doSet=async u=>{setSaving(true);await setState(u);setSaving(false)}

  if(!auth) return(
    <div className="page fade-up" style={{maxWidth:420}}>
      <div className="section-title">🔐 管理者ログイン</div>
      <div className="card">
        <label style={{fontSize:12,color:'var(--text2)',display:'block',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>パスワード</label>
        <input type="password" className="input" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(pass===ADMIN_PASS?setAuth(true):alert('パスワードが違います'))} placeholder="パスワードを入力" autoFocus/>
        <button className="btn btn-gold" style={{marginTop:14,width:'100%'}} onClick={()=>pass===ADMIN_PASS?setAuth(true):alert('パスワードが違います')}>ログイン</button>
      </div>
    </div>
  )

  return(
    <div className="page fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div className="section-title" style={{margin:0}}>⚙️ 管理者画面</div>
        {saving&&<span style={{fontSize:12,color:'#f59e0b',fontWeight:600}}>💾 保存中…</span>}
      </div>
      <div className="admin-tab-bar">
        {[['settings','設定'],['participants','参加者管理'],['eliminated','敗退国管理'],['winner','優勝国設定']].map(([k,l])=>(
          <button key={k} className={`btn btn-ghost${tab===k?' btn-blue':''}`} style={{padding:'8px 14px',fontSize:12}} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab==='settings'&&(
        <>
          <div className="card">
            <div style={{fontWeight:700,marginBottom:16,fontSize:14,letterSpacing:'.04em'}}>基本設定</div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'var(--text2)',display:'block',marginBottom:10,letterSpacing:'.08em',textTransform:'uppercase'}}>1口単価 (WCT)</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {UNIT_OPTIONS.map(u=><button key={u} className={`btn ${state.settings.unit===u?'btn-gold':'btn-ghost'}`} style={{padding:'8px 14px',fontSize:12}} onClick={()=>doSet(s=>({...s,settings:{...s.settings,unit:u}}))}>{u.toLocaleString()}</button>)}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'var(--text2)',display:'block',marginBottom:10,letterSpacing:'.08em',textTransform:'uppercase'}}>手数料率</label>
              <div style={{display:'flex',gap:6}}>
                {[0,5,10,15,20].map(r=><button key={r} className={`btn ${state.settings.feeRate===r?'btn-gold':'btn-ghost'}`} style={{padding:'8px 12px',fontSize:12}} onClick={()=>doSet(s=>({...s,settings:{...s.settings,feeRate:r}}))}>{r}%</button>)}
              </div>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--text2)',display:'block',marginBottom:10,letterSpacing:'.08em',textTransform:'uppercase'}}>投票状態</label>
              <div style={{display:'flex',gap:8}}>
                {[['open','🟢 受付中','var(--green)'],['closed','🔴 締切','var(--red)']].map(([v,l,c])=>(
                  <button key={v} onClick={()=>doSet(s=>({...s,status:v}))} style={{padding:'10px 20px',borderRadius:10,border:`2px solid ${state.status===v?c:'var(--border)'}`,background:state.status===v?c+'18':'transparent',color:state.status===v?c:'var(--text2)',cursor:'pointer',fontFamily:'inherit',fontWeight:state.status===v?700:400,fontSize:13,transition:'all .2s'}}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div style={{fontWeight:700,marginBottom:14,fontSize:14}}>データ管理</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={()=>{const{odds}=computeOdds(stats,state.settings.feeRate);exportCSV(state.participants,stats,odds,state.winner,state.settings.feeRate)}}>📥 CSVエクスポート</button>
              <button className="btn btn-danger" onClick={async()=>{if(window.confirm('全データをリセットしますか？'))await setState(INIT_STATE)}}>🗑 全リセット</button>
            </div>
          </div>
        </>
      )}

      {tab==='participants'&&(
        <>
          <div style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>参加者 {state.participants.length}人</div>
          {state.participants.length===0&&<div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>参加者なし</div>}
          {state.participants.map(p=>(
            <div key={p.id} className="card" style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{p.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>合計: {fmt(p.bets.reduce((a,b)=>a+b.amount,0))}</div></div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-danger" style={{padding:'5px 10px',fontSize:11}} onClick={()=>{if(window.confirm(`${p.name}さんを削除しますか？`))doSet(s=>({...s,participants:s.participants.filter(x=>x.id!==p.id)}))}}>削除</button>
                  <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:11}} onClick={()=>{if(window.confirm(`${p.name}さんのパスワードをリセットしますか？`)){const newPw={...(state.participantPasswords||{})};delete newPw[p.name];doSet(s=>({...s,participantPasswords:newPw}))}}}>🔓 PW</button>
                </div>
              </div>
              {p.bets.map(b=>{const team=TEAMS.find(t=>t.id===b.teamId);return(
                <div key={b.teamId} style={{display:'flex',gap:8,alignItems:'center',padding:'5px 0',borderTop:'1px solid var(--border)'}}>
                  <span style={{fontSize:16}}>{team?.flag}</span><span style={{flex:1,fontSize:12}}>{team?.name}</span>
                  <span style={{fontSize:12,color:'var(--text3)'}}>{b.lots}口</span><span style={{fontSize:12,color:'var(--gold)',fontWeight:700}}>{fmt(b.amount)}</span>
                </div>
              )})}
            </div>
          ))}
        </>
      )}

      {tab==='eliminated'&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:8,fontSize:14}}>❌ 敗退国を登録・解除</div>
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:20,lineHeight:1.7}}>タップで敗退 / 勝ち残りを切り替え。TOPページの「勝ち残り状況」に即時反映されます。</div>
          {GROUPS.map(grp=>{
            const grpTeams=TEAMS.filter(t=>t.region===grp)
            return(
              <div className="elim-group" key={grp}>
                <div className="elim-group-title" style={{color:'var(--blue)'}}>{grp}</div>
                <div>{grpTeams.map(team=>{
                  const isElim=(state.eliminated||[]).includes(team.id); const isJPN=team.id==='JPN'
                  return(
                    <span key={team.id} className={`elim-pill ${isElim?'dead':`alive${isJPN?' jpn':''}`}`}
                      onClick={()=>doSet(s=>({...s,eliminated:isElim?(s.eliminated||[]).filter(id=>id!==team.id):[...(s.eliminated||[]),team.id]}))}>
                      <span style={{fontSize:16,filter:isElim?'grayscale(1)':'none'}}>{team.flag}</span>
                      <span>{team.name}</span>
                      <span>{isElim?'❌':'✅'}</span>
                    </span>
                  )
                })}</div>
              </div>
            )
          })}
          {(state.eliminated||[]).length>0&&<button className="btn btn-danger" style={{marginTop:10,width:'100%'}} onClick={()=>{if(window.confirm('全敗退国をリセットしますか？'))doSet(s=>({...s,eliminated:[]}))}}>🔄 敗退国をすべてリセット</button>}
        </div>
      )}

      {tab==='winner'&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:8,fontSize:14}}>🏆 優勝国を選択・確定</div>
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:16,lineHeight:1.7}}>選択すると全員に通知され、受取額が自動計算されます。</div>
          {state.winner&&(
            <div className="card glow-gold" style={{textAlign:'center',marginBottom:16,padding:16}}>
              <div style={{fontSize:11,color:'var(--text3)'}}>現在の優勝国</div>
              <div style={{fontSize:44,margin:'8px 0'}}>{TEAMS.find(t=>t.id===state.winner)?.flag}</div>
              <div style={{fontWeight:800,color:'var(--gold)',fontFamily:"'Barlow Condensed',sans-serif",fontSize:20}}>{TEAMS.find(t=>t.id===state.winner)?.name}</div>
            </div>
          )}
          <div className="winner-grid">
            {TEAMS.map(team=>{
              const isJPN=team.id==='JPN'; const isSel=state.winner===team.id
              return(
                <div key={team.id} className={`winner-card${isSel?' selected':''}${isJPN?' jpn':''}`}
                  onClick={()=>{if(window.confirm(`「${team.name}」を優勝国に確定しますか？`)){doSet(s=>({...s,winner:team.id,status:'finished'}));stadiumAudio.bigRoar()}}}>
                  <div style={{fontSize:22}}>{team.flag}</div>
                  <div style={{fontSize:9,marginTop:3,lineHeight:1.3,color:isJPN?'var(--blue)':'var(--text3)'}}>{team.name}</div>
                </div>
              )
            })}
          </div>
          {state.winner&&<button className="btn btn-danger" style={{marginTop:14,width:'100%'}} onClick={()=>doSet(s=>({...s,winner:null,status:'closed'}))}>優勝国をリセット</button>}
        </div>
      )}
    </div>
  )
}

// ── Page: RESULT ──────────────────────────────────────────
function ResultPage({ state }) {
  useEffect(() => {
    if (state.winner) {
      // 少し遅らせてファンファーレ
      const t = setTimeout(() => stadiumAudio.fanfare(), 600)
      return () => clearTimeout(t)
    }
  }, [state.winner])
  const stats=computeStats(state.participants)
  const {odds,totalPool,netPool}=computeOdds(stats,state.settings.feeRate)
  const winnings=state.winner?computeWinnings(state.participants,state.winner,stats,state.settings.feeRate):[]
  const wt=TEAMS.find(t=>t.id===state.winner)
  const fee=totalPool-netPool

  if(!state.winner) return(
    <div className="page" style={{textAlign:'center',paddingTop:60}}>
      <div style={{fontSize:48,marginBottom:16}}>⏳</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:32,color:'var(--gold)',marginBottom:8}}>優勝国未確定</div>
      <p style={{color:'var(--text2)'}}>管理者が優勝国を設定するまでお待ちください</p>
    </div>
  )

  return(
    <div className="page fade-up">
      <div className="winner-hero">
        <div style={{fontSize:11,letterSpacing:'.2em',color:'var(--text3)',marginBottom:12,textTransform:'uppercase'}}>🏆 Champion</div>
        <div className="win-flag">{wt?.flag}</div>
        <div className="win-name">{wt?.name}</div>
        {wt?.id==='JPN'&&<div style={{marginTop:10,fontSize:15,color:'var(--blue)',fontWeight:700}}>🎊 SAMURAI BLUE 優勝おめでとう！🎊</div>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:20}}>
        {[['💰 総投票額',fmt(totalPool),'var(--text)'],['🏦 手数料',fmt(fee),'var(--red)'],['✅ 純分配額',fmt(netPool),'var(--green)'],['🎯 当選者',winnings.length+'人','var(--gold)']].map(([l,v,c])=>(
          <div key={l} className="card" style={{textAlign:'center',padding:'14px 10px',marginBottom:0}}>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:4,letterSpacing:'.06em'}}>{l}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">🎉 当選者一覧</div>
        {winnings.length===0?<div style={{textAlign:'center',color:'var(--text3)',padding:20}}>当選者なし</div>
          :winnings.sort((a,b)=>b.winAmount-a.winAmount).map((w,i)=>(
            <div key={w.name} className="winners-row">
              <div className="rank-medal">{i===0?'🥇':i===1?'🥈':i===2?'🥉':'🎖'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{w.name}</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>投票額: {fmt(w.betAmount)} / {w.lots}口 / 倍率: {fmtOdds(odds[state.winner]||1)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:'var(--gold)'}}>{fmt(w.winAmount)}</div>
                <div style={{fontSize:11,color:w.profit>=0?'var(--green)':'var(--red)',fontWeight:600}}>{w.profit>=0?'+':''}{fmt(w.profit)}</div>
              </div>
            </div>
          ))
        }
      </div>

      <div className="card">
        <div className="section-title">📋 全参加者の損益</div>
        {state.participants.map(p=>{
          const w=winnings.find(w=>w.name===p.name); const total=p.bets.reduce((a,b)=>a+b.amount,0)
          return(
            <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div><div style={{fontWeight:600,fontSize:14}}>{p.name} {w?'🏆':''}</div><div style={{fontSize:11,color:'var(--text3)'}}>投票額: {fmt(total)} / {p.bets.length}か国</div></div>
              <div style={{textAlign:'right'}}>
                {w?(<><div style={{color:'var(--gold)',fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18}}>{fmt(w.winAmount)}</div><div style={{fontSize:11,color:w.profit>=0?'var(--green)':'var(--red)',fontWeight:600}}>利益: {w.profit>=0?'+':''}{fmt(w.profit)}</div></>)
                  :<div style={{color:'var(--red)',fontWeight:700}}>−{fmt(total)}</div>}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn btn-ghost" style={{width:'100%',marginTop:8}} onClick={()=>{const{odds}=computeOdds(stats,state.settings.feeRate);exportCSV(state.participants,stats,odds,state.winner,state.settings.feeRate)}}>📥 結果をCSVで出力</button>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [state,_setState]=useState(INIT_STATE)
  const [page,setPage]=useState('top')
  const [loading,setLoading]=useState(true)
  const [syncing,setSyncing]=useState(false)
  const [lastSync,setLastSync]=useState(null)
  const stateRef=useRef(state)
  const unsubRef=useRef(null)

  useEffect(()=>{ stateRef.current=state },[state])

  useEffect(()=>{
    ;(async()=>{
      const r=await dbLoad(); if(r) _setState(r)
      setLoading(false); setLastSync(new Date())
    })()
    unsubRef.current=dbSubscribe(r=>{ if(r){_setState(r);setLastSync(new Date())} })
    return()=>{ if(unsubRef.current) unsubRef.current() }
  },[])

  const onRefresh=async()=>{
    setSyncing(true); const r=await dbLoad(); if(r) _setState(r)
    setLastSync(new Date()); setSyncing(false)
  }

  const setState=useCallback(async updater=>{
    setSyncing(true)
    try{
      const prev=stateRef.current
      const next=typeof updater==='function'?updater(prev):updater
      await dbSave(next); _setState(next); setLastSync(new Date())
    }catch(e){ console.error(e); alert('保存に失敗しました') }
    finally{ setSyncing(false) }
  },[])

  const PAGES=[['top','🏠 TOP'],['register','⚽ 投票'],['status','📊 状況'],['odds','📈 倍率'],['schedule','📅 日程'],['result','🏆 結果'],['admin','⚙️ 管理']]

  if(loading) return(
    <div className="loading">
      <style>{CSS}</style>
      <div className="spinner"/>
      <div style={{color:'var(--text2)',fontSize:13,letterSpacing:'.08em'}}>LOADING…</div>
    </div>
  )

  return(
    <>
      <style>{CSS}</style>
      <div className="hdr">
        <div className="hdr-inner">
          <div className="hdr-logo">⚽ WC2026</div>
          <nav className="hdr-nav">
            {PAGES.map(([k,l])=><button key={k} className={`nav-btn${page===k?' active':''}`} onClick={()=>setPage(k)}>{l}</button>)}
          </nav>
        </div>
      </div>

      {page==='top'      &&<TopPage      state={state} setPage={setPage} syncing={syncing} lastSync={lastSync} onRefresh={onRefresh}/>}
      {page==='register' &&<RegisterPage state={state} setState={setState}/>}
      {page==='status'   &&<StatusPage   state={state}/>}
      {page==='odds'     &&<OddsPage     state={state}/>}
      {page==='schedule' &&<SchedulePage/>}
      {page==='result'   &&<ResultPage   state={state}/>}
      {page==='admin'    &&<AdminPage    state={state} setState={setState}/>}
      <AudioPlayer/>
    </>
  )
}
